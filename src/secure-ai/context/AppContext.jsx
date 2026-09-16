import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { MODES } from '../modes/index.js'
import { scenarioToMode } from '../modes/scenario.js'
import { getEntityAttributes } from '../api/auth.js'
import { encryptCorpus } from '../ai/corpusVault.js'
import { attachUpload, attachUploads, loadUploadRecords, uploadDocuments } from '../ai/userDocs.js'

const AppContext = createContext(null)

/**
 * Application state, in two independent tracks.
 *
 * The platform track runs once: the OpenTDF sidecar starts, seeds its attributes and subject
 * mappings, and reports ready. Nothing about it is per-mode — one namespace covers all four
 * scenarios, so switching modes never touches the platform.
 *
 * The corpus track runs per mode, lazily, on first launch. Encrypting a mode's documents is a
 * few dozen real KAS round-trips, so doing all four at boot would triple the startup wait for
 * three scenarios the user may never open. Vaults are cached, so re-entering a mode is instant.
 *
 * Documents the user added themselves ride the corpus track: they are attached to the vault as
 * part of the same promise, so nothing downstream has to care whether a document shipped with
 * the app or arrived this morning. `documents` is what pages should read — `mode.documents` is
 * only the built-in set.
 *
 * There are two entitled subjects at all times: the persona and the agent acting for them. Both
 * are held here, both resolve their attributes the same way, and access requires both. Switching
 * either one changes what is reachable, which is why the corpus probes key on both.
 *
 *   platformPhase — 'starting' | 'ready' | 'error'   (message in bootError)
 *   corpusPhase   — 'idle' | 'encrypting' | 'ready' | 'error'  (for the active mode)
 */
export function AppProvider({ children }) {
  const [platformPhase, setPlatformPhase] = useState('starting')
  const [bootError, setBootError]         = useState(null)
  const [bootProgress, setProgress]       = useState({ done: 0, total: 0, label: '' })
  const [version, setVersion]             = useState('')

  const [modeId, setModeId]       = useState(null)
  const [corpusPhase, setCorpus]  = useState('idle')
  const [vault, setVault]         = useState(null)
  const [personaId, setPersonaId] = useState(null)
  const [agentId, setAgentId]     = useState(null)

  const [entityFqns, setEntityFqns] = useState([])
  const [agentFqns, setAgentFqns]   = useState([])
  const [auditLog, setAuditLog]     = useState([])

  // Uploads for the active mode: every kind, including the foreign TDFs that are inspect-only
  // and therefore never reach the vault. `uploadWarnings` holds records that could not be
  // attached — surfaced rather than swallowed, since a document silently missing from the
  // corpus is the kind of thing you discover mid-demo.
  const [uploads, setUploads]               = useState([])
  const [uploadWarnings, setUploadWarnings] = useState([])

  // Scenarios the user built, loaded from userData at startup. Held as state rather than read
  // from a module, because saving one has to make it enterable immediately.
  // `scenariosLoaded` exists for the route gate: a reload straight into a scenario's URL arrives
  // before the read from disk finishes, and treating "not loaded yet" as "unknown mode" would
  // bounce the user home every time they refreshed inside their own scenario.
  const [scenarios, setScenarios] = useState([])
  const [scenariosLoaded, setScenariosLoaded] = useState(false)

  // modeId → Promise<vault>. A promise rather than a vault so a StrictMode double-effect
  // joins the in-flight encryption instead of starting a second one.
  const vaults = useRef(new Map())
  const activeMode = useRef(null)

  // Built-ins first, so the four shipped scenarios never move as the user adds their own.
  const modes = useMemo(
    () => [...MODES, ...scenarios.map(scenarioToMode)],
    [scenarios]
  )
  // `enterMode` reads this from a callback that must stay stable, so the lookup goes through a ref.
  const modesRef = useRef(modes)
  modesRef.current = modes

  const mode = modeId ? modes.find(m => m.id === modeId) ?? null : null
  const persona = mode?.personas.find(p => p.id === personaId) ?? mode?.personas[0] ?? null
  const agent = mode?.agents?.find(a => a.id === agentId) ?? mode?.agents?.[0] ?? null

  // ── Platform status ─────────────────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI
    if (!api) {
      // Browser mode (`npm run dev:web`) — assume a separately running platform
      setPlatformPhase('ready')
      return
    }

    const handle = (status) => {
      if (status === 'ready') {
        setPlatformPhase(p => (p === 'starting' ? 'ready' : p))
      } else if (status && status.state === 'error') {
        setBootError(status.message)
        setPlatformPhase('error')
      }
    }

    // `ai-status`, not `platform-status`. The platform is reported ready as soon as the sidecar
    // answers, which is early enough for the rest of Demo Center but not for this page: it also
    // needs its own attribute definitions and subject mappings written, or the first question
    // asked would be denied for everyone and read as a bug in the KAS rather than a race.
    const off = api.onAiStatus(handle)
    api.getAiStatus().then(handle).catch(() => {})
    api.getAppVersion?.().then(setVersion).catch(() => {})
    return off
  }, [])

  // ── Corpus encryption, per mode ────────────────────────────────────────────
  useEffect(() => {
    if (!mode || platformPhase !== 'ready') return

    let live = true
    const cached = vaults.current.get(mode.id)

    if (cached) {
      // Already encrypted (or in flight) — adopt it without a progress pass. The uploads were
      // attached to that same vault, so re-reading the index keeps the records in sync with it.
      setCorpus(c => (c === 'ready' ? c : 'encrypting'))
      cached.then(async v => {
        if (!live) return
        setVault(v)
        setUploads(await loadUploadRecords(mode.id))
        setCorpus('ready')
      }).catch(err => { if (live) { setBootError(err.message); setCorpus('error') } })
      return () => { live = false }
    }

    setVault(null)
    setUploads([])
    setUploadWarnings([])
    setCorpus('encrypting')
    setProgress({ done: 0, total: 0, label: '' })

    // Uploads are attached inside the cached promise rather than in a second effect, so there is
    // never a window where the vault is 'ready' but the user's own documents are missing from it.
    const p = encryptCorpus(mode.documents, (prog) => { if (live) setProgress(prog) })
      .then(async v => {
        // Keep the counts so the progress bar stays put; only the label changes. Zeroing the
        // total would make BootGate drop the bar for the last moment of the boot.
        if (live) setProgress(prev => ({ ...prev, label: 'Encrypting your documents' }))
        const { records, failed } = await attachUploads(v, mode.id)
        if (live) { setUploads(records); setUploadWarnings(failed) }
        return v
      })
    vaults.current.set(mode.id, p)

    p.then(v => { if (live) { setVault(v); setCorpus('ready') } })
     .catch(err => {
       // Drop the rejected promise so a retry (re-entering the mode) can start clean.
       vaults.current.delete(mode.id)
       if (live) {
         setBootError(`Could not encrypt the ${mode.short} corpus: ${err.message}`)
         setCorpus('error')
       }
     })

    return () => { live = false }
  }, [mode, platformPhase])

  // ── Entitlements for the active persona ────────────────────────────────────
  useEffect(() => {
    if (!personaId) { setEntityFqns([]); return }
    let live = true
    getEntityAttributes(personaId)
      .then(fqns => { if (live) setEntityFqns(fqns) })
      .catch(() => { if (live) setEntityFqns([]) })
    return () => { live = false }
  }, [personaId])

  // ── Entitlements for the active agent ──────────────────────────────────────
  // Resolved through the same call as a person's, because the platform draws no distinction
  // between them. An agent's attributes are read from its own signed token, not asserted here.
  useEffect(() => {
    if (!agentId) { setAgentFqns([]); return }
    let live = true
    getEntityAttributes(agentId)
      .then(fqns => { if (live) setAgentFqns(fqns) })
      .catch(() => { if (live) setAgentFqns([]) })
    return () => { live = false }
  }, [agentId])

  /**
   * Launch a mode. Resets the persona to the mode's default; ignores unknown ids.
   *
   * The ref shadows modeId so this stays a stable callback — the route gate calls it from an
   * effect on every render, and a changing identity there would loop.
   */
  const enterMode = useCallback((id) => {
    const next = modesRef.current.find(m => m.id === id)
    if (!next) return false
    if (activeMode.current === id) return true
    activeMode.current = id
    setModeId(id)
    setPersonaId(next.defaultPersonaId)
    setAgentId(next.defaultAgentId ?? next.agents?.[0]?.id ?? null)
    setBootError(null)
    return true
  }, [])

  /** Back to the launcher. Keeps the cached vault so relaunching is instant. */
  const exitMode = useCallback(() => {
    activeMode.current = null
    setModeId(null)
    setPersonaId(null)
    setAgentId(null)
    setVault(null)
    setUploads([])
    setUploadWarnings([])
    setCorpus('idle')
  }, [])

  // ── Documents the user added ───────────────────────────────────────────────
  //
  // The vault Map is mutated in place rather than rebuilt, because the promise cached in
  // `vaults` has to keep resolving to the populated version — a copy would leave the cache
  // stale the moment the mode is re-entered. `setVault(new Map(v))` then gives React a new
  // identity over the same entries so the pages re-render.

  /**
   * Store a document and put it to work immediately: no restart, no re-encrypting the corpus.
   * Foreign TDFs are stored and listed but never attached — their key belongs to another KAS.
   *
   * @returns {Promise<object>} the stored record
   */
  const addDocument = useCallback(async (record, payload) => {
    const stored = await window.electronAPI.addUpload({ ...record, modeId }, payload)
    try {
      if (vault) {
        await attachUpload(vault, stored)
        setVault(new Map(vault))
      }
    } catch (err) {
      // The add did not take effect, so nothing should linger from it. Left on disk it would
      // reappear as a load warning on the next launch, for an action the user saw fail.
      await window.electronAPI.deleteUpload(stored.id).catch(() => {})
      throw err
    }
    setUploads(prev => [...prev, stored])
    return stored
  }, [modeId, vault])

  /** Forget a document. Dropping its vault entry is what removes it from the corpus. */
  const removeDocument = useCallback(async (id) => {
    await window.electronAPI.deleteUpload(id)
    if (vault?.delete(id)) setVault(new Map(vault))
    setUploads(prev => prev.filter(r => r.id !== id))
    setUploadWarnings(prev => prev.filter(w => w.record.id !== id))
  }, [vault])

  // ── Scenarios the user built ───────────────────────────────────────────────
  //
  // The main process owns validation, persistence and seeding; this is only the cache the
  // launcher renders from. Every mutation returns the stored scenario and this replaces its
  // entry, so the two can never drift.

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.listScenarios) { setScenariosLoaded(true); return }
    api.listScenarios()
      .then(setScenarios)
      .catch(() => setScenarios([]))
      .finally(() => setScenariosLoaded(true))
  }, [])

  /**
   * Create or update a scenario. Resolves once the platform has been taught its vocabulary, so
   * the caller can enter it straight away.
   *
   * Dropping the cached vault matters more than it looks: editing a document's policy leaves the
   * old ciphertext in the cache, encrypted under the *previous* policy, and re-entering the mode
   * would then demo the policy the user just changed away from.
   */
  const saveScenario = useCallback(async (scenario) => {
    const stored = await window.electronAPI.saveScenario(scenario)
    vaults.current.delete(stored.id)
    setScenarios(prev => prev.some(s => s.id === stored.id)
      ? prev.map(s => (s.id === stored.id ? stored : s))
      : [...prev, stored])
    return stored
  }, [])

  /** Forget a scenario. Leaving the active mode first, since it may be the one being deleted. */
  const deleteScenario = useCallback(async (id) => {
    await window.electronAPI.deleteScenario(id)
    vaults.current.delete(id)
    if (activeMode.current === id) exitMode()
    setScenarios(prev => prev.filter(s => s.id !== id))
  }, [exitMode])

  /** Write a scenario out as a shareable file. Returns the path, or null if cancelled. */
  const exportScenario = useCallback(
    (scenario) => window.electronAPI.exportScenario(scenario),
    []
  )

  /** Read a scenario bundle in. Returns the stored scenario, or null if cancelled. */
  const importScenario = useCallback(async () => {
    const stored = await window.electronAPI.importScenario()
    if (!stored) return null
    setScenarios(prev => [...prev, stored])
    return stored
  }, [])

  // What every page should read. Built-ins first so the familiar documents stay where the
  // muscle memory expects them.
  const documents = useMemo(
    () => (mode ? [...mode.documents, ...uploadDocuments(uploads)] : []),
    [mode, uploads]
  )

  /** The inspect-only uploads, which are shown but deliberately absent from the corpus. */
  const foreignUploads = useMemo(
    () => uploads.filter(r => r.kind === 'ztdf-foreign'),
    [uploads]
  )

  const logEvent = useCallback((event) => {
    setAuditLog(prev => [
      { mode: event.mode ?? modeId, ...event, id: `${Date.now()}-${prev.length}`, at: new Date() },
      ...prev,
    ].slice(0, 500))
  }, [modeId])

  const clearAudit = useCallback(() => setAuditLog([]), [])

  return (
    <AppContext.Provider value={{
      platformPhase, corpusPhase, bootError, bootProgress, version,
      modes, mode, modeId, enterMode, exitMode,
      scenarios, scenariosLoaded, saveScenario, deleteScenario, exportScenario, importScenario,
      vault, documents,
      uploads, foreignUploads, uploadWarnings, addDocument, removeDocument,
      personas: mode?.personas ?? [], persona, personaId, setPersonaId,
      agents: mode?.agents ?? [], agent, agentId, setAgentId,
      entityFqns, agentFqns,
      auditLog, logEvent, clearAudit,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
