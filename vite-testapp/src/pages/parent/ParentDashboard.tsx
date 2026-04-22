// ============================================================
// pages/parent/ParentDashboard.tsx — Parent home screen
//
// Shows all children profiles. From here a parent can:
//   • Add a new child profile (modal form)
//   • Click "Settings" → navigate to restriction settings
//   • Click "Open" → navigate to that child's kids view
//   • Delete a child profile
// ============================================================

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { childrenService } from '../../services/api';
import Navbar from '../../components/layout/Navbar';
import type { Child } from '../../types';
import { AVATAR_OPTIONS } from '../../types';

// Gradient backgrounds for child cards (cycles through)
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #FF6B6B, #FF8E53)',
  'linear-gradient(135deg, #6C63FF, #9B59B6)',
  'linear-gradient(135deg, #11998e, #38ef7d)',
  'linear-gradient(135deg, #f7971e, #FFD93D)',
  'linear-gradient(135deg, #E91E8C, #9B59B6)',
  'linear-gradient(135deg, #3498DB, #1ABC9C)',
];

export default function ParentDashboard() {
  const { parent, selectChild } = useAuth();
  const navigate = useNavigate();

  const [children,     setChildren]     = useState<Child[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId,     setDeleteId]     = useState<number | null>(null);
  const [formError,    setFormError]    = useState('');
  const [saving,       setSaving]       = useState(false);

  // Form state for "Add child" modal
  const [newName,   setNewName]   = useState('');
  const [newAge,    setNewAge]    = useState('');
  const [newEmoji,  setNewEmoji]  = useState('🦄');
  const [newPin,    setNewPin]    = useState('');

  // Load children on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await childrenService.getAll();
        setChildren(data);
      } catch {
        // Silently fall back to empty — api.ts handles the error logging
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Add child ──────────────────────────────────────────
  async function handleAddChild(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!newName.trim()) return setFormError('Please enter a name.');
    const age = parseInt(newAge);
    if (!age || age < 1 || age > 18) return setFormError('Age must be between 1 and 18.');

    setSaving(true);
    try {
      const child = await childrenService.create({
        name: newName.trim(),
        age,
        avatar_emoji: newEmoji,
        pin: newPin || undefined,
      });
      setChildren(prev => [...prev, child]);
      closeAddModal();
    } catch (err: unknown) {
      setFormError((err as { message?: string }).message || 'Could not add child. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function closeAddModal() {
    setShowAddModal(false);
    setNewName(''); setNewAge(''); setNewEmoji('🦄'); setNewPin(''); setFormError('');
  }

  // ── Delete child ───────────────────────────────────────
  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await childrenService.remove(deleteId);
      setChildren(prev => prev.filter(c => c.id !== deleteId));
    } catch { /* handled */ }
    setDeleteId(null);
  }

  // ── Open kids view ─────────────────────────────────────
  function openKidsView(child: Child) {
    selectChild(child);
    navigate(`/kids/${child.id}`);
  }

  return (
    <div className="dashboard-page">
      <Navbar />

      {/* Header */}
      <div className="dashboard-header">
        <div className="container">
          <div className="flex-between">
            <div>
              <h1>👋 Hello, {parent?.name?.split(' ')[0]}!</h1>
              <p>Manage your children's profiles and content restrictions.</p>
            </div>
            <span style={{ fontSize: '3.5rem' }} aria-hidden="true">🛡️</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container" style={{ padding: '2rem 1.5rem' }}>

        {/* Section heading */}
        <div className="flex-between mb-3">
          <h2 style={{ fontWeight: 900, fontSize: '1.3rem' }}>
            Children Profiles ({children.length})
          </h2>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            + Add Child
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex-center" style={{ padding: '4rem' }}>
            <div className="spinner" />
          </div>
        )}

        {/* Empty state */}
        {!loading && children.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: '#fff', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-md)' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👨‍👩‍👧‍👦</div>
            <h3 style={{ fontWeight: 900, marginBottom: '0.5rem' }}>No children yet</h3>
            <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
              Add your first child profile to get started.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              Add your first child →
            </button>
          </div>
        )}

        {/* Children grid */}
        {!loading && children.length > 0 && (
          <div className="children-grid">
            {children.map((child, i) => (
              <div key={child.id} className="child-card">
                {/* Avatar */}
                <div
                  className="child-avatar"
                  style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}
                >
                  {child.avatar_emoji}
                </div>

                {/* Info */}
                <div className="child-name">{child.name}</div>
                <div className="child-age">Age {child.age}</div>

                {/* Restriction summary chips */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className={`badge badge-${child.max_content_rating?.toLowerCase().replace('-', '') || 'g'}`}>
                    {child.max_content_rating || 'G'}
                  </span>
                  {child.educational_only && (
                    <span className="badge badge-primary">Edu only</span>
                  )}
                  {!child.allow_scary_content && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>🚫 Scary</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="child-card-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openKidsView(child)}
                    title="Open kids view"
                  >
                    👁️ View
                  </button>
                  <Link
                    to={`/settings/${child.id}`}
                    className="btn btn-ghost btn-sm"
                    title="Edit restrictions"
                    onClick={() => selectChild(child)}
                  >
                    ⚙️ Settings
                  </Link>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteId(child.id)}
                    title="Delete profile"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}

            {/* Add-child shortcut card */}
            <div className="add-child-card" onClick={() => setShowAddModal(true)}>
              <div className="add-icon">➕</div>
              <p>Add another child</p>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="alert alert-info" style={{ marginTop: '2rem' }}>
          💡 <strong>Tip:</strong> Click <strong>Settings</strong> on any profile to customise content restrictions, blocked keywords, and screen-time limits.
        </div>
      </div>

      {/* ── Add Child Modal ──────────────────────────────── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeAddModal()}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Add a child profile</h2>
              <button className="modal-close" onClick={closeAddModal} aria-label="Close">✕</button>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <form onSubmit={handleAddChild}>
              {/* Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="child-name">Child's name *</label>
                <input
                  id="child-name"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Emma"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Age */}
              <div className="form-group">
                <label className="form-label" htmlFor="child-age">Age *</label>
                <input
                  id="child-age"
                  className="form-input"
                  type="number"
                  min={1} max={18}
                  placeholder="e.g. 7"
                  value={newAge}
                  onChange={e => setNewAge(e.target.value)}
                  required
                />
              </div>

              {/* Avatar picker */}
              <div className="form-group">
                <label className="form-label">Choose an avatar</label>
                <div className="avatar-picker">
                  {AVATAR_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={`avatar-opt${newEmoji === emoji ? ' selected' : ''}`}
                      onClick={() => setNewEmoji(emoji)}
                      aria-label={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional PIN */}
              <div className="form-group">
                <label className="form-label" htmlFor="child-pin">PIN (optional)</label>
                <input
                  id="child-pin"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="4–6 digit PIN"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                />
                <span className="form-hint">Optional: kids enter this to switch profiles</span>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-ghost w-full" onClick={closeAddModal}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                  {saving ? 'Adding…' : `Add ${newEmoji} ${newName || 'Child'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────── */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Delete this profile?</h3>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                This will permanently remove the child's profile, restrictions, and all search history.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-ghost w-full" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger w-full" onClick={confirmDelete}>Yes, delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
