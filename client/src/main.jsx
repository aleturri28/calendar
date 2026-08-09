import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api.js';
import { Login } from './pages/Login.jsx';
import { Month } from './pages/Month.jsx';
import { Day } from './pages/Day.jsx';
import { Timeline } from './pages/Timeline.jsx';
import { Summary } from './pages/Summary.jsx';
import './styles.css';

function App() {
  const [user, setUser] = useState(undefined); // undefined = ancora da verificare

  useEffect(() => {
    api.get('/api/auth/me').then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <p className="loading">…</p>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <Routes>
      <Route path="/" element={<Month user={user} />} />
      <Route path="/day/:date" element={<Day user={user} />} />
      <Route path="/timeline" element={<Timeline />} />
      <Route path="/riepilogo/:month" element={<Summary />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
