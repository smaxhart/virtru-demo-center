import { PLATFORM_URL } from '../api/tdf.js'
import { useApp } from '../context/AppContext.jsx'

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', lineHeight: 1.8 }}>{children}</div>
    </div>
  )
}

function Flow() {
  const steps = [
    { n: '1', label: 'Question',   detail: 'The user asks something. No document has been touched yet.' },
    { n: '2', label: 'Classify',   detail: 'Keyword match picks which corpus document is relevant.' },
    { n: '3', label: 'Rewrap ×2',  detail: 'The app asks the KAS to unwrap that TDF key twice — once for the user\'s signed token, once for the agent\'s.' },
    { n: '4', label: 'Decision',   detail: 'The platform evaluates the policy in the manifest against each caller\'s attributes, independently.' },
    { n: '5', label: 'Prompt',     detail: 'Only if both keys came back does plaintext enter the model\'s context.' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px' }}>
      {steps.map((s, i) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'stretch', gap: 8, flex: '1 1 160px' }}>
          <div className="card" style={{ padding: '11px 12px', flex: 1 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--c-accent)', fontWeight: 700 }}>{s.n}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', marginTop: 3 }}>{s.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--c-text-5)', marginTop: 4, lineHeight: 1.55 }}>{s.detail}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ display: 'grid', placeItems: 'center', color: 'var(--c-text-6)', fontSize: 13 }}>→</div>
          )}
        </div>
      ))}
    </div>
  )
}

/** The teaching points and attribute vocabulary of whichever mode is open. */
function ModeSection({ mode }) {
  return (
    <>
      <Section title={`What the ${mode.name} scenario is for`}>
        {mode.premise}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {mode.teaches.map(t => (
            <div key={t.title} className="card" style={{ padding: '11px 13px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: mode.accent }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--c-text-4)', marginTop: 4, lineHeight: 1.65 }}>
                {t.detail}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The attributes this mode decides on">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
          {mode.vocabulary.map(v => (
            <div key={v.name} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <code style={{
                fontSize: 11, flexShrink: 0, minWidth: 96,
                color: 'var(--c-text-2)', fontWeight: 600,
              }}>{v.name}</code>
              <span className="mono" style={{
                fontSize: 9.5, flexShrink: 0, minWidth: 74, padding: '1px 6px', borderRadius: 4,
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                color: 'var(--c-text-5)',
              }}>{v.rule}</span>
              <span style={{ fontSize: 11.5, color: 'var(--c-text-4)', lineHeight: 1.6 }}>{v.detail}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--c-text-6)', marginTop: 10, lineHeight: 1.7 }}>
          All four modes share one <code>demo.com</code> namespace and one set of subject
          mappings. Nothing about the enforcement path is per-scenario — only the vocabulary is.
        </div>
      </Section>
    </>
  )
}

export default function HowItWorksPage() {
  const { mode } = useApp()
  const tiered = mode.documents.filter(d => d.tiers)
  const publicDocs = mode.documents.filter(d => Array.isArray(d.policy) && d.policy.length === 0)

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
      <div style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 32 }}>

        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-1)' }}>How it works</div>
        <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 4, marginBottom: 24, lineHeight: 1.65 }}>
          Everything in this app runs locally except the model call itself.
        </div>

        <Section title="The enforcement point is retrieval, not the prompt">
          The usual approach to a permissioned assistant is to put the rules in the system
          prompt — <em>this user is cleared to SECRET, don't show them TS material</em>. That
          is an instruction, and instructions can be argued with. Here the guardrail is
          upstream of the model entirely: each document is a TDF whose policy is cryptographically
          bound to its key, and the assistant only ever receives text the Key Access Service
          already agreed to unwrap. A refusal isn't the model declining — the plaintext never
          arrived.
          <Flow />
        </Section>

        <Section title="The agent is a subject, not a conduit">
          The assistant has an identity of its own — a real signed token, real attributes, its own
          subject mapping — and the KAS cannot tell it apart from a person. So retrieval asks
          twice, and a document is released only when <em>both</em> subjects are granted. That
          makes the agent's entitlements a hard ceiling on what anyone can pull through it: a
          SECRET-cleared assistant cannot be talked into fetching TS-SCI material for a TS-SCI
          analyst, because the refusal is the platform's and not the model's.
          <p style={{ margin: '10px 0 0' }}>
            This is what an on-behalf-of flow has to mean if it is to mean anything. The usual
            alternative — the agent holds a service account with broad rights and filters
            afterwards — is a confused deputy: the sensitive text has already been decrypted and
            put in front of a model, and the only thing standing between it and the user is an
            instruction. Here an over-granted agent is a real hole you can point at, not a
            cosmetic one, which is why{' '}
            {mode.agents.length > 1 ? 'switching agents in the header changes the access matrix' : 'the agent is switchable'}{' '}
            as visibly as switching people does.
          </p>
          <p style={{ margin: '10px 0 0' }}>
            Both subjects are asked even when one has already refused. It costs a round-trip and
            buys the only thing that makes a refusal explainable: which of the two was the blocker.
            The agent's copy of any plaintext is dropped immediately and never retained — the KAS
            may well release a key to the agent for a document you are refused, and holding that
            text would be the one place this app had something the decision just denied.
          </p>
        </Section>

        <ModeSection mode={mode} />

        <Section title="What is actually running">
          A full OpenTDF platform starts as a child process when the app launches, with an
          embedded Postgres for the policy store and its own KAS keypair generated on first
          run. It listens on <code>{PLATFORM_URL}</code>. Identity comes from an in-process
          OIDC issuer that mints a real RS256 token per persona, so switching personas in the
          header genuinely changes the bearer token the KAS validates. There is no Keycloak
          and no cloud dependency. Launching a mode encrypts that mode's corpus on the spot,
          which is why the first launch of each takes a few seconds.
        </Section>

        <Section title="How the policies compose">
          Three rules cover every policy in every mode:
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li style={{ marginBottom: 5 }}>
              <strong>Separate definitions AND together.</strong> A document naming two
              different attributes needs both. This is where most of the interesting refusals
              come from — a caller who satisfies one half and not the other.
            </li>
            <li style={{ marginBottom: 5 }}>
              <strong>Values inside one definition follow its rule.</strong> An ANY_OF
              definition listing several values admits a holder of any one of them, which is how
              a document gets shared with several communities without being opened to everyone.
            </li>
            <li style={{ marginBottom: 5 }}>
              <strong>HIERARCHY definitions rank their values.</strong> <code>clearance</code> is
              the only one here: tagging a document SECRET admits TS-SCI holders without listing
              them, the same way a classification ladder works on paper.
            </li>
            <li>
              <strong>A policy is a marking, not a roster.</strong> Enumerating the members of a
              community — every nation in an alliance, every person on a case — is both less
              faithful to how the marking actually works and, past 20 values in a single policy,
              unsatisfiable on this platform build: the decision lookup fails and the KAS then
              refuses everyone, including holders who should qualify.
            </li>
          </ul>
        </Section>

        {publicDocs.length > 0 && (
          <Section title="An empty policy is still a policy">
            {publicDocs.map(d => d.label).join(' and ')}{' '}
            {publicDocs.length > 1 ? 'carry' : 'carries'} no attributes at all, so the KAS
            releases the key to every authenticated caller. The document is still a real TDF —
            encrypted, tamper-evident, and auditable on every open. A system that only ever
            denies proves nothing; showing where the boundary <em>isn't</em> is half the point.
          </Section>
        )}

        {tiered.length > 0 && (
          <Section title="Redaction by policy, not by request">
            {tiered.map(doc => (
              <p key={doc.id} style={{ margin: '0 0 8px' }}>
                <strong>{doc.label}</strong> is {doc.tiers.length} independently encrypted TDFs
                over one record: {doc.tiers.map(t => t.label.toLowerCase()).join(', and ')}. The
                app tries the most privileged tier first and falls back, so each caller is served
                the fullest version their attributes earn. Nobody asks the model to please omit
                the sensitive fields — the version containing them was never decryptable for them.
              </p>
            ))}
          </Section>
        )}

        <Section title="Where the model runs">
          Prompts go to Anthropic through the Virtru AI Gateway
          (<code>developer-ai-gateway.virtru.com</code>), authenticated at the machine level by
          WARP, so no API key ships in this app. If the gateway is unreachable the usual cause
          is WARP being disconnected. Note the shape of the trust boundary: released plaintext
          does leave the machine as part of the prompt. What the platform guarantees is that
          only text the caller was entitled to ever gets that far.
        </Section>

        <Section title="Worth saying out loud in a demo">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ marginBottom: 5 }}>
              A persona with no relevant attributes authenticates perfectly and still receives
              nothing. Authentication is not authorization.
            </li>
            <li style={{ marginBottom: 5 }}>
              Encryption never requires entitlement — anyone can seal data under a policy they
              themselves could not open.
            </li>
            <li style={{ marginBottom: 5 }}>
              The same platform enforces clearances, CUI categories, SCI compartments, and CJIS
              rules without knowing what any of them mean. Attribute names are the customer's
              vocabulary; the decision engine is the same code either way.
            </li>
            <li style={{ marginBottom: 5 }}>
              The agent is entitled separately, so "who is asking" has two answers and both have
              to satisfy the policy. Provisioning an assistant is a real authorization decision,
              not plumbing.
            </li>
            <li>
              The Corpus page will hand over a real <code>.tdf</code> file. It stays encrypted
              wherever it goes, and opening it later still requires the KAS to agree.
            </li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
