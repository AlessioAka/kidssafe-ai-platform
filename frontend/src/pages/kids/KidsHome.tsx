// ============================================================
// pages/kids/KidsHome.tsx — Child's personalised content page
//
// This is the main page children see. It features:
//  1. A starry night hero with the child's name & greeting
//  2. An AI-powered search bar (AISearchBar component)
//  3. A personalised "For You" content feed from the AI
//  4. Colourful content cards with safety scores
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { childrenService, aiService } from '../../services/api';
import Navbar from '../../components/layout/Navbar';
import AISearchBar from '../../components/ai/AISearchBar';
import ContentCard from '../../components/content/ContentCard';
import type { Child, ContentRecommendation } from '../../types';

// Time-based greeting so the page feels alive
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// Randomly position stars for the background effect
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size:  Math.random() * 3 + 1,
    top:   Math.random() * 100,
    left:  Math.random() * 100,
    delay: Math.random() * 3,
    dur:   Math.random() * 2 + 1.5,
  }));
}

const STARS = generateStars(60);

// Category labels for the suggestion filter tabs
const QUICK_TABS = ['All', 'Educational', 'Animation', 'Science', 'Stories', 'Music'];

export default function KidsHome() {
  const { childId } = useParams<{ childId: string }>();
  const navigate    = useNavigate();
  const { selectChild } = useAuth();

  const [child,       setChild]       = useState<Child | null>(null);
  const [suggestions, setSuggestions] = useState<ContentRecommendation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('All');

  // Load child profile + personalised suggestions on mount
  useEffect(() => {
    (async () => {
      try {
        const children = await childrenService.getAll();
        const found    = children.find(c => c.id === Number(childId));
        if (!found) { navigate('/kids'); return; }

        setChild(found);
        selectChild(found);

        // Fetch AI home-feed suggestions
        const res = await aiService.getSuggestions(Number(childId));
        setSuggestions(res.recommendations);
      } catch {
        navigate('/kids');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  // Filter suggestions by the active quick-tab
  const filtered = activeTab === 'All'
    ? suggestions
    : suggestions.filter(s =>
        s.category.toLowerCase() === activeTab.toLowerCase()
      );

  if (loading) {
    return (
      <div style={{ background: 'linear-gradient(180deg,#1a1a2e,#0f3460)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'floatAnim 2s ease-in-out infinite' }}>🚀</div>
          <p style={{ fontWeight: 700 }}>Loading your personalised content…</p>
        </div>
      </div>
    );
  }

  if (!child) return null;

  return (
    <div className="kids-page">
      {/* Kids-variant navbar */}
      <Navbar kidsMode childName={child.name} childEmoji={child.avatar_emoji} />

      {/* ── Hero Section ──────────────────────────────────── */}
      <div className="kids-hero">
        {/* Animated star background */}
        <div className="stars-bg" aria-hidden="true">
          {STARS.map(s => (
            <div
              key={s.id}
              className="star"
              style={{
                width:             `${s.size}px`,
                height:            `${s.size}px`,
                top:               `${s.top}%`,
                left:              `${s.left}%`,
                animationDelay:    `${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="kids-hero-greeting">
            {getGreeting()}, <span className="name-highlight">{child.name}</span>! {child.avatar_emoji}
          </p>
          <p className="kids-hero-subtitle">
            🤖 AI has found {suggestions.length} safe picks just for you!
          </p>
        </div>
      </div>

      {/* ── AI Search Bar ──────────────────────────────────── */}
      <AISearchBar childId={child.id} childName={child.name} />

      {/* ── Personalised Suggestions ───────────────────────── */}
      <div className="container">

        {/* Quick-filter tabs */}
        {suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '1.5rem 0 0.5rem', justifyContent: 'center' }}>
            {QUICK_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background:   activeTab === tab ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
                  color:        activeTab === tab ? '#1a1a2e'        : 'rgba(255,255,255,0.85)',
                  border:       'none',
                  borderRadius: '9999px',
                  padding:      '0.4rem 1rem',
                  fontWeight:   700,
                  fontSize:     '0.85rem',
                  cursor:       'pointer',
                  fontFamily:   'inherit',
                  transition:   'all 0.2s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Content grid */}
        {suggestions.length > 0 && (
          <div className="content-section">
            <h2 className="content-section-title">
              🌟 Picked for you
            </h2>
            {filtered.length > 0 ? (
              <div className="content-grid">
                {filtered.map((item, i) => (
                  <ContentCard key={`${item.title}-${i}`} item={item} index={i} />
                ))}
              </div>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '2rem' }}>
                No {activeTab.toLowerCase()} content in your suggestions. Try searching for it above! 🔍
              </p>
            )}
          </div>
        )}

        {/* Safe-viewing badge */}
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          marginBottom: '2rem',
          background: 'rgba(107, 203, 119, 0.1)',
          border: '1px solid rgba(107,203,119,0.3)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
          <p style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: '0.25rem' }}>
            Safe viewing guaranteed
          </p>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
            Every piece of content on this page has been reviewed by AI and approved by {child.name}'s parent.
          </p>
        </div>

      </div>
    </div>
  );
}
