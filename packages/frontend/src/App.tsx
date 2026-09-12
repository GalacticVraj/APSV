import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useNotificationStore } from './stores/notificationStore';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import OnboardingPage from './pages/auth/OnboardingPage';
import GeneratorDashboard from './pages/dashboard/GeneratorDashboard';
import FacilityDashboard from './pages/dashboard/FacilityDashboard';
import LogisticsDashboard from './pages/dashboard/LogisticsDashboard';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import MapPage from './pages/MapPage';
import ReportsPage from './pages/ReportsPage';
import EconomicsPage from './pages/EconomicsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleDashboard() {
  const { user } = useAuthStore();
  switch (user?.role) {
    case 'generator': return <GeneratorDashboard />;
    case 'facility_operator': return <FacilityDashboard />;
    case 'logistics_partner': return <LogisticsDashboard />;
    case 'platform_admin':
    case 'municipal_admin': return <AdminDashboard />;
    default: return <Navigate to="/login" replace />;
  }
}

function AppContent() {
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const { connectSocket, disconnectSocket } = useNotificationStore();

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => {
      // Cleanup on unmount
    };
  }, [isAuthenticated, accessToken]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><RoleDashboard /></RequireAuth>} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
        <Route path="/economics" element={<RequireAuth><EconomicsPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'font-sans text-sm',
          style: {
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          },
          success: {
            iconTheme: { primary: '#166534', secondary: '#fff' },
          },
        }}
      />
    </BrowserRouter>
  );
}

export default AppContent;
