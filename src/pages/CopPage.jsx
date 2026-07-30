import { useEffect, useRef, useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import 'leaflet/dist/leaflet.css'

// ── Map data ──────────────────────────────────────────────────────────────────

// CENTCOM AOR center (~Persian Gulf / Arabian Peninsula)
const MAP_CENTER = [24, 45]
const MAP_ZOOM   = 5

// Classification colors
const C = {
  unclass: { fill: '#3b82f6', stroke: '#1d4ed8', label: 'UNCLASSIFIED',        bg: '#dbeafe', text: '#1e40af' },
  secret:  { fill: '#f59e0b', stroke: '#b45309', label: 'SECRET',              bg: '#fef3c7', text: '#92400e' },
  tssci:   { fill: '#ef4444', stroke: '#b91c1c', label: 'TOP SECRET // SCI',   bg: '#fee2e2', text: '#991b1b' },
  fvey:    { fill: '#8b5cf6', stroke: '#6d28d9', label: 'SECRET // REL FVEY',  bg: '#ede9fe', text: '#5b21b6' },
  nato:    { fill: '#10b981', stroke: '#047857', label: 'SECRET // REL NATO',  bg: '#d1fae5', text: '#065f46' },
}

// Layer definitions — each feature says what attrs are required to see it
const FEATURES = [
  // ── UNCLASSIFIED — everyone ─────────────────────────────────────────────────
  { id: 'uscentcom',   type: 'marker', lat: 25.28, lng: 51.53, label: 'USCENTCOM HQ',         sublabel: 'Doha, Qatar',          tier: 'unclass', required: [] },
  { id: 'camp-arifjan',type: 'marker', lat: 29.37, lng: 47.93, label: 'Camp Arifjan',          sublabel: 'Kuwait',               tier: 'unclass', required: [] },
  { id: 'al-dhafra',  type: 'marker', lat: 24.25, lng: 54.55, label: 'Al Dhafra AB',          sublabel: 'UAE',                  tier: 'unclass', required: [] },
  { id: 'al-udeid',   type: 'marker', lat: 25.12, lng: 51.32, label: 'Al Udeid AB',           sublabel: 'Qatar (Combined AOC)', tier: 'unclass', required: [] },
  { id: 'bahrain-nsa', type: 'marker', lat: 26.22, lng: 50.61, label: 'NSA Bahrain',           sublabel: '5th Fleet HQ',         tier: 'unclass', required: [] },
  { id: 'diego-garcia',type: 'marker', lat: -7.32, lng: 72.42, label: 'Diego Garcia',          sublabel: 'BIOT / Strategic Hub', tier: 'unclass', required: [] },

  // ── SECRET — clearance:secret or higher ────────────────────────────────────
  { id: 'opzone-iran', type: 'polygon',
    positions: [[26.5,55],[28,58],[27,61],[24,60],[23,57],[24,54]],
    label: 'Operational Zone ECHO', sublabel: 'Heightened ISR posture',
    tier: 'secret', required: ['clearance:secret'] },
  { id: 'threat-hamas',type: 'polygon',
    positions: [[31.5,34],[32,35.5],[31.3,35.5],[30.8,34.2]],
    label: 'Threat Zone KILO',      sublabel: 'Rocket threat corridor',
    tier: 'secret', required: ['clearance:secret'] },
  { id: 'sof-djibouti',type: 'marker', lat: 11.55, lng: 43.15, label: 'Camp Lemonnier',  sublabel: 'SOF / CT Hub — SECRET',  tier: 'secret', required: ['clearance:secret'] },
  { id: 'isrtrack-001',type: 'marker', lat: 30.2,  lng: 47.8,  label: 'ISR Track 001',  sublabel: 'CENTCOM AOR — SECRET',   tier: 'secret', required: ['clearance:secret'] },

  // ── TS/SCI — clearance:ts-sci only ─────────────────────────────────────────
  { id: 'sigint-node1', type: 'marker', lat: 33.3,  lng: 44.4,  label: 'SIGINT Node Alpha',   sublabel: 'Intercept — TS/SCI',     tier: 'tssci', required: ['clearance:ts-sci'] },
  { id: 'sigint-node2', type: 'marker', lat: 35.7,  lng: 51.4,  label: 'SIGINT Node Bravo',   sublabel: 'Collection — TS/SCI',    tier: 'tssci', required: ['clearance:ts-sci'] },
  { id: 'humint-src1',  type: 'marker', lat: 23.6,  lng: 58.5,  label: 'HUMINT Source KILO',  sublabel: 'Covert asset — TS/SCI',  tier: 'tssci', required: ['clearance:ts-sci'] },
  { id: 'covert-zone',  type: 'polygon',
    positions: [[32,40],[35,43],[34,47],[31,46],[30,42]],
    label: 'Covert Ops Zone FOXTROT', sublabel: 'Active HUMINT — TS/SCI',
    tier: 'tssci', required: ['clearance:ts-sci'] },

  // ── FVEY — relto:fvey ──────────────────────────────────────────────────────
  { id: 'fvey-diego',  type: 'marker', lat: -7.4,  lng: 72.4,  label: 'FVEY SIGINT Station', sublabel: 'Diego Garcia — REL FVEY', tier: 'fvey', required: ['clearance:secret', 'relto:fvey'] },
  { id: 'fvey-bahrain',type: 'marker', lat: 26.1,  lng: 50.5,  label: 'FVEY Intel Cell',     sublabel: 'Bahrain — REL FVEY',      tier: 'fvey', required: ['clearance:secret', 'relto:fvey'] },
  { id: 'fvey-polygon',type: 'polygon',
    positions: [[-8,71],[-8,74],[-6,74],[-6,71]],
    label: 'FVEY Collection Zone', sublabel: 'Maritime SIGINT — REL FVEY',
    tier: 'fvey', required: ['clearance:secret', 'relto:fvey'] },

  // ── NATO — relto:nato ──────────────────────────────────────────────────────
  { id: 'nato-turkey',  type: 'marker', lat: 37.0,  lng: 35.2,  label: 'NATO Air Base Incirlik', sublabel: 'Turkey — REL NATO',    tier: 'nato', required: ['clearance:secret', 'relto:nato'] },
  { id: 'nato-jordan',  type: 'marker', lat: 29.6,  lng: 35.7,  label: 'NATO Liaison Cell',      sublabel: 'Jordan — REL NATO',    tier: 'nato', required: ['clearance:secret', 'relto:nato'] },
  { id: 'nato-zone',    type: 'polygon',
    positions: [[36,34],[39,36],[38,40],[35,39],[34,35]],
    label: 'NATO Joint Ops Zone', sublabel: 'Eastern Med — REL NATO',
    tier: 'nato', required: ['clearance:secret', 'relto:nato'] },
]

// Map from tier → the attribute check description shown in denied popup
const TIER_LABELS = {
  unclass: 'UNCLASSIFIED — All personnel',
  secret:  'SECRET — Requires clearance:secret',
  tssci:   'TOP SECRET/SCI — Requires clearance:ts-sci',
  fvey:    'SECRET // REL TO FVEY — Requires clearance:secret + relto:fvey',
  nato:    'SECRET // REL TO NATO — Requires clearance:secret + relto:nato',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function expandClearance(attrs) {
  const s = new Set(attrs)
  if (s.has('clearance:ts-sci')) { s.add('clearance:secret'); s.add('clearance:unclassified') }
  if (s.has('clearance:secret'))   s.add('clearance:unclassified')
  return s
}

function canAccess(feature, persona) {
  const attrs = expandClearance(persona.attributes)
  return feature.required.every(r => attrs.has(r))
}

function missingAttrs(feature, persona) {
  const attrs = expandClearance(persona.attributes)
  return feature.required.filter(r => !attrs.has(r))
}

// Tier → Leaflet divIcon HTML
function makeIcon(tier, dimmed = false) {
  const col = C[tier]
  const opacity = dimmed ? 0.35 : 1
  const svg = tier === 'tssci'
    ? `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <polygon points="11,2 21,19 1,19" fill="${col.fill}" stroke="${col.stroke}" stroke-width="2" opacity="${opacity}"/>
       </svg>`
    : `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="8" fill="${col.fill}" stroke="${col.stroke}" stroke-width="2" opacity="${opacity}"/>
       </svg>`
  return { html: svg, className: '', iconSize: [22, 22], iconAnchor: [11, 11] }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CopPage() {
  const { activePersona, logEvent } = useDemo()
  const mapContainerRef = useRef(null)  // DOM node for Leaflet
  const mapInstanceRef  = useRef(null)  // Leaflet map instance
  const leafletRef      = useRef(null)  // L library
  const layersRef       = useRef({})    // featureId → Leaflet layer
  const [popup, setPopup]         = useState(null)
  const [legend, setLegend]       = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  // ── Init map (once) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      import('leaflet').then(({ default: L }) => {
        leafletRef.current = L

        const map = L.map(mapContainerRef.current, {
          center: MAP_CENTER,
          zoom: MAP_ZOOM,
          zoomControl: true,
          attributionControl: false,
        })

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 19,
        }).addTo(map)

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

  // ── Re-render layers whenever persona or map readiness changes ─────────────
  useEffect(() => {
    if (!mapLoaded || !leafletRef.current || !mapInstanceRef.current) return
    const L   = leafletRef.current
    const map = mapInstanceRef.current

    // Remove all existing layers
    Object.values(layersRef.current).forEach(l => map.removeLayer(l))
    layersRef.current = {}

    FEATURES.forEach(feature => {
      const granted = canAccess(feature, activePersona)

      let layer
      if (feature.type === 'marker') {
        const icon = L.divIcon(makeIcon(feature.tier, !granted))
        layer = L.marker([feature.lat, feature.lng], { icon })
      } else {
        // polygon
        const col   = C[feature.tier]
        const alpha = granted ? 0.25 : 0.08
        layer = L.polygon(feature.positions, {
          color:       granted ? col.stroke : '#555',
          fillColor:   granted ? col.fill   : '#444',
          fillOpacity: alpha,
          weight:      granted ? 2 : 1,
          dashArray:   granted ? null : '6 4',
        })
      }

      layer.on('click', (e) => {
        const rect = mapContainerRef.current.getBoundingClientRect()
        const x    = e.originalEvent.clientX - rect.left
        const y    = e.originalEvent.clientY - rect.top
        setPopup({ feature, granted, x, y })
        logEvent({
          type:     granted ? 'decrypt' : 'decrypt-denied',
          persona:  activePersona,
          document: feature.label,
          result:   granted ? 'granted' : 'denied',
          reason:   granted ? 'Entitlements satisfied' : `Missing: ${missingAttrs(feature, activePersona).join(', ')}`,
        })
      })

      layer.addTo(map)
      layersRef.current[feature.id] = layer
    })
  }, [mapLoaded, activePersona, logEvent])

  // Close popup on outside click
  useEffect(() => {
    const handler = () => setPopup(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const visibleCount = FEATURES.filter(f => canAccess(f, activePersona)).length
  const totalCount   = FEATURES.length

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0d1117', overflow: 'hidden' }}>

      {/* ── Classification banner ─────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: '#7f1d1d',
        textAlign: 'center',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
        color: '#fca5a5',
        padding: '4px 0',
        zIndex: 1000,
      }}>
        CLASSIFICATION GUIDE — CONTENT VARIES BY VIEWER ENTITLEMENTS
      </div>

      {/* ── Map container ─────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
          onClick={e => e.stopPropagation()}
        />

      {/* ── Access summary chip ───────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 900,
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, padding: '6px 12px',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
          {activePersona.name}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
          {visibleCount} / {totalCount} features visible
        </div>
        {activePersona.attributes.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {activePersona.attributes.map(a => (
              <span key={a} style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 3,
                background: activePersona.color + '22',
                color: activePersona.color,
                border: `1px solid ${activePersona.color}40`,
              }}>{a}</span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 2 }}>No entitlements</div>
        )}
      </div>

      {/* ── Legend toggle ─────────────────────────────────────────────────── */}
      <button
        onClick={e => { e.stopPropagation(); setLegend(l => !l) }}
        style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 900,
          background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
          color: '#fff', fontSize: 11,
          backdropFilter: 'blur(4px)',
        }}
      >
        {legend ? 'Hide Legend' : 'Show Legend'}
      </button>

      {/* ── Legend panel ──────────────────────────────────────────────────── */}
      {legend && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', bottom: 40, right: 12, zIndex: 900,
            background: 'rgba(10,16,30,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, padding: '12px 14px', width: 230,
            backdropFilter: 'blur(6px)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', marginBottom: 8 }}>
            CLASSIFICATION LEGEND
          </div>
          {Object.entries(C).map(([key, col]) => {
            const hasAccess = FEATURES.filter(f => f.tier === key).some(f => canAccess(f, activePersona))
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, opacity: hasAccess ? 1 : 0.4 }}>
                <div style={{ width: 12, height: 12, borderRadius: key === 'tssci' ? 2 : '50%', background: col.fill, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: hasAccess ? col.fill : '#666' }}>{col.label}</span>
                {!hasAccess && <span style={{ fontSize: 10, color: '#f87171', marginLeft: 'auto' }}>DENIED</span>}
              </div>
            )
          })}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            Switch persona in the topbar to change view.
          </div>
        </div>
      )}

      {/* ── Feature popup ─────────────────────────────────────────────────── */}
      {popup && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: Math.min(popup.x + 12, (mapContainerRef.current?.offsetWidth ?? 800) - 280),
            top:  Math.max(popup.y - 20, 36),
            zIndex: 1001,
            width: 260,
            background: popup.granted ? 'rgba(10,20,40,0.96)' : 'rgba(30,5,5,0.96)',
            border: `1px solid ${popup.granted ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.4)'}`,
            borderRadius: 10,
            boxShadow: popup.granted
              ? '0 8px 32px rgba(0,0,0,0.6)'
              : '0 8px 32px rgba(239,68,68,0.2)',
            padding: '12px 14px',
            animation: 'step-in 0.15s ease',
          }}
        >
          {/* Classification strip */}
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
            color: C[popup.feature.tier].fill,
            marginBottom: 6,
          }}>
            {TIER_LABELS[popup.feature.tier]}
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
            {popup.feature.label}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
            {popup.feature.sublabel}
          </div>

          {popup.granted ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 10px', borderRadius: 6,
              background: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
            }}>
              <span style={{ fontSize: 15 }}>✓</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>ACCESS GRANTED</div>
                <div style={{ fontSize: 11, color: 'rgba(74,222,128,0.7)' }}>Entitlements satisfied</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px', borderRadius: 6,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 15 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>ACCESS DENIED</div>
                  <div style={{ fontSize: 11, color: 'rgba(248,113,113,0.7)' }}>KAS — 403 Forbidden</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Missing attributes:</div>
              {missingAttrs(popup.feature, activePersona).map(a => (
                <span key={a} style={{
                  display: 'inline-block', marginRight: 4, marginBottom: 4,
                  fontSize: 11, padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(239,68,68,0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}>{a}</span>
              ))}
            </div>
          )}

          <button
            onClick={() => setPopup(null)}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1,
            }}
          >✕</button>
        </div>
      )}
      </div>{/* end relative map wrapper */}
    </div>
  )
}
