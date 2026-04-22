// ============================================================
// pages/auth/LoginPage.tsx — Parent login form
// Calls authService.login() and redirects to /dashboard on success.
// ============================================================

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/layout/Navbar';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div className="auth-page">
        <div className="auth-card animate-slideUp">

          {/* Logo */}
          <div className="auth-logo">
            <span className="shield">🛡️</span>
            <span>KidsSafe</span>
          </div>

          <h1>Welcome back</h1>
          <p className="auth-subtitle">Sign in to your parent account</p>

          {/* Error alert */}
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          {/* Login form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-sm spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />
                  Signing in…
                </>
              ) : 'Sign in as Parent'}
            </button>
          </form>

          {/* Footer links */}
          <div className="auth-footer">
            Don't have an account?{' '}
            <Link to="/register">Create one free</Link>
          </div>

          {/* Demo hint */}
          <div className="alert alert-info" style={{ marginTop: '1rem', fontSize: '0.82rem' }}>
            💡 <strong>Demo mode:</strong> Register any email/password — no backend needed to test the app!
          </div>
        </div>
      </div>
    </div>
  );
}
