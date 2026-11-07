import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Curiosities from './pages/Curiosities.jsx';
import Support from './pages/Support.jsx';
import Nav from './components/Nav.jsx';
import { useSettings, useHeartbeat } from './hooks.js';
import { Empty } from './components/Ui.jsx';

function Section({ children, enabled }) {
  if (enabled === false) {
    return (
      <div className="screen">
        <header className="topbar"><h1>Seção desativada</h1></header>
        <Empty>Um administrador desativou esta seção nas configurações do app.</Empty>
      </div>
    );
  }
  return children;
}

export default function App() {
  const settings = useSettings();
  const sections = (settings && settings.sections) || {};
  useHeartbeat();
  const location = useLocation();
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setFade(false);
    const t = setTimeout(() => setFade(true), 10);
    return () => clearTimeout(t);
  }, [location.pathname]);

  if (!settings) {
    return (
      <div className="phone">
        <div className="loader">
          <div className="spinner" />
          <span>Iniciando o Open History…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="phone">
      <div key={location.pathname} className={fade ? 'fade-in' : ''}>
        <Routes>
          <Route path="/" element={<Home settings={settings} />} />
          <Route path="/buscar" element={<Section enabled={sections.search}><Search /></Section>} />
          <Route path="/curiosidades" element={<Section enabled={sections.curiosities}><Curiosities /></Section>} />
          <Route path="/apoiar" element={<Section enabled={sections.support}><Support /></Section>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Nav sections={sections} />
    </div>
  );
}
