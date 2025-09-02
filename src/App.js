/* src/App.js */
import React, { useEffect, useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.js';
import Footer from './components/Footer.js';
import Landing from './pages/Landing.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import MedicalDashboard from './pages/MedicalDashboard.js';
import DeviceRiskChecker from './pages/DeviceRiskChecker.js';
import RiskAssessmentResult from './pages/RiskAssessmentResult.js';
import ManufacturerDashboard from './pages/ManufacturerDashboard.js';

export default function App({ backend }){
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    window.toast = window.ReactToastify?.toast;
  }, []);

  function logout(){
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
    setUser(null);
    window.location.hash = '#/login';
  }

  const value = useMemo(() => ({ user, setUser }), [user]);

  function ProtectedRoute({ element, roles }){
    const u = user;
    if (!u) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(u.role)) return <Navigate to="/" replace />;
    return element;
  }

  return (
    <HashRouter>
      <Header onLogout={user ? logout : undefined} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login backend={backend} onLogin={(data)=>{
          const u = JSON.parse(localStorage.getItem('user')||'null');
          setUser(u);
          window.location.hash = u?.role === 'manufacturer' ? '#/manufacturer-dashboard' : '#/medical-dashboard';
        }} />} />
        <Route path="/register" element={<Register backend={backend} />} />
        <Route path="/medical-dashboard" element={<ProtectedRoute roles={['user','manufacturer']} element={<MedicalDashboard backend={backend} user={user} />} />} />
        <Route path="/device-risk-checker" element={<ProtectedRoute roles={['user']} element={<DeviceRiskChecker backend={backend} />} />} />
        <Route path="/risk-result" element={<ProtectedRoute roles={['user','manufacturer']} element={<RiskAssessmentResult />} />} />
        <Route path="/manufacturer-dashboard" element={<ProtectedRoute roles={['manufacturer']} element={<ManufacturerDashboard backend={backend} user={user} />} />} />
      </Routes>
      <Footer />
    </HashRouter>
  );
}
