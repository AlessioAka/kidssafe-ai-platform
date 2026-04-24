// ============================================================
// pages/LandingPage.tsx — Public home / marketing page
// Shows the app value proposition and CTAs to register/login.
// ============================================================

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/layout/Navbar';

// Feature cards data — easier to maintain in one place
const FEATURES = [
  {
    icon: '🛡️',
    title: 'Parent-Controlled',
    desc: 'You decide exactly what your child can watch. Set age ratings, content categories, and blocked topics with a few clicks.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Search',
    desc: 'Our AI reads your restrictions and only suggests content that fits. Your child searches freely — safely.',
  },
  {
    icon: '👧',
    title: 'Personalised Profiles',
    desc: 'Create individual profiles for each child. Every profile has its own restrictions, avatar, and watch history.',
  },
  {
    icon: '⏱️',
    title: 'Screen-Time Limits',
    desc: 'Set a daily viewing limit per child and know they cannot exceed it even when you\'re not around.',
  },
  {
    icon: '🔒',
    title: 'Blocked Keywords',
    desc: 'Add specific words or topics you never want your child to encounter. The AI will redirect automatically.',
  },
  {
    icon: '📊',
    title: 'Activity Insights',
    desc: 'See what your children have been searching for and review AI recommendations from a parent view.',
  },
];

export default function LandingPage() {
  const { parent } = useAuth();

  return (
    <div>
      <Navbar />

      {/* ── Hero Section ──────────────────────────────────── */}
      <section className="landing-hero">
        <div className="container">
          <div className="landing-hero-content">
            <h1>
              Safe Internet for <span>Your Kids</span>,<br />
              Peace of Mind for <span>You</span>
            </h1>
            <p>
              KidsSafe is an AI-powered kids content platform where parents set the rules
              and children explore freely — knowing every recommendation is safe, age-appropriate,
              and personally curated just for them.
            </p>
            <div className="landing-hero-cta">
              {parent ? (
                <Link to="/dashboard" className="btn btn-white btn-lg">
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn btn-white btn-lg">
                    Get Started Free
                  </Link>
                  <Link to="/login" className="btn btn-outline-white btn-lg">
                    Parent Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Floating emojis decoration */}
        <div className="landing-floats" aria-hidden="true">
          <span className="float-emoji">🦄</span>
          <span className="float-emoji">🚀</span>
          <span className="float-emoji">🎨</span>
          <span className="float-emoji">🌟</span>
          <span className="float-emoji">🐼</span>
        </div>
      </section>

      {/* ── Features Section ──────────────────────────────── */}
      <section className="landing-features">
        <div className="container">
          <h2>Everything a parent needs 👨‍👩‍👧</h2>
          <p className="subtitle">
            Built by parents, for parents. Simple controls with powerful AI behind the scenes.
          </p>
          <div className="feature-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section style={{ padding: '5rem 0', background: 'var(--bg-light)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2.2rem', fontWeight: 900, marginBottom: '0.75rem' }}>
            How it works
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-light)', marginBottom: '3rem' }}>
            Set up in under 2 minutes
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>
            {[
              { step: '1', icon: '📝', title: 'Create your account', desc: 'Register as a parent in seconds.' },
              { step: '2', icon: '👤', title: 'Add your children', desc: 'Set their age, avatar, and a PIN.' },
              { step: '3', icon: '⚙️', title: 'Set restrictions',  desc: 'Choose allowed categories and block any topics.' },
              { step: '4', icon: '🎉', title: 'Kids explore safely', desc: 'Children search with AI, you approve every result.' },
            ].map(s => (
              <div key={s.step} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 60, height: 60,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontWeight: 900,
                  margin: '0 auto 1rem',
                  boxShadow: '0 4px 15px rgba(108,99,255,0.35)',
                }}>
                  {s.step}
                </div>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{s.icon}</div>
                <h3 style={{ fontWeight: 800, marginBottom: '0.4rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--kids-purple) 100%)', padding: '4rem 0', textAlign: 'center', color: '#fff' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem' }}>
            Ready to give your child a safer internet? 🌈
          </h2>
          <p style={{ opacity: 0.9, marginBottom: '2rem', fontSize: '1.1rem' }}>
            Join thousands of parents who use KidsSafe every day.
          </p>
          <Link to="/register" className="btn btn-white btn-lg">
            Create Free Account →
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer style={{ background: 'var(--text-dark)', color: 'rgba(255,255,255,0.6)', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.85rem' }}>
        <div className="container">
          🛡️ KidsSafe AI Platform — Keeping children safe online
        </div>
      </footer>
    </div>
  );
}
