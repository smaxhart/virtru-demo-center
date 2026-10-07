import { useEffect, useRef, useState } from 'react'
import './sable.css'
import { bootSable, mountSable } from './app.js'

export default function SablePage() {
  const rootRef = useRef(null)
  const [aiReady, setAiReady] = useState(!window.electronAPI?.getAiStatus)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(null)

  // SABLE identities are written by the AI seeder; sealing before it finishes would deny every persona.
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.getAiStatus) return
    const handle = (s) => {
      if (s === 'ready') setAiReady(true)
      else if (s && s.state === 'error') setError(s.message)
    }
    const off = api.onAiStatus?.(handle)
    api.getAiStatus().then(handle).catch(() => {})
    return off
  }, [])

  useEffect(() => {
    if (!aiReady) return
    let live = true
    bootSable((p) => live && setProgress(p))
      .then(() => live && setReady(true))
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [aiReady])

  useEffect(() => {
    if (!ready || !rootRef.current) return
    return mountSable(rootRef.current)
  }, [ready])

  return (
    <div className="sable" ref={rootRef}>
      {!ready && (
        <div style={{ gridRow: '1 / -1', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 460, textAlign: 'center' }}>
            <div className="brand" style={{ fontSize: 18, marginBottom: 14 }}><span className="mark">&#9670;</span> SABLE <span className="dim">Mission Engineering</span></div>
            {error ? (
              <div style={{ color: 'var(--red)', fontSize: 13 }}>Could not prepare the demo: {error}</div>
            ) : (
              <>
                <div className="dim" style={{ fontSize: 12.5, marginBottom: 10 }}>
                  {!aiReady ? 'Waiting for the platform to finish seeding identities…' : progress ? `${progress.phase}${progress.label ? ` — ${progress.label}` : ''}` : 'Preparing…'}
                </div>
                <div style={{ height: 4, background: 'var(--line)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((progress?.frac ?? 0) * 100)}%`, height: '100%', background: 'var(--cyan)', transition: 'width .2s' }} />
                </div>
                <div className="faint mono" style={{ fontSize: 10.5, marginTop: 10 }}>Every file, database row and result is sealed as a real TDF under its policy.</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
