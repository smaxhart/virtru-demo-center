/**
 * Seeds the local OpenTDF platform with demo namespace, attributes, and subject mappings.
 * Runs once on first launch, then skips via marker file.
 */

const fs = require('fs')
const path = require('path')

const PLATFORM_BASE = 'http://localhost:7777'

async function rpc(token, service, method, body = {}) {
  const res = await fetch(`${PLATFORM_BASE}/${service}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} failed ${res.status}: ${text}`)
  }
  return res.json()
}

async function seed(adminToken, markerPath) {
  if (fs.existsSync(markerPath)) {
    console.log('[seeder] Already seeded — skipping')
    return
  }

  console.log('[seeder] Starting platform seed...')

  // 1. Create namespace
  let nsId
  try {
    const r = await rpc(adminToken, 'policy.namespaces.NamespaceService', 'CreateNamespace', { name: 'demo.com' })
    nsId = r.namespace?.id
    console.log('[seeder] Created namespace demo.com:', nsId)
  } catch (e) {
    if (e.message.includes('already_exists') || e.message.includes('already exists') || e.message.includes('AlreadyExists') || e.message.includes('409')) {
      const r = await rpc(adminToken, 'policy.namespaces.NamespaceService', 'ListNamespaces', {})
      nsId = r.namespaces?.find(n => n.name === 'demo.com')?.id
      console.log('[seeder] Namespace already exists:', nsId)
    } else {
      console.warn('[seeder] Namespace warning (continuing):', e.message)
    }
  }

  if (!nsId) {
    console.warn('[seeder] Could not get namespace ID — skipping attributes')
    fs.mkdirSync(path.dirname(markerPath), { recursive: true })
    fs.writeFileSync(markerPath, new Date().toISOString())
    return
  }

  // 2. Define attributes — values is repeated string (plain strings)
  const ATTRIBUTE_DEFS = [
    { name: 'clearance',   rule: 'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY', values: ['ts-sci', 'secret', 'cui', 'unclassified'] },
    { name: 'mission',     rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['intel', 'ops', 'legal', 'cyber', 'external', 'admin'] },
    { name: 'role',        rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['analyst', 'contractor', 'counsel', 'operator', 'commander', 'admin'] },
    { name: 'nationality', rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['USA', 'GBR', 'CAN', 'AUS', 'NZL'] },
    { name: 'relto',       rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['fvey', 'nato', 'usa-only'] },
  ]

  // Map from fqn → attribute value UUID
  const valueIdByFqn = {}

  for (const def of ATTRIBUTE_DEFS) {
    try {
      let attrId
      let attrValues = []

      try {
        const r = await rpc(adminToken, 'policy.attributes.AttributesService', 'CreateAttribute', {
          namespace_id: nsId,
          name: def.name,
          rule: def.rule,
          values: def.values,  // plain string array per proto definition
        })
        attrId = r.attribute?.id
        attrValues = r.attribute?.values ?? []
        console.log('[seeder] Created attribute:', def.name, attrId)
      } catch (e) {
        if (e.message.includes('already_exists') || e.message.includes('already exists') || e.message.includes('AlreadyExists') || e.message.includes('409') || e.message.includes('unique')) {
          // List existing attribute to get value IDs
          const list = await rpc(adminToken, 'policy.attributes.AttributesService', 'ListAttributes', {
            namespace: 'demo.com',
          })
          const existing = list.attributes?.find(a => a.name === def.name)
          if (existing) {
            attrId = existing.id
            attrValues = existing.values ?? []
            console.log('[seeder] Attribute already exists:', def.name, attrId)
          }
        } else {
          console.warn('[seeder] Attribute warning:', def.name, e.message)
          continue
        }
      }

      // Index value IDs by FQN
      for (const v of attrValues) {
        if (v.fqn && v.id) valueIdByFqn[v.fqn] = v.id
        // Also index without leading protocol
        if (v.value && attrId) {
          const fqn = `https://demo.com/attr/${def.name}/value/${v.value}`
          if (v.id) valueIdByFqn[fqn] = v.id
        }
      }
    } catch (e) {
      console.warn('[seeder] Attribute outer error:', def.name, e.message)
    }
  }

  console.log('[seeder] Value ID map keys:', Object.keys(valueIdByFqn).length)

  // 3. Subject mappings — requires attribute_value_id (UUID)
  // Action name must be "read" — that's what the KAS passes to authz v2 (ActionNameRead = "read")
  const SUBJECT_MAPPINGS = [
    // Sarah: TS-SCI analyst, FVEY, intel mission
    { selector: '.sub', value: 'sarah',    fqn: 'https://demo.com/attr/clearance/value/ts-sci' },
    { selector: '.sub', value: 'sarah',    fqn: 'https://demo.com/attr/mission/value/intel' },
    { selector: '.sub', value: 'sarah',    fqn: 'https://demo.com/attr/relto/value/fvey' },
    // James: Secret contractor, FVEY, external mission
    { selector: '.sub', value: 'james',    fqn: 'https://demo.com/attr/clearance/value/secret' },
    { selector: '.sub', value: 'james',    fqn: 'https://demo.com/attr/mission/value/external' },
    { selector: '.sub', value: 'james',    fqn: 'https://demo.com/attr/relto/value/fvey' },
    // Patricia: Secret counsel, FVEY, legal mission
    { selector: '.sub', value: 'patricia', fqn: 'https://demo.com/attr/clearance/value/secret' },
    { selector: '.sub', value: 'patricia', fqn: 'https://demo.com/attr/mission/value/legal' },
    { selector: '.sub', value: 'patricia', fqn: 'https://demo.com/attr/relto/value/fvey' },
    // Marcus: Secret admin, FVEY, cyber mission
    { selector: '.sub', value: 'marcus',   fqn: 'https://demo.com/attr/clearance/value/secret' },
    { selector: '.sub', value: 'marcus',   fqn: 'https://demo.com/attr/mission/value/cyber' },
    { selector: '.sub', value: 'marcus',   fqn: 'https://demo.com/attr/relto/value/fvey' },
    // Emma (fvey-uk): Secret, FVEY, GBR
    { selector: '.sub', value: 'fvey-uk',  fqn: 'https://demo.com/attr/clearance/value/secret' },
    { selector: '.sub', value: 'fvey-uk',  fqn: 'https://demo.com/attr/relto/value/fvey' },
    // Henri (nato-fr): Secret, NATO, FRA
    { selector: '.sub', value: 'nato-fr',  fqn: 'https://demo.com/attr/clearance/value/secret' },
    { selector: '.sub', value: 'nato-fr',  fqn: 'https://demo.com/attr/relto/value/nato' },
    // Klaus (nato-de): Secret, NATO, DEU
    { selector: '.sub', value: 'nato-de',  fqn: 'https://demo.com/attr/clearance/value/secret' },
    { selector: '.sub', value: 'nato-de',  fqn: 'https://demo.com/attr/relto/value/nato' },
  ]

  for (const sm of SUBJECT_MAPPINGS) {
    const valueId = valueIdByFqn[sm.fqn]
    if (!valueId) {
      console.warn('[seeder] No value ID for FQN:', sm.fqn, '— skipping subject mapping')
      continue
    }
    try {
      await rpc(adminToken, 'policy.subjectmapping.SubjectMappingService', 'CreateSubjectMapping', {
        attribute_value_id: valueId,
        actions: [{ name: 'read' }],
        new_subject_condition_set: {
          subject_sets: [{
            condition_groups: [{
              conditions: [{
                subject_external_selector_value: sm.selector,
                operator: 'SUBJECT_MAPPING_OPERATOR_ENUM_IN',
                subject_external_values: [sm.value],
              }],
              boolean_operator: 'CONDITION_BOOLEAN_TYPE_ENUM_AND',
            }],
          }],
        },
      })
    } catch (e) {
      if (!e.message.includes('already exists') && !e.message.includes('AlreadyExists')) {
        console.warn('[seeder] Subject mapping warning:', sm.fqn, e.message)
      }
    }
  }

  fs.mkdirSync(path.dirname(markerPath), { recursive: true })
  fs.writeFileSync(markerPath, new Date().toISOString())
  console.log('[seeder] Seeding complete')
}

module.exports = { seed }
