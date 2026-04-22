// ============================================================
// App.tsx — Root component with React Router configuration
//
// Route structure:
//   /                → Landing page
//   /login           → Parent login
//   /register        → Parent registration
//   /dashboard       → Parent dashboard (protected)
//   /settings/:id    → Child restriction settings (protected)
//   /kids            → Kids profile selector (protected)
//   /kids/:id        → Kids personalised home page (protected)
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';

// Eagerly-loaded core pages (small)
import LandingPage    from './pages/LandingPage';
import LoginPage      from './pages/auth/LoginPage';
import RegisterPage   from './pages/auth/RegisterPage';

// Lazily-loaded larger pages (code-split for performance)
const ParentDashboard = lazy(() => import('./pages/parent/ParentDashboard'));
const ChildSettings   = lazy(() => import('./pages/parent/ChildSettings'));
const KidsHome        = lazy(() => import('./pages/kids/KidsHome'));
const ProfileSelect   = lazy(() => import('./pages/kids/ProfileSelect'));

// ── Route guards ───────────────────────────────────────────

/** Redirects to /login if the parent is not authenticated */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { parent, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading KidsSafe…</p>
      </div>
    );
  }

  return parent ? children : <Navigate to="/login" replace />;
}

// ── Lazy fallback ──────────────────────────────────────────
function PageLoader() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  );
}

// ── Router ─────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected parent routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute><ParentDashboard /></ProtectedRoute>
        } />
        <Route path="/settings/:childId" element={
          <ProtectedRoute><ChildSettings /></ProtectedRoute>
        } />

        {/* Protected kids routes */}
        <Route path="/kids" element={
          <ProtectedRoute><ProfileSelect /></ProtectedRoute>
        } />
        <Route path="/kids/:childId" element={
          <ProtectedRoute><KidsHome /></ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

// ── Root app ───────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
