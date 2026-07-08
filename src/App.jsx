import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { DemoProvider } from './context/DemoContext.jsx'
import Layout from './components/Layout.jsx'
import ArchitecturePage from './pages/ArchitecturePage.jsx'
import PolicyPage from './pages/PolicyPage.jsx'
import KeyWrapPage from './pages/KeyWrapPage.jsx'
import RevocationPage from './pages/RevocationPage.jsx'
import PlatformPage from './pages/PlatformPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import TaggingPDPPage from './pages/TaggingPDPPage.jsx'
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
            <Route path="/policy" element={<PolicyPage />} />
            <Route path="/keywrap" element={<KeyWrapPage />} />
            <Route path="/revoke"   element={<RevocationPage />} />
            <Route path="/platform" element={<PlatformPage />} />
            <Route path="/audit"    element={<AuditPage />} />
            <Route path="/tagging"  element={<TaggingPDPPage />} />
            <Route path="/tdf-explorer" element={<TdfExplorerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </DemoProvider>
  )
}
