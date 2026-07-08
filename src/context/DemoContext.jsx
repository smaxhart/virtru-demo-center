import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { listAttributes, setApiLogger } from '../api/platform.js'
import { FEDERAL_PERSONAS, makeSeedEvents } from '../data/sectors.js'

const DemoContext = createContext(null)

export function DemoProvider({ children }) {
  const sector   = 'federal'
  const personas = FEDERAL_PERSONAS

  const [activePersona,    setActivePersona]    = useState(() => personas.find(p => p.id === 'generic') ?? personas[0])
  const [attributes,       setAttributes]       = useState([])
  const [apiLog,           setApiLog]           = useState([])
  const [eventLog,         setEventLog]         = useState(() => makeSeedEvents('federal'))
  const [techMode,         setTechMode]         = useState(false)
  const [presentationMode, setPresentationMode] = useState(true)
  const [platformReady,    setPlatformReady]    = useState(null)

  const theme     = 'light'
  const setSector = useCallback(() => {}, [])
  const toggleTheme = useCallback(() => {}, [])

  const logEvent = useCallback(({ type, persona, document, result, reason }) => {
    setEventLog(prev => [{
      id: Date.now(),
      ts: new Date().toISOString(),
      type, persona, document, result, reason,
    }, ...prev])
  }, [])

  const logCall = useCallback((call) => {
    setApiLog(prev => [{ ...call, ts: Date.now(), id: Math.random() }, ...prev].slice(0, 50))
  }, [])

  useEffect(() => { setApiLogger(logCall) }, [logCall])

  useEffect(() => {
    if (window.electronAPI?.onPlatformStatus) {
      const unsub = window.electronAPI.onPlatformStatus(status => {
        if (status === 'ready') {
          setPlatformReady(true)
          listAttributes().then(setAttributes).catch(() => {})
        } else if (status === 'error') {
          setPlatformReady(false)
        }
      })
      window.electronAPI.getPlatformStatus?.().then(status => {
        if (status === 'ready') {
          setPlatformReady(true)
          listAttributes().then(setAttributes).catch(() => {})
        } else if (status === 'error') {
          setPlatformReady(false)
        }
      })
      return unsub
    } else {
      listAttributes()
        .then(attrs => { setAttributes(attrs); setPlatformReady(true) })
        .catch(() => setPlatformReady(false))
    }
  }, [])

  return (
    <DemoContext.Provider value={{
      sector, setSector,
      activePersona, setActivePersona,
      personas,
      keycloakUsers: [],
      attributes,
      apiLog, logCall,
      eventLog, logEvent,
      techMode, setTechMode,
      theme, toggleTheme,
      platformReady,
      presentationMode, setPresentationMode,
    }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used within DemoProvider')
  return ctx
}
