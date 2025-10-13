import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, ThemeProvider } from '@mui/material';
import theme from './styles/theme';
import './styles/global.css';

import { useAuth } from './contexts/AuthContext.jsx';
import LandingPage from './components/LandingPage.jsx';
import ModernLogin from './components/auth/ModernLogin.jsx';
import Register from './components/auth/Register.jsx';
import Dashboard from './components/dashboard/Dashboard.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import UserManagement from './components/admin/UserManagement.jsx';
import TenantManagement from './components/admin/TenantManagement.jsx';
import VersionManagement from './components/admin/VersionManagement.jsx';
import Settings from './components/Settings.jsx';
import TenantAdminPanel from './components/tenant/TenantAdminPanel.jsx';
import Profile from './components/profile/Profile.jsx';
import Layout from './components/layout/Layout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';

function App() {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Routes>
      {/* Landing page - always accessible */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Public routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'super_admin' ? '/app/admin' : user?.role === 'admin' ? '/app/tenant' : '/app/dashboard'} replace />
          ) : (
            <ModernLogin />
          )
        }
      />
      <Route
        path="/sattu/chaudhary/192"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'super_admin' ? '/app/admin' : user?.role === 'admin' ? '/app/tenant' : '/app/dashboard'} replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Protected routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* User dashboard */}
        <Route
          path="dashboard"
          element={
            user?.role === 'super_admin' ? (
              <Navigate to="/app/admin" replace />
            ) : user?.role === 'admin' ? (
              <Navigate to="/app/tenant" replace />
            ) : (
              <Dashboard />
            )
          }
        />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            user?.role === 'super_admin' ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/users"
          element={
            user?.role === 'super_admin' ? (
              <UserManagement />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/tenants"
          element={
            user?.role === 'super_admin' ? (
              <TenantManagement />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/version"
          element={
            user?.role === 'super_admin' ? (
              <VersionManagement />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="admin/settings"
          element={
            user?.role === 'super_admin' ? (
              <Settings />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />

        {/* Tenant routes */}
        <Route
          path="tenant"
          element={
            user?.role === 'admin' ? (
              <TenantAdminPanel />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />
        <Route
          path="tenant/*"
          element={
            user?.role === 'admin' ? (
              <TenantAdminPanel />
            ) : (
              <Navigate to="/app/dashboard" replace />
            )
          }
        />

        {/* Settings */}
        <Route path="settings" element={<Settings />} />

        {/* Profile */}
        <Route path="profile" element={<Profile />} />

        {/* Default redirect */}
        <Route
          index
          element={
            <Navigate
              to={user?.role === 'super_admin' ? '/app/admin' : user?.role === 'admin' ? '/app/tenant' : '/app/dashboard'}
              replace
            />
          }
        />
      </Route>

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ThemeProvider>
  );
}

export default App;
