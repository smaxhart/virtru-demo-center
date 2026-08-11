const NS = 'https://demo.com/attr'
const COI_FVEY_FQNS = ['usa', 'gbr', 'aus', 'nzl', 'can'].map(n => `${NS}/nationality/value/${n}`)
const COI_NATO_FQNS = [
  'usa', 'can', 'gbr', 'fra', 'bel', 'nld', 'lux', 'nor', 'dnk', 'isl', 'ita', 'prt',
  'grc', 'tur', 'deu', 'esp', 'hun', 'pol', 'cze', 'bgr', 'est', 'lva', 'ltu', 'rou',
  'svk', 'svn', 'alb', 'hrv', 'mne', 'mkd', 'fin', 'swe',
].map(n => `${NS}/nationality/value/${n}`)

// Parse standard US classification marking from first line of text.
// Returns { fqns, firstLine, tokens } — fqns is empty if no clearance token found.
export function parseMarkingToFqns(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
  const tokens = firstLine.toUpperCase().split('//').map(t => t.trim()).filter(Boolean)

  const fqns = new Set()
  let foundClearance = false

  for (const token of tokens) {
    if (/^TOP\s+SECRET/.test(token) || token === 'TS' || token === 'TS/SCI' || token === 'SCI') {
      fqns.add(`${NS}/clearance/value/ts-sci`); foundClearance = true
    } else if (token === 'SECRET' || token === 'S') {
      fqns.add(`${NS}/clearance/value/secret`); foundClearance = true
    } else if (token === 'CONFIDENTIAL' || token === 'C') {
      fqns.add(`${NS}/clearance/value/cui`); foundClearance = true
    } else if (token === 'UNCLASSIFIED' || token === 'U') {
      fqns.add(`${NS}/clearance/value/unclassified`); foundClearance = true
    } else if (token.includes('FVEY')) {
      COI_FVEY_FQNS.forEach(f => fqns.add(f))
    } else if (token.includes('NATO')) {
      COI_NATO_FQNS.forEach(f => fqns.add(f))
    } else if (token === 'INTEL' || token === 'SI') {
      fqns.add(`${NS}/mission/value/intel`)
    } else if (token === 'CYBER') {
      fqns.add(`${NS}/mission/value/cyber`)
    } else if (token === 'LEGAL') {
      fqns.add(`${NS}/mission/value/legal`)
    }
    // NOFORN, NF, ORCON, FOUO, etc. — display only, no FQN mapping
  }

  if (!foundClearance) return { fqns: [], firstLine: '', tokens: [] }

  return { fqns: [...fqns], firstLine, tokens }
}

export function fqnsToShortLabels(fqns) {
  return fqns.map(fqn => {
    const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
    return m ? `${m[1]}:${m[2]}` : fqn
  })
}
