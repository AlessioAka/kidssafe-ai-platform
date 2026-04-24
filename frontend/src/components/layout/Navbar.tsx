// ============================================================
// components/layout/Navbar.tsx — Top navigation bar
// Renders differently depending on context:
//   - Default (parent mode): white bar with brand + auth actions
//   - Kids mode: purple gradient bar with child's name
// ============================================================

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface NavbarProps {
  /** When true, renders the kid-friendly purple variant */
  kidsMode?: boolean;
  /** Child's name shown in kids mode */
  childName?: string;
  /** Emoji avatar for kids mode */
  childEmoji?: string;
}

export default function Navbar({ kidsMode = false, childName, childEmoji }: NavbarProps) {
  const { parent, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className={`navbar${kidsMode ? ' navbar-kids' : ''}`}>
      <div className="navbar-inner">

        {/* Brand / Logo */}
        <Link to={parent ? '/dashboard' : '/'} className="navbar-brand">
          <span className="brand-shield">🛡️</span>
          <span>KidsSafe</span>
        </Link>

        {/* Right-side actions */}
        <div className="navbar-actions">
          {kidsMode && childName ? (
            /* Kids mode: show child's avatar + name */
            <div className="navbar-user">
              <span style={{ fontSize: '1.4rem' }}>{childEmoji || '🦄'}</span>
              <span>{childName}</span>
            </div>
          ) : parent ? (
            /* Logged-in parent: show name + dashboard link + logout */
            <>
              <div className="navbar-user">
                <div className="navbar-avatar">
                  {parent.name.charAt(0).toUpperCase()}
                </div>
                <span className="hide-mobile">{parent.name}</span>
              </div>
              <Link to="/dashboard" className="btn btn-ghost btn-sm">
                Dashboard
              </Link>
              <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                Log out
              </button>
            </>
          ) : (
            /* Logged-out: show login + register */
            <>
              <Link to="/login"    className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up free</Link>
            </>
          )}

          {/* In kids mode: back-to-profiles button */}
          {kidsMode && (
            <Link to="/kids" className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>
              ← Profiles
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
