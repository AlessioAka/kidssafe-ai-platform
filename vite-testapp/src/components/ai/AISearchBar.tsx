import React, { useState } from 'react';
import type { ContentRecommendation } from '../../types';
import { aiService } from '../../services/api';
import ContentCard from '../content/ContentCard';

interface AISearchBarProps {
  childId: number;
  childName: string;
}

// Topic chips shown before first search
const TOPIC_CHIPS = [
  { label: '🔬 Science',      query: 'science'     },
  { label: '📜 History',      query: 'history'     },
  { label: '🔢 Maths',        query: 'maths'       },
  { label: '🦁 Animals',      query: 'animals'     },
  { label: '🚀 Space',        query: 'space'       },
  { label: '🌿 Nature',       query: 'nature'      },
  { label: '💻 Technology',   query: 'technology'  },
  { label: '🎨 Arts',         query: 'arts'        },
  { label: '🎵 Music',        query: 'music'       },
  { label: '🍳 Cooking',      query: 'cooking'     },
  { label: '🗺️ Geography',    query: 'geography'   },
  { label: '📚 Stories',      query: 'stories'     },
  { label: '📺 Cartoons',     query: 'cartoons'    },
  { label: '⚽ Sports',       query: 'sports'      },
  { label: '🌍 Languages',    query: 'languages'   },
];

export default function AISearchBar({ childId, childName }: AISearchBarProps) {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<ContentRecommendation[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [searched, setSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  async function doSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    setResults([]);
    setQuery(q);
    try {
      const response = await aiService.search(trimmed, childId);
      setResults(response.recommendations);
      setLastQuery(trimmed);
      setSearched(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Search failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    doSearch(query);
  }

  return (
    <div className="ai-search-container">
      <p className="ai-search-title">
        🤖 AI Search — safe picks just for {childName}
      </p>

      {/* Search form */}
      <form onSubmit={handleSearch}>
        <div className="ai-search-box">
          <input
            className="ai-search-input"
            type="text"
            placeholder="Type a topic — science, history, animals, space…"
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

      {/* Topic chips — shown before first search and after results */}
      {!loading && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
          marginTop: '1rem', justifyContent: 'center',
        }}>
          {TOPIC_CHIPS.map(chip => (
            <button
              key={chip.query}
              onClick={() => doSearch(chip.query)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '9999px',
                color: '#fff',
                padding: '0.35rem 0.9rem',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Thinking animation */}
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
            🔍 {results.length} results for &ldquo;{lastQuery}&rdquo;
          </h2>
          <div className="content-grid">
            {results.map((item, i) => (
              <ContentCard key={`${item.title}-${i}`} item={item} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {searched && !loading && results.length === 0 && !error && (
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginTop: '1.5rem' }}>
          No content found for that search. Try one of the topic buttons above!
        </p>
      )}
    </div>
  );
}
