// ============================================================
// pages/auth/RegisterPage.tsx — Parent registration form
// Calls authService.register() and redirects to /dashboard.
// ============================================================

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/layout/Navbar';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation before hitting the API
    if (name.trim().length < 2) {
      return setError('Please enter your full name.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (password !== confirm) {
      return setError('Passwords do not match.');
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Live password-match indicator
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

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

          <h1>Create your account</h1>
          <p className="auth-subtitle">Start protecting your children online today</p>

          {/* Error alert */}
          {error && <div className="alert alert-error">⚠️ {error}</div>}

          {/* Registration form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Your name</label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="e.g. Sarah Johnson"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

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
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                className="form-input"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={{
                  borderColor: passwordsMatch
                    ? 'var(--success)'
                    : passwordsMismatch
                    ? 'var(--danger)'
                    : undefined,
                }}
              />
              {passwordsMatch    && <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 700 }}>✓ Passwords match</span>}
              {passwordsMismatch && <span style={{ fontSize: '0.78rem', color: 'var(--danger)',  fontWeight: 700 }}>✗ Passwords do not match</span>}
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
                  Creating account…
                </>
              ) : 'Create parent account 🎉'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
