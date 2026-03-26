import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { ToastProvider } from './hooks/useToast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LinksPage from './pages/LinksPage';
import QRCodesPage from './pages/QRCodesPage';
import TemplatesPage from './pages/TemplatesPage';
import ParametersPage from './pages/ParametersPage';
import AttributesPage from './pages/AttributesPage';
import LinkShortenersPage from './pages/LinkShortenersPage';
import RulesPage from './pages/RulesPage';
import MembersPage from './pages/MembersPage';

const SIDEBAR_COLLAPSED_KEY = 'utm-sidebar-collapsed';
const SIDEBAR_PINNED_KEY = 'utm-sidebar-pinned';

function readStored(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStored(SIDEBAR_COLLAPSED_KEY, false));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pinned, setPinned] = useState(() => readStored(SIDEBAR_PINNED_KEY, false));

  useEffect(() => {
    writeStored(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed);
  }, [sidebarCollapsed]);
  useEffect(() => {
    writeStored(SIDEBAR_PINNED_KEY, pinned);
  }, [pinned]);

  const handleCloseDrawer = () => {
    if (!pinned) setSidebarOpen(false);
  };

  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <ToastProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Backdrop: mobile only when drawer is open */}
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setSidebarOpen(false)}
              className={`fixed inset-0 z-30 bg-black/20 transition-opacity md:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            />

            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              pinned={pinned}
              onPinToggle={() => setPinned(!pinned)}
              onNavigate={handleCloseDrawer}
            />

            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <Header onMenuClick={() => setSidebarOpen(true)} />
              <main className="flex-1 overflow-y-auto p-6">
                <Routes>
                  <Route path="/" element={<LinksPage />} />
                  <Route path="/qr-codes" element={<QRCodesPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/parameters" element={<ParametersPage />} />
                  <Route path="/attributes" element={<AttributesPage />} />
                  <Route path="/link-shorteners" element={<LinkShortenersPage />} />
                  <Route path="/rules" element={<RulesPage />} />
                  <Route path="/members" element={<MembersPage />} />
                </Routes>
              </main>
            </div>
          </div>
        </ToastProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
