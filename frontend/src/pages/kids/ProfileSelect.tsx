// ============================================================
// pages/kids/ProfileSelect.tsx — Kids profile selector
//
// After a parent logs in they (or their child) lands here to
// pick which child profile to use. Optionally verifies a PIN
// if the parent set one.
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { childrenService } from '../../services/api';
import Navbar from '../../components/layout/Navbar';
import type { Child } from '../../types';

// Gradient backgrounds for profile buttons
const BG_GRADIENTS = [
  'linear-gradient(135deg, #FF6B6B, #FF8E53)',
  'linear-gradient(135deg, #6C63FF, #9B59B6)',
  'linear-gradient(135deg, #11998e, #38ef7d)',
  'linear-gradient(135deg, #f7971e, #FFD93D)',
  'linear-gradient(135deg, #E91E8C, #9B59B6)',
  'linear-gradient(135deg, #3498DB, #1ABC9C)',
];

export default function ProfileSelect() {
  const navigate = useNavigate();
  const { selectChild } = useAuth();

  const [children,    setChildren]    = useState<Child[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [pinTarget,   setPinTarget]   = useState<Child | null>(null);
  const [pinInput,    setPinInput]    = useState('');
  const [pinError,    setPinError]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await childrenService.getAll();
        setChildren(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function handleSelectProfile(child: Child) {
    // If a PIN is set, show the PIN entry screen
    if (child.pin) {
      setPinTarget(child);
      setPinInput('');
      setPinError('');
    } else {
      launchKidsView(child);
    }
  }

  function launchKidsView(child: Child) {
    selectChild(child);
    navigate(`/kids/${child.id}`);
  }

  function verifyPin() {
    if (!pinTarget) return;
    if (pinInput === pinTarget.pin) {
      launchKidsView(pinTarget);
    } else {
      setPinError('Wrong PIN. Please try again.');
      setPinInput('');
    }
  }

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="flex-center" style={{ minHeight: '80vh', background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="profile-select-page">

        {/* Decorative stars */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              className="star"
              style={{
                width:  `${Math.random() * 3 + 1}px`,
                height: `${Math.random() * 3 + 1}px`,
                top:    `${Math.random() * 100}%`,
                left:   `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${Math.random() * 2 + 1.5}s`,
              }}
            />
          ))}
        </div>

        <h1 style={{ position: 'relative', zIndex: 1 }}>👋 Who's watching?</h1>
        <p style={{ position: 'relative', zIndex: 1 }}>Choose your profile to get your personalised content</p>

        {children.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤔</div>
            <p style={{ marginBottom: '1rem' }}>No profiles set up yet.</p>
            <button
              className="btn btn-white"
              onClick={() => navigate('/dashboard')}
            >
              Go to Parent Dashboard
            </button>
          </div>
        ) : (
          <div className="profile-cards" style={{ position: 'relative', zIndex: 1 }}>
            {children.map((child, i) => (
              <button
                key={child.id}
                className="profile-btn"
                onClick={() => handleSelectProfile(child)}
                style={{ background: BG_GRADIENTS[i % BG_GRADIENTS.length], border: 'none' }}
              >
                <span className="profile-emoji">{child.avatar_emoji}</span>
                <span className="profile-name">{child.name}</span>
                <span className="profile-age">Age {child.age}</span>
                {child.pin && <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>🔒 PIN required</span>}
              </button>
            ))}
          </div>
        )}

        {/* Parent link */}
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            marginTop: '2.5rem',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.7)',
            padding: '0.5rem 1.25rem',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            fontWeight: 600,
            position: 'relative',
            zIndex: 1,
          }}
        >
          👨‍👩‍👧 Parent Dashboard
        </button>
      </div>

      {/* ── PIN Modal ────────────────────────────────────── */}
      {pinTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
              {pinTarget.avatar_emoji}
            </div>
            <h3 style={{ fontWeight: 900, marginBottom: '0.25rem' }}>Hi {pinTarget.name}!</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Enter your PIN to continue
            </p>

            {pinError && <div className="alert alert-error">{pinError}</div>}

            <input
              className="form-input"
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              maxLength={6}
              value={pinInput}
              onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && verifyPin()}
              autoFocus
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3em' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-ghost w-full" onClick={() => setPinTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-primary w-full" onClick={verifyPin}>
                Go! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
