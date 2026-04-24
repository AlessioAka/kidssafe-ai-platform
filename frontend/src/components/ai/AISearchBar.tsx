// ============================================================
// components/ai/AISearchBar.tsx
// AI-powered search input that calls the backend's /api/ai/search
// endpoint and renders a grid of ContentCard results.
// ============================================================

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ContentRecommendation } from '../../types';
import { aiService } from '../../services/api';
import ContentCard from '../content/ContentCard';

interface AISearchBarProps {
  childId: number;
  childName: string;
}

export default function AISearchBar({ childId, childName }: AISearchBarProps) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<ContentRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const response = await aiService.search(trimmed, childId);
      setResults(response.recommendations);
      setSearched(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Search failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Quick-search suggestions shown before any search
  const suggestions = ['cartoons', 'science videos', 'animals', 'funny shows', 'learn maths', 'space'];

  return (
    <div className="ai-search-container">
      {/* Label */}
      <p className="ai-search-title">
        🤖 AI Search — safe picks just for {childName}
      </p>

      {/* Search form */}
      <form onSubmit={handleSearch}>
        <div className="ai-search-box">
          <input
            className="ai-search-input"
            type="text"
            placeholder="Search for shows, topics, or anything…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={loading}
            maxLength={200}
          />
          <button
            type="submit"
            className="ai-search-btn"
            disabled={loading || !query.trim()}
          >
            {loading ? '…' : '🔍 Search'}
          </button>
        </div>
      </form>

      {/* Quick-search chips (only before first search) */}
      {!searched && !loading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); }}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '9999px',
                color: '#fff',
                padding: '0.3rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* AI "thinking" animation */}
      {loading && (
        <div className="ai-thinking">
          <div className="ai-dot" />
          <div className="ai-dot" />
          <div className="ai-dot" />
          <span>AI is finding safe content for {childName}…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ textAlign: 'center', color: '#FF6B6B', marginTop: '1rem', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </p>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div className="content-section" style={{ paddingTop: '1.5rem' }}>
          <h2 className="content-section-title">
            🔍 Results for "{query}"
          </h2>
          <div className="content-grid">
            {results.map((item, i) => (
              <ContentCard key={`${item.title}-${i}`} item={item} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
