// ============================================================
// pages/parent/ChildSettings.tsx — Content restriction editor
//
// Allows the parent to configure exactly what a child can see:
//  • Content rating ceiling (G / PG / PG-13)
//  • Allowed categories (multi-select chips)
//  • Blocked keywords (tag input)
//  • Violence level toggle
//  • Scary content toggle
//  • Educational-only mode
//  • Daily screen-time limit (slider)
//  • Free-text notes sent to the AI
// ============================================================

import { useState, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { childrenService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/layout/Navbar';
import type { Child } from '../../types';
import { CONTENT_CATEGORIES } from '../../types';

export default function ChildSettings() {
  const { childId } = useParams<{ childId: string }>();
  const navigate    = useNavigate();
  const { selectChild } = useAuth();

  const [child,   setChild]   = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  // ── Restriction state ──────────────────────────────────
  const [rating,          setRating]          = useState<'G' | 'PG' | 'PG-13'>('G');
  const [categories,      setCategories]      = useState<string[]>(['educational', 'cartoons', 'science', 'nature']);
  const [blockedKeywords, setBlockedKeywords] = useState<string[]>([]);
  const [violenceLevel,   setViolenceLevel]   = useState<'none' | 'mild'>('none');
  const [allowScary,      setAllowScary]      = useState(false);
  const [eduOnly,         setEduOnly]         = useState(false);
  const [dailyMinutes,    setDailyMinutes]    = useState(120);
  const [notes,           setNotes]           = useState('');

  // For the keyword tag-input
  const [keywordInput, setKeywordInput] = useState('');

  // Load child on mount
  useEffect(() => {
    (async () => {
      try {
        const children = await childrenService.getAll();
        const found = children.find(c => c.id === Number(childId));
        if (!found) { navigate('/dashboard'); return; }

        setChild(found);
        selectChild(found);

        // Pre-fill form from existing restrictions
        setRating((found.max_content_rating as 'G' | 'PG' | 'PG-13') || 'G');
        setCategories(found.allowed_categories || ['educational', 'cartoons', 'science', 'nature']);
        setBlockedKeywords(found.blocked_keywords || []);
        setViolenceLevel((found.violence_level as 'none' | 'mild') || 'none');
        setAllowScary(found.allow_scary_content || false);
        setEduOnly(found.educational_only || false);
        setDailyMinutes(found.max_daily_minutes ?? 120);
        setNotes(found.parent_notes || '');
      } catch {
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  // ── Category toggle ────────────────────────────────────
  function toggleCategory(cat: string) {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  // ── Keyword management ─────────────────────────────────
  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !blockedKeywords.includes(kw)) {
      setBlockedKeywords(prev => [...prev, kw]);
    }
    setKeywordInput('');
  }

  function handleKeywordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword();
    }
  }

  function removeKeyword(kw: string) {
    setBlockedKeywords(prev => prev.filter(k => k !== kw));
  }

  // ── Save restrictions ──────────────────────────────────
  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (categories.length === 0) {
      return setError('Please allow at least one content category.');
    }
    setError('');
    setSaving(true);
    try {
      await childrenService.saveRestrictions(Number(childId), {
        max_content_rating:  rating,
        allowed_categories:  categories,
        blocked_keywords:    blockedKeywords,
        violence_level:      violenceLevel,
        allow_scary_content: allowScary,
        educational_only:    eduOnly,
        max_daily_minutes:   dailyMinutes,
        parent_notes:        notes,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────
  const formatTime = (mins: number) =>
    mins === 0 ? 'Unlimited' : `${Math.floor(mins / 60)}h ${mins % 60}m`;

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="flex-center" style={{ minHeight: '80vh' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-light)', minHeight: '100vh' }}>
      <Navbar />

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: '#fff', padding: '2rem 0' }}>
        <div className="container">
          <div className="flex-between">
            <div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontWeight: 700, cursor: 'pointer', marginBottom: '0.75rem', fontFamily: 'inherit' }}
              >
                ← Back
              </button>
              <h1 style={{ fontWeight: 900, fontSize: '1.7rem', marginBottom: '0.25rem' }}>
                {child?.avatar_emoji} {child?.name}'s Settings
              </h1>
              <p style={{ opacity: 0.85 }}>Age {child?.age} · Customise content restrictions</p>
            </div>
            <span style={{ fontSize: '3rem' }}>⚙️</span>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: 760 }}>

        {error  && <div className="alert alert-error">{error}</div>}
        {saved  && <div className="alert alert-success">✅ Restrictions saved successfully!</div>}

        <form onSubmit={handleSave}>

          {/* ── Content Rating ──────────────────────────── */}
          <div className="settings-section">
            <h3 className="settings-section-title">🎬 Maximum Content Rating</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-light)', marginBottom: '1rem' }}>
              Content above this rating will never be recommended to {child?.name}.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {(['G', 'PG', 'PG-13'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  className="btn"
                  style={{
                    background: rating === r ? 'var(--primary)' : 'var(--bg-light)',
                    color:      rating === r ? '#fff' : 'var(--text-dark)',
                    border:     `2px solid ${rating === r ? 'var(--primary)' : 'var(--border)'}`,
                    padding:    '0.6rem 1.5rem',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {r === 'G' ? '🟢 G — All ages' : r === 'PG' ? '🟡 PG — With guidance' : '🔴 PG-13 — Teens'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Allowed Categories ──────────────────────── */}
          <div className="settings-section">
            <h3 className="settings-section-title">📂 Allowed Content Categories</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-light)' }}>
              Select which types of content {child?.name} is allowed to see.
              At least one must be selected.
            </p>
            <div className="category-chips">
              {CONTENT_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`chip${categories.includes(cat) ? ' active' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {categories.includes(cat) ? '✓ ' : ''}{cat}
                </button>
              ))}
            </div>
          </div>

          {/* ── Blocked Keywords ────────────────────────── */}
          <div className="settings-section">
            <h3 className="settings-section-title">🚫 Blocked Topics & Keywords</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-light)', marginBottom: '0.75rem' }}>
              The AI will never recommend content that includes these topics.
            </p>
            <div className="keyword-input-row">
              <input
                className="form-input"
                type="text"
                placeholder="Type a keyword and press Enter…"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
              />
              <button type="button" className="btn btn-danger" onClick={addKeyword}>
                Block
              </button>
            </div>
            {blockedKeywords.length > 0 && (
              <div className="keyword-tags">
                {blockedKeywords.map(kw => (
                  <span key={kw} className="keyword-tag">
                    🚫 {kw}
                    <button type="button" onClick={() => removeKeyword(kw)} aria-label={`Remove ${kw}`}>×</button>
                  </span>
                ))}
              </div>
            )}
            {blockedKeywords.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>No keywords blocked yet.</p>
            )}
          </div>

          {/* ── Safety Toggles ──────────────────────────── */}
          <div className="settings-section">
            <h3 className="settings-section-title">🛡️ Safety Toggles</h3>

            {/* Violence level */}
            <div className="toggle-group">
              <div>
                <div className="toggle-label">Allow mild violence</div>
                <div className="toggle-description">e.g. cartoons with slapstick, superhero action</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={violenceLevel === 'mild'}
                  onChange={e => setViolenceLevel(e.target.checked ? 'mild' : 'none')}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Scary content */}
            <div className="toggle-group">
              <div>
                <div className="toggle-label">Allow scary / spooky content</div>
                <div className="toggle-description">Horror, jump-scares, dark themes</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={allowScary}
                  onChange={e => setAllowScary(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Educational only */}
            <div className="toggle-group">
              <div>
                <div className="toggle-label">Educational content only</div>
                <div className="toggle-description">No pure entertainment — learning content only</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={eduOnly}
                  onChange={e => setEduOnly(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          {/* ── Daily Screen Time ────────────────────────── */}
          <div className="settings-section">
            <h3 className="settings-section-title">⏱️ Daily Screen Time Limit</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-light)', marginBottom: '0.75rem' }}>
              Maximum viewing per day for {child?.name}.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                className="time-slider"
                min={0} max={480} step={15}
                value={dailyMinutes}
                onChange={e => setDailyMinutes(Number(e.target.value))}
              />
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)', minWidth: 90, textAlign: 'right' }}>
                {formatTime(dailyMinutes)}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Drag to 0 for unlimited. Range: 15 min → 8 hours.
            </p>
          </div>

          {/* ── Notes to AI ─────────────────────────────── */}
          <div className="settings-section">
            <h3 className="settings-section-title">📝 Notes to the AI</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-light)', marginBottom: '0.75rem' }}>
              Extra context that will be passed to the AI for every recommendation. Optional.
            </p>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder={`e.g. "${child?.name} loves dinosaurs and dislikes loud music. Only British English content please."`}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={500}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>{notes.length}/500</p>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success btn-lg" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : '💾 Save Restrictions'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
