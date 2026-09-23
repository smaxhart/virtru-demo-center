import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DemoProvider } from './context/DemoContext.jsx'
import Layout from './components/Layout.jsx'
import ArchitecturePage from './pages/ArchitecturePage.jsx'
import CollaboratePage from './pages/CollaboratePage.jsx'
import CopPage from './pages/CopPage.jsx'
import SecureAiApp from './secure-ai/App.jsx'
import PlatformPage from './pages/PlatformPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import TdfExplorerPage from './pages/TdfExplorerPage.jsx'
import HomePage from './pages/HomePage.jsx'

export default function App() {
  return (
    <DemoProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="/cop"          element={<CopPage />} />
            <Route path="/collaborate"  element={<CollaboratePage />} />
            {/* AI Protection is a whole app rather than a page — five scenarios, a corpus, a
                scenario builder — so it gets a splat and routes the rest itself. The path stays
                `/ai-agent` because that string is the key saved page-visibility preferences are
                stored under, and the target of any link already shared. */}
            <Route path="/ai-agent/*"   element={<SecureAiApp />} />
            <Route path="/platform"     element={<PlatformPage />} />
            <Route path="/audit"        element={<AuditPage />} />
            <Route path="/tdf-explorer" element={<TdfExplorerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </DemoProvider>
  )
}
