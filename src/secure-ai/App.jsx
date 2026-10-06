import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { AI_ROOT } from './routes.js'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import CorpusPage from './pages/CorpusPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import HowItWorksPage from './pages/HowItWorksPage.jsx'
import ScenarioBuilderPage from './pages/ScenarioBuilderPage.jsx'
import './secure-ai.css'

/**
 * Syncs the `:modeId` route param into app state.
 *
 * The URL is the source of truth for which mode is active, so a reload or a back-navigation
 * lands somewhere coherent. An unknown id goes home rather than rendering an empty shell.
 *
 * The id is checked against `modes`, which now includes the user's own scenarios — and only once
 * those have been read from disk. Refreshing inside a scenario arrives here before that read
 * finishes, and judging the id early would send the user home for a mode that exists.
 */
function ModeGate() {
  const { modeId: param } = useParams()
  const { enterMode, modes, scenariosLoaded } = useApp()
  const known = modes.some(m => m.id === param)

  useEffect(() => { if (known) enterMode(param) }, [param, known, enterMode])

  if (!known) return scenariosLoaded ? <Navigate to={AI_ROOT} replace /> : null
  return <Layout />
}

/**
 * The AI Protection page — a whole app behind one nav entry.
 *
 * No router of its own. Demo Center's HashRouter matches `/ai-agent/*` and hands off here, so these
 * paths are relative to that: `""` is the mode launcher, `":modeId/chat"` is a conversation inside
 * one. `AppProvider` sits inside this component rather than at Demo Center's root on purpose —
 * mounting it globally would boot the corpus encryption for every seller who never opens this page.
 *
 * The `secure-ai` class scopes the few style rules this subtree needs that differ from Demo
 * Center's — see index.css. Scoped rather than global so no page that shipped before this one
 * changes appearance.
 */
export default function SecureAiApp() {
  return (
    <AppProvider>
      <div className="secure-ai" style={{ height: '100%' }}>
      <Routes>
        <Route index element={<HomePage />} />
        {/* Before the mode routes so "build" is never read as a mode id. */}
        <Route path="build" element={<ScenarioBuilderPage />} />
        <Route path="build/:scenarioId" element={<ScenarioBuilderPage />} />
        <Route path=":modeId" element={<ModeGate />}>
          <Route index element={<Navigate to="chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="corpus" element={<CorpusPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="how" element={<HowItWorksPage />} />
          <Route path="*" element={<Navigate to="chat" replace />} />
        </Route>
        <Route path="*" element={<Navigate to={AI_ROOT} replace />} />
      </Routes>
      </div>
    </AppProvider>
  )
}
