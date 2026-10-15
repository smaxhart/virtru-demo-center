import { useEffect, useRef, useState, useCallback } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import { encryptText, decryptTdf } from '../api/tdf.js'
import {
  SOURCE_TYPES, CLASSIFICATIONS, SEED_OBJECTS,
  NEEDTOKNOW_OPTIONS, RELTO_OPTIONS,
  getClassification, getSourceType, getNeedToKnow,
  buildFqns, buildBanner,
  canAccessFqns, missingFqns,
  SIM_BOUNDS, SIM_TICK_MS, SIM_SPEED_MULT, CLIP_CONFIGS,
} from '../data/copSourceTypes.js'
import UiIcon from '../components/UiIcon.jsx'
import 'leaflet/dist/leaflet.css'

// Like buildBanner but accepts raw relTo strings (e.g. ['FVEY', 'NATO']) instead of IDs
function buildBannerRaw(classId, needToKnowIds, relToRaw) {
  const parts = [getClassification(classId).banner]
  if (needToKnowIds.length > 0)
    parts.push(needToKnowIds.map(id => getNeedToKnow(id)?.label ?? id).join('/'))
  if (relToRaw.length > 0)
    parts.push('REL TO ' + relToRaw.join(', '))
  return parts.join(' // ')
}

const STORAGE_KEY = 'cop_objects_v12'
const SEEDED_KEY  = 'cop_seeded_v12'

const MAP_CENTER = [38, -72]
const MAP_ZOOM   = 5

// CARTO's free basemaps require a key on every request; without one each tile is replaced by an
// "API KEY REQUIRED" watermark. The key is inlined from VITE_CARTO_KEY at build time (see .env.local.example).
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY
const BASEMAP_URL = `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_KEY ?? ''}`
// CARTO's terms require this credit on every map. Bottom-left: the legend covers the bottom-right.
const BASEMAP_CREDIT = '© OpenStreetMap contributors, © <a href="https://carto.com/attributions/" target="_blank" rel="noreferrer">CARTO</a>'

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadObjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function saveObjects(objs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(objs))
}

function objFqns(obj) {
  return buildFqns(obj.classification, obj.needToKnow ?? [], obj.relTo ?? [])
}

function makeMarkerIcon(classId, srcTypeId, hasAccess) {
  if (!hasAccess) return { html: '', className: '', iconSize: [0, 0], iconAnchor: [0, 0] }
  const cls = getClassification(classId)
  const col = cls.color
  const strk = cls.stroke
  let svg

  if (srcTypeId === 'facility') {
    // Building — triangular roof + body + windows + door
    svg = `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <polygon points="13,1 25,12 1,12" fill="${col}" stroke="${strk}" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="3" y="12" width="20" height="13" fill="${col}30" stroke="${strk}" stroke-width="1.5"/>
      <rect x="5" y="14" width="5" height="4" rx="0.5" fill="${col}" opacity="0.85"/>
      <rect x="16" y="14" width="5" height="4" rx="0.5" fill="${col}" opacity="0.85"/>
      <rect x="11" y="18" width="4" height="7" rx="1" fill="${col}"/>
    </svg>`
    return { html: svg, className: '', iconSize: [26, 26], iconAnchor: [13, 13] }
  }

  if (srcTypeId === 'ground_unit') {
    // Top-down vehicle — body + 4 wheel stubs + windshield line
    svg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="14" height="16" rx="3" fill="${col}" stroke="${strk}" stroke-width="1.5"/>
      <rect x="2" y="7"  width="3" height="4" rx="1" fill="${strk}"/>
      <rect x="19" y="7" width="3" height="4" rx="1" fill="${strk}"/>
      <rect x="2" y="13" width="3" height="4" rx="1" fill="${strk}"/>
      <rect x="19" y="13" width="3" height="4" rx="1" fill="${strk}"/>
      <rect x="8" y="5" width="8" height="3" rx="1" fill="${strk}" opacity="0.45"/>
    </svg>`
    return { html: svg, className: '', iconSize: [24, 24], iconAnchor: [12, 12] }
  }

  if (srcTypeId === 'incident') {
    // Warning triangle — bold outline + exclamation mark
    svg = `<svg width="26" height="24" viewBox="0 0 26 24" xmlns="http://www.w3.org/2000/svg">
      <polygon points="13,1 25,23 1,23" fill="${col}30" stroke="${strk}" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="13" y1="9" x2="13" y2="16" stroke="${col}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="13" cy="20" r="2" fill="${col}"/>
    </svg>`
    return { html: svg, className: '', iconSize: [26, 24], iconAnchor: [13, 12] }
  }

  if (srcTypeId === 'patient') {
    // Medical cross on circular background
    svg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="${col}22" stroke="${strk}" stroke-width="1.5"/>
      <rect x="9" y="3"  width="6" height="18" rx="2" fill="${col}"/>
      <rect x="3" y="9"  width="18" height="6" rx="2" fill="${col}"/>
    </svg>`
    return { html: svg, className: '', iconSize: [24, 24], iconAnchor: [12, 12] }
  }

  // Default: response_unit — helicopter top-down (rotor disc + fuselage + tail boom + tail rotor)
  svg = `<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
    <circle cx="15" cy="15" r="14" fill="${col}18" stroke="${strk}" stroke-width="1.5"/>
    <line x1="2" y1="15" x2="28" y2="15" stroke="${col}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="15" cy="15" r="2.5" fill="${strk}"/>
    <ellipse cx="15" cy="19" rx="4.5" ry="6" fill="${col}"/>
    <line x1="15" y1="25" x2="15" y2="29" stroke="${col}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="28" x2="18" y2="28" stroke="${col}" stroke-width="2" stroke-linecap="round"/>
  </svg>`
  return { html: svg, className: '', iconSize: [30, 30], iconAnchor: [15, 15] }
}

// ── Create Form Modal ─────────────────────────────────────────────────────────

function CreateForm({ onClose, onCreated, activePersona }) {
  const [srcTypeId, setSrcTypeId]   = useState(SOURCE_TYPES[0].id)
  const [classId, setClassId]       = useState(SOURCE_TYPES[0].defaultClassification)
  const [needToKnow, setNeedToKnow] = useState([])
  const [relToText, setRelToText]   = useState('')
  const [title, setTitle]           = useState('')
  const [lat, setLat]               = useState('')
  const [lng, setLng]               = useState('')
  const [fieldVals, setFieldVals]   = useState({})
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)

  const srcType = getSourceType(srcTypeId)
  const cls     = getClassification(classId)

  const showNtk = srcType.attrFields.includes('attrNeedToKnow')
  const showRel = srcType.attrFields.includes('attrRelTo')

  function handleSrcTypeChange(id) {
    const st = getSourceType(id)
    setSrcTypeId(id)
    setClassId(st.defaultClassification)
    setNeedToKnow([])
    setRelToText('')
    setFieldVals({})
  }

  function toggleArr(arr, setArr, id) {
    setArr(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function setField(name, val) {
    setFieldVals(prev => ({ ...prev, [name]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const latF = parseFloat(lat)
    const lngF = parseFloat(lng)
    if (isNaN(latF) || isNaN(lngF)) { setError('Lat/Lng must be numeric'); return }
    setSaving(true)
    try {
      const relTo = relToText.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
      const fqns = buildFqns(classId, needToKnow, relTo.map(s => s.toLowerCase()))
      const payload = JSON.stringify(fieldVals)
      const { tdfBytes } = await encryptText(payload, fqns, activePersona.id)
      const banner = buildBannerRaw(classId, needToKnow, relTo)
      const obj = {
        id: `obj-${Date.now()}`,
        srcTypeId,
        lat: latF,
        lng: lngF,
        classification: classId,
        needToKnow,
        relTo,
        title: title || `${srcType.label} — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        banner,
        tdfB64: btoa(String.fromCharCode(...new Uint8Array(tdfBytes))),
        createdBy: activePersona.name,
        createdById: activePersona.id,
        ts: new Date().toISOString(),
      }
      onCreated(obj)
    } catch (err) {
      setError(`Encryption failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(10,26,51,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card-raised" style={{
        padding: 24, width: 520, maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-1)' }}>Create Encrypted Object</div>
            <div style={{ fontSize: 12.5, color: 'var(--c-text-5)', marginTop: 2 }}>
              Encrypting as {activePersona.name}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: 0, width: 30 }}><UiIcon name="x" size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Source type */}
          <div>
            <label style={labelStyle}>Source Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {SOURCE_TYPES.map(st => (
                <button key={st.id} type="button" onClick={() => handleSrcTypeChange(st.id)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 'var(--c-radius-btn)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: srcTypeId === st.id ? 'var(--c-info-bg)' : 'var(--c-surface)',
                    border: `1px solid ${srcTypeId === st.id ? 'var(--c-accent)' : 'var(--c-border-2)'}`,
                    color: srcTypeId === st.id ? 'var(--c-accent)' : 'var(--c-text-3)',
                  }}>
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Classification */}
          <div>
            <label style={labelStyle}>Classification</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CLASSIFICATIONS.map(c => (
                <button key={c.id} type="button" onClick={() => setClassId(c.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--c-radius-chip)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                    background: classId === c.id ? c.color + '22' : 'var(--c-surface)',
                    border: `1px solid ${classId === c.id ? c.color : 'var(--c-border-2)'}`,
                    color: classId === c.id ? c.text : 'var(--c-text-4)',
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* NeedToKnow compartments */}
          {showNtk && (
            <div>
              <label style={labelStyle}>Need To Know</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {NEEDTOKNOW_OPTIONS.map(n => (
                  <button key={n.id} type="button" onClick={() => toggleArr(needToKnow, setNeedToKnow, n.id)}
                    style={{
                      padding: '5px 12px', borderRadius: 'var(--c-radius-chip)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
                      background: needToKnow.includes(n.id) ? 'var(--c-purple-bg)' : 'var(--c-surface)',
                      border: `1px solid ${needToKnow.includes(n.id) ? '#cfc4f0' : 'var(--c-border-2)'}`,
                      color: needToKnow.includes(n.id) ? '#5b3fb0' : 'var(--c-text-4)',
                    }}>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* RelTo */}
          {showRel && (
            <div>
              <label style={labelStyle}>Releasable To</label>
              <input
                value={relToText}
                onChange={e => setRelToText(e.target.value)}
                placeholder="e.g. FVEY, NATO"
                style={inputStyle}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label style={labelStyle}>Title (optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={`e.g. ${srcType.label} — ${new Date().toLocaleDateString()}`}
              style={inputStyle} />
          </div>

          {/* Lat / Lng */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="e.g. 38.5" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input value={lng} onChange={e => setLng(e.target.value)} placeholder="e.g. -72.0" style={inputStyle} required />
            </div>
          </div>

          {/* Schema-driven fields */}
          <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--c-text-1)', marginBottom: 10 }}>
              {srcType.fullLabel} fields
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {srcType.fields.map(f => (
                <div key={f.name}>
                  <label style={labelStyle}>{f.label}{f.required && <span style={{ color: 'var(--c-deny)' }}> *</span>}</label>
                  {f.type === 'textarea' ? (
                    <textarea value={fieldVals[f.name] ?? ''} onChange={e => setField(f.name, e.target.value)}
                      placeholder={f.placeholder} required={f.required} rows={3}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} />
                  ) : f.type === 'select' ? (
                    <select value={fieldVals[f.name] ?? ''} onChange={e => setField(f.name, e.target.value)}
                      required={f.required} style={inputStyle}>
                      <option value="">— Select —</option>
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={fieldVals[f.name] ?? ''} onChange={e => setField(f.name, e.target.value)}
                      placeholder={f.placeholder} required={f.required} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--c-radius-btn)', background: 'var(--c-deny-bg)', border: '1px solid var(--c-deny-br)', fontSize: 12.5, color: 'var(--c-deny)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Encrypting…' : <><UiIcon name="lock" size={15} /> Encrypt &amp; Place</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-3)', marginBottom: 5 }
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 'var(--c-radius-btn)', background: 'var(--c-surface)', border: '1px solid var(--c-border-2)', color: 'var(--c-text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

// ── CCTV Feed ─────────────────────────────────────────────────────────────────

function RecDot() {
  return (
    <>
      <style>{`@keyframes recBlink{0%,49%{opacity:1}50%,100%{opacity:0}}`}</style>
      <span style={{
        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
        background: '#ef4444', flexShrink: 0,
        animation: 'recBlink 1.2s step-start infinite',
      }} />
    </>
  )
}

function CctvFeed({ config, classification }) {
  const videoRef = useRef(null)
  const cls = getClassification(classification)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = config.startTime ?? 0
    v.play().catch(() => {})
  }, [config.src])

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '16/9',
      background: '#000', borderRadius: 6, overflow: 'hidden',
      border: `1px solid ${cls.color}40`, marginTop: 12,
    }}>
      <video
        ref={videoRef}
        src={config.src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: config.filter || undefined }}
        autoPlay loop muted playsInline
      />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.12) 2px,rgba(0,0,0,0.12) 4px)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.55) 100%)',
      }} />
      <div style={{ position:'absolute', top:4, left:4, width:10, height:10, pointerEvents:'none', borderTop:`1.5px solid ${cls.color}`, borderLeft:`1.5px solid ${cls.color}` }} />
      <div style={{ position:'absolute', top:4, right:4, width:10, height:10, pointerEvents:'none', borderTop:`1.5px solid ${cls.color}`, borderRight:`1.5px solid ${cls.color}` }} />
      <div style={{ position:'absolute', bottom:4, left:4, width:10, height:10, pointerEvents:'none', borderBottom:`1.5px solid ${cls.color}`, borderLeft:`1.5px solid ${cls.color}` }} />
      <div style={{ position:'absolute', bottom:4, right:4, width:10, height:10, pointerEvents:'none', borderBottom:`1.5px solid ${cls.color}`, borderRight:`1.5px solid ${cls.color}` }} />
      <div style={{
        position: 'absolute', top: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5,
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#fff', pointerEvents: 'none',
        textShadow: '0 0 4px rgba(0,0,0,0.9)',
      }}>
        <RecDot /> REC&nbsp;&nbsp;{config.camId}
      </div>
      <div style={{
        position: 'absolute', top: 6, right: 8,
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
        color: 'rgba(255,255,255,0.65)', pointerEvents: 'none',
        textShadow: '0 0 4px rgba(0,0,0,0.9)',
      }}>
        {config.label}
      </div>
      <div style={{
        position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800,
        color: cls.color, letterSpacing: '0.12em', pointerEvents: 'none',
        textShadow: '0 0 4px rgba(0,0,0,0.9)',
      }}>
        {cls.banner}
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ obj, liveObj, activePersona, onClose, onDecrypt, decryptState }) {
  const cls      = getClassification(obj.classification)
  const srcType  = getSourceType(obj.srcTypeId)
  const fqns     = objFqns(obj)
  const hasAccess = canAccessFqns(fqns, activePersona)
  const missing   = missingFqns(fqns, activePersona)
  const banner    = obj.banner ?? buildBanner(obj.classification, obj.needToKnow ?? [], obj.relTo ?? [])

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 800,
      background: 'var(--c-surface)', borderLeft: '1px solid var(--c-border)',
      boxShadow: 'var(--c-shadow-lg)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Classification banner */}
      <div style={{
        padding: '6px 14px', textAlign: 'center',
        background: cls.color + '22', borderBottom: `1px solid ${cls.color}66`,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: cls.text,
        flexShrink: 0,
      }}>
        {banner}
      </div>

      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginBottom: 4 }}>
              {srcType.fullLabel}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--c-text-1)', lineHeight: 1.3 }}>{obj.title}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close" style={{ padding: 0, width: 28, height: 28, flexShrink: 0 }}><UiIcon name="x" size={15} /></button>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <MetaRow label="Created by" value={obj.createdBy} />
          <MetaRow label="Time" value={new Date(obj.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} />
          <MetaRow label="Location" value={`${liveObj.lat.toFixed(2)}°N, ${liveObj.lng.toFixed(2)}°W`} />
          {(obj.srcTypeId === 'response_unit' || obj.srcTypeId === 'ground_unit') && liveObj.heading != null && (
            <MetaRow label="Heading" value={`${Math.round(liveObj.heading)}°`} />
          )}
        </div>

        {/* Required attributes */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--c-text-4)', marginBottom: 6 }}>Required attributes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {fqns.map(fqn => {
              const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
              const label = m ? `${m[1]}:${m[2]}` : fqn
              return (
                <span key={fqn} className="chip chip-mono">
                  {label}
                </span>
              )
            })}
          </div>
        </div>

        {/* Access status */}
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--c-radius-btn)',
          background: hasAccess ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
          border: `1px solid ${hasAccess ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
        }}>
          {hasAccess ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--c-grant)' }}>
              <UiIcon name="check" size={18} strokeWidth={2} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 650 }}>Entitlements satisfied</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-4)' }}>KAS will grant access</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, color: 'var(--c-deny)' }}>
                <UiIcon name="lock" size={17} strokeWidth={2} />
                <div style={{ fontSize: 13, fontWeight: 650 }}>Insufficient clearance</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--c-text-4)', marginBottom: 5 }}>Missing attributes:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {missing.map(fqn => {
                  const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
                  const label = m ? `${m[1]}:${m[2]}` : fqn
                  return (
                    <span key={fqn} className="chip chip-mono chip-deny">
                      {label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Decrypted content */}
        {decryptState === 'granted' && obj._decrypted && (
          <DecryptedContent data={JSON.parse(obj._decrypted)} srcType={getSourceType(obj.srcTypeId)} />
        )}
        {decryptState === 'granted' && CLIP_CONFIGS[obj.id] && (
          <CctvFeed config={CLIP_CONFIGS[obj.id]} classification={obj.classification} />
        )}
        {decryptState === 'denied' && (
          <div style={{ padding: '10px 12px', borderRadius: 'var(--c-radius-btn)', background: 'var(--c-deny-bg)', border: '1px solid var(--c-deny-br)' }}>
            <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--c-deny)', marginBottom: 4 }}>KAS: 403 Forbidden</div>
            <div style={{ fontSize: 12, color: 'var(--c-text-4)' }}>Entitlement check failed. The file remains encrypted.</div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
      <span style={{ color: 'var(--c-text-5)', flexShrink: 0 }}>{label}</span>
      <span className="num" style={{ color: 'var(--c-text-2)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function DecryptedContent({ data, srcType }) {
  return (
    <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--c-grant)', marginBottom: 10 }}>
        Decrypted payload
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {srcType.fields.map(f => {
          const val = data[f.name]
          if (!val) return null
          return (
            <div key={f.name}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-5)', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: 'var(--c-text-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{val}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Main Component ────────────────────────────────────────────────────────────

export default function CopPage() {
  const { activePersona, platformReady, logEvent } = useDemo()

  const mapContainerRef = useRef(null)
  const mapInstanceRef  = useRef(null)
  const leafletRef      = useRef(null)
  const layersRef       = useRef({})
  const simIntervalRef  = useRef(null)

  const [objects, setObjects]           = useState([])
  const [mapLoaded, setMapLoaded]       = useState(false)
  const [seeding, setSeeding]           = useState(false)
  const [filterType, setFilterType]     = useState('all')
  const [filterCls, setFilterCls]       = useState('all')
  const [selectedObj, setSelectedObj]   = useState(null)
  const [decryptState, setDecryptState] = useState(null)
  const [showCreate, setShowCreate]     = useState(false)
  const [legend, setLegend]             = useState(true)
  const [simRunning, setSimRunning]     = useState(false)

  // Load persisted objects
  useEffect(() => {
    setObjects(loadObjects())
  }, [])

  // Auto-seed on first launch when platform is ready
  useEffect(() => {
    if (!platformReady) return
    if (localStorage.getItem(SEEDED_KEY) && loadObjects().length > 0) return
    if (seeding) return
    setSeeding(true)
    ;(async () => {
      const seeded = []
      for (const seed of SEED_OBJECTS) {
        try {
          const fqns = buildFqns(seed.classification, seed.needToKnow ?? [], seed.relTo ?? [])
          const { tdfBytes } = await encryptText(seed.payload, fqns, seed.encryptAsPersona)
          const obj = {
            id: seed.id,
            srcTypeId: seed.srcTypeId,
            lat: seed.lat,
            lng: seed.lng,
            classification: seed.classification,
            needToKnow: seed.needToKnow ?? [],
            relTo: seed.relTo ?? [],
            title: seed.title,
            banner: buildBanner(seed.classification, seed.needToKnow ?? [], seed.relTo ?? []),
            tdfB64: btoa(String.fromCharCode(...new Uint8Array(tdfBytes))),
            createdBy: 'System (seeded)',
            createdById: seed.encryptAsPersona,
            ts: new Date(Date.now() - Math.random() * 7200000).toISOString(),
          }
          if (seed.srcTypeId === 'response_unit' || seed.srcTypeId === 'ground_unit') {
            obj.speed   = seed.speed   ?? 0
            obj.heading = seed.heading ?? 0
          }
          seeded.push(obj)
        } catch {}
      }
      saveObjects(seeded)
      setObjects(seeded)
      localStorage.setItem(SEEDED_KEY, '1')
      setSeeding(false)
    })()
  }, [platformReady])

  // Init Leaflet map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      import('leaflet').then(({ default: L }) => {
        leafletRef.current = L
        const map = L.map(mapContainerRef.current, {
          center: MAP_CENTER, zoom: MAP_ZOOM,
          zoomControl: true, attributionControl: false,
        })
        if (!CARTO_KEY) console.warn('[cop] VITE_CARTO_KEY was not set at build time: the basemap will show CARTO\'s "API KEY REQUIRED" watermark')
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)
        L.tileLayer(BASEMAP_URL, { maxZoom: 19, attribution: BASEMAP_CREDIT }).addTo(map)
        mapInstanceRef.current = map
        setMapLoaded(true)
      })
    }
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        leafletRef.current = null
        layersRef.current = {}
      }
    }
  }, [])

  // Sync map layers whenever objects or persona changes — reposition in place to avoid flicker
  useEffect(() => {
    if (!mapLoaded || !leafletRef.current || !mapInstanceRef.current) return
    const L   = leafletRef.current
    const map = mapInstanceRef.current

    objects.forEach(obj => {
      const hasAccess = canAccessFqns(objFqns(obj), activePersona)
      const icon = L.divIcon(makeMarkerIcon(obj.classification, obj.srcTypeId, hasAccess))
      if (layersRef.current[obj.id]) {
        layersRef.current[obj.id].setLatLng([obj.lat, obj.lng])
        layersRef.current[obj.id].setIcon(icon)
      } else {
        const marker = L.marker([obj.lat, obj.lng], { icon })
        marker.on('click', () => {
          if (!canAccessFqns(objFqns(obj), activePersona)) return
          const snapshot = { ...obj }
          setSelectedObj(snapshot)
          setDecryptState(null)
          handleDecrypt(snapshot)
        })
        marker.addTo(map)
        layersRef.current[obj.id] = marker
      }
    })

    // Remove markers for deleted objects
    Object.keys(layersRef.current).forEach(id => {
      if (!objects.find(o => o.id === id)) {
        map.removeLayer(layersRef.current[id])
        delete layersRef.current[id]
      }
    })
  }, [mapLoaded, objects, activePersona])

  // Simulation tick — moves vehicles along their heading at 10× real speed
  function tickSimulation(prev) {
    const tickSec = SIM_TICK_MS / 1000
    return prev.map(obj => {
      if ((obj.srcTypeId !== 'response_unit' && obj.srcTypeId !== 'ground_unit') || !obj.speed || obj.heading == null) return obj
      const knotsPerSec = obj.speed / 3600
      const degPerSec   = knotsPerSec / 60   // 1 nautical mile ≈ 1/60 degree latitude
      const dist        = degPerSec * tickSec * SIM_SPEED_MULT
      const headRad     = (obj.heading * Math.PI) / 180
      let newLat     = obj.lat + dist * Math.cos(headRad)
      let newLng     = obj.lng + dist * Math.sin(headRad) / Math.cos((obj.lat * Math.PI) / 180)
      let newHeading = obj.heading

      if (newLat < SIM_BOUNDS.minLat || newLat > SIM_BOUNDS.maxLat) {
        newHeading = (360 - newHeading) % 360
        newLat = Math.max(SIM_BOUNDS.minLat, Math.min(SIM_BOUNDS.maxLat, newLat))
      }
      if (newLng < SIM_BOUNDS.minLng || newLng > SIM_BOUNDS.maxLng) {
        newHeading = (180 - newHeading + 360) % 360
        newLng = Math.max(SIM_BOUNDS.minLng, Math.min(SIM_BOUNDS.maxLng, newLng))
      }

      return { ...obj, lat: newLat, lng: newLng, heading: newHeading }
    })
  }

  function startSim() {
    if (simIntervalRef.current) return
    simIntervalRef.current = setInterval(() => {
      setObjects(prev => tickSimulation(prev))
    }, SIM_TICK_MS)
    setSimRunning(true)
  }

  function stopSim() {
    clearInterval(simIntervalRef.current)
    simIntervalRef.current = null
    setSimRunning(false)
  }

  // Clean up interval on unmount
  useEffect(() => () => clearInterval(simIntervalRef.current), [])

  const handleDecrypt = useCallback(async (obj) => {
    setDecryptState('loading')
    const fqns = objFqns(obj)
    try {
      const tdfBytes = Uint8Array.from(atob(obj.tdfB64), c => c.charCodeAt(0))
      const plaintext = await decryptTdf(tdfBytes, activePersona.id)
      setSelectedObj(prev => ({ ...prev, _decrypted: plaintext }))
      setDecryptState('granted')
      logEvent({
        type: 'decrypt', persona: activePersona,
        document: obj.title, result: 'granted',
        reason: 'KAS entitlement check passed',
      })
    } catch (err) {
      const isDenied = err.message?.includes('403') || err.message?.includes('forbidden') || err.message?.includes('Forbidden')
      setDecryptState('denied')
      logEvent({
        type: 'decrypt-denied', persona: activePersona,
        document: obj.title, result: 'denied',
        reason: isDenied
          ? `KAS 403 — Missing: ${missingFqns(fqns, activePersona).join(', ')}`
          : `Decrypt error: ${err.message}`,
      })
    }
  }, [activePersona, logEvent])

  const handleCreated = useCallback((obj) => {
    setObjects(prev => {
      const next = [...prev, obj]
      saveObjects(next)
      return next
    })
    setShowCreate(false)
    logEvent({
      type: 'encrypt', persona: activePersona,
      document: obj.title, result: 'granted',
      reason: `Encrypted: ${obj.banner}`,
    })
  }, [activePersona, logEvent])

  // Filtered sidebar list
  const filteredObjects = objects.filter(o => {
    if (filterType !== 'all' && o.srcTypeId !== filterType) return false
    if (filterCls !== 'all' && o.classification !== filterCls) return false
    return true
  })

  const accessibleCount = objects.filter(o => canAccessFqns(objFqns(o), activePersona)).length

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)', overflow: 'hidden' }}>

      {/* ── Classification banner ─────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)', textAlign: 'center',
        fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-4)', padding: '5px 0', zIndex: 1000,
      }}>
        Classification guide: content varies by viewer entitlements
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left Sidebar ──────────────────────────────────────────────── */}
        <div style={{
          width: 260, flexShrink: 0,
          background: 'var(--c-surface)', borderRight: '1px solid var(--c-border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Persona / stats strip */}
          <div style={{ padding: '14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginBottom: 2 }}>{activePersona.name}</div>
            <div className="num" style={{ fontSize: 14, fontWeight: 650, color: 'var(--c-text-1)' }}>
              {seeding ? 'Seeding…' : `${accessibleCount} / ${objects.length} objects accessible`}
            </div>
            {(() => {
              const displayAttrs = activePersona.attributes.filter(a => !a.startsWith('relto:'))
              if (displayAttrs.length === 0) return null
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {displayAttrs.slice(0, 4).map(a => (
                    <span key={a} className="chip chip-mono" style={{ height: 20, fontSize: 10.5 }}>{a}</span>
                  ))}
                  {displayAttrs.length > 4 && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-5)', alignSelf: 'center' }}>+{displayAttrs.length - 4}</span>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Simulation controls */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={simRunning ? stopSim : startSim}
              disabled={objects.length === 0}
              style={{
                flex: 1,
                ...(simRunning ? { background: 'var(--c-grant-bg)', borderColor: 'var(--c-grant-br)', color: 'var(--c-grant)' } : null),
              }}>
              {simRunning ? 'Pause' : 'Simulate'}
            </button>
            {simRunning && (
              <span className="chip chip-grant" style={{ flexShrink: 0 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-grant)' }} />
                Live
              </span>
            )}
          </div>

          {/* Filters */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--c-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={sidebarSelectStyle}>
              <option value="all">All types</option>
              {SOURCE_TYPES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
            <select value={filterCls} onChange={e => setFilterCls(e.target.value)} style={sidebarSelectStyle}>
              <option value="all">All classifications</option>
              {CLASSIFICATIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {/* Object list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {seeding ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--c-text-5)' }}>
                Encrypting seed objects via KAS…
              </div>
            ) : filteredObjects.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 12.5, color: 'var(--c-text-5)' }}>
                No objects match filters.
              </div>
            ) : filteredObjects.filter(o => canAccessFqns(objFqns(o), activePersona)).map(obj => {
              const cls = getClassification(obj.classification)
              const st  = getSourceType(obj.srcTypeId)
              const isSelected = selectedObj?.id === obj.id
              return (
                <button key={obj.id} onClick={() => { const snap = { ...obj }; setSelectedObj(snap); setDecryptState(null); handleDecrypt(snap) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px',
                    background: isSelected ? 'var(--c-info-bg)' : 'transparent',
                    border: 'none', borderLeft: `3px solid ${isSelected ? cls.color : 'transparent'}`,
                    cursor: 'pointer', display: 'block',
                    borderBottom: '1px solid var(--c-border)',
                  }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {obj.title}
                    </div>
                    <div style={{ fontSize: 11.5, marginTop: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cls.color, flexShrink: 0 }} />
                      <span style={{ color: 'var(--c-text-3)', fontWeight: 600 }}>{st.label}</span>
                      <span style={{ color: cls.stroke, fontWeight: 700 }}>{cls.label}</span>
                      {(obj.needToKnow?.length > 0 || obj.relTo?.length > 0) && (
                        <span style={{ color: 'var(--c-text-5)' }}>
                          {[...(obj.needToKnow ?? []), ...(obj.relTo ?? [])].join('/')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Create button */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--c-border)', flexShrink: 0 }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!platformReady}
              style={{ width: '100%' }}>
              {platformReady ? 'Create object' : 'Platform starting…'}
            </button>
          </div>
        </div>

        {/* ── Map area ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* Legend toggle */}
          <button type="button" className="btn btn-sm" onClick={() => setLegend(l => !l)}
            style={{
              position: 'absolute', bottom: 12, right: selectedObj ? 332 : 12, zIndex: 900,
              boxShadow: 'var(--c-shadow-md)', transition: 'right 0.2s',
            }}>
            {legend ? 'Hide legend' : 'Show legend'}
          </button>

          {/* Legend panel */}
          {legend && (
            <div className="card" style={{
              position: 'absolute', bottom: 50, right: selectedObj ? 332 : 12, zIndex: 900,
              padding: '12px 14px', width: 200,
              boxShadow: 'var(--c-shadow-md)', transition: 'right 0.2s',
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--c-text-1)', marginBottom: 8 }}>Classification</div>
              {CLASSIFICATIONS.map(c => {
                const hasAny = objects.filter(o => o.classification === c.id).some(o => canAccessFqns(objFqns(o), activePersona))
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, opacity: hasAny ? 1 : 0.35 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: hasAny ? c.stroke : 'var(--c-text-5)' }}>{c.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Detail panel */}
          {selectedObj && (
            <DetailPanel
              obj={selectedObj}
              liveObj={objects.find(o => o.id === selectedObj.id) ?? selectedObj}
              activePersona={activePersona}
              onClose={() => { setSelectedObj(null); setDecryptState(null) }}
              onDecrypt={handleDecrypt}
              decryptState={decryptState}
            />
          )}
        </div>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <CreateForm
          activePersona={activePersona}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}

const sidebarSelectStyle = {
  width: '100%', height: 32, padding: '0 8px', borderRadius: 'var(--c-radius-btn)',
  background: 'var(--c-surface)', border: '1px solid var(--c-border-2)',
  color: 'var(--c-text-2)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
