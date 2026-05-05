import { useState, useEffect } from 'react';
import type { ContentRecommendation } from '../../types';

const TYPE_ICONS: Record<string, string> = {
  'TV Show':           '📺',
  'Movie':             '🎬',
  'YouTube Channel':   '▶️',
  'Educational Video': '🎓',
  'Podcast':           '🎙️',
  'Documentary':       '🎥',
  'Music Video':       '🎵',
};

const RATING_CLASS: Record<string, string> = {
  'G':    'badge-g',
  'PG':   'badge-pg',
  'PG-13':'badge-pg13',
};

function catClass(category: string): string {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  return `cat-${key}`;
}

interface ContentCardProps {
  item: ContentRecommendation;
  index?: number;
}

export default function ContentCard({ item, index = 0 }: ContentCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [embedError, setEmbedError] = useState(false);

  // Keyboard close + body scroll lock when modal is open
  useEffect(() => {
    if (!showPlayer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPlayer(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [showPlayer]);

  const hasVideo = !!(item.youtubeId || item.youtubeSearchQuery);

  // Direct watch URL — specific video if we have an ID, otherwise YouTube search
  const watchUrl = item.youtubeId
    ? `https://www.youtube.com/watch?v=${item.youtubeId}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(
        item.youtubeSearchQuery ?? `${item.title} for kids`
      )}`;

  function openPlayer() {
    setEmbedError(false);
    setShowPlayer(true);
  }

  return (
    <>
      {/* ── Card ─────────────────────────────────────────── */}
      <div
        className={`content-card ${catClass(item.category)} animate-slideUp`}
        style={{ animationDelay: `${index * 0.07}s`, animationFillMode: 'both' }}
      >
        {/* Title row */}
        <div className="content-card-header">
          <h3 className="content-card-title">{item.title}</h3>
          <span className="content-card-platform">{item.platform}</span>
        </div>

        {/* Type + rating badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="content-card-type">
            {TYPE_ICONS[item.type] || '🎮'} {item.type}
          </span>
          <span className={`badge ${RATING_CLASS[item.ageRating] || 'badge-g'}`}>
            {item.ageRating}
          </span>
        </div>

        {/* Description */}
        <p className="content-card-description">{item.description}</p>

        {/* AI reason */}
        <div className="content-card-why">💡 {item.whyRecommended}</div>

        {/* Watch button */}
        {hasVideo && (
          <button className="watch-btn" onClick={openPlayer}>
            ▶ Watch Now
          </button>
        )}

        {/* Safety score bar */}
        <div className="content-card-footer">
          <div className="safety-bar">
            <div className="safety-fill" style={{ width: `${item.safetyScore}%` }} />
          </div>
          <span className="safety-label">✓ {item.safetyScore}%</span>
        </div>
      </div>

      {/* ── Video Player Modal ────────────────────────────── */}
      {showPlayer && (
        <div
          className="video-modal-overlay"
          onClick={() => setShowPlayer(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Watch ${item.title}`}
        >
          <div className="video-modal-box" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="video-modal-header">
              <div style={{ minWidth: 0 }}>
                <h3 className="video-modal-title">{item.title}</h3>
                <p className="video-modal-subtitle">
                  {item.platform} · {item.type} · Rated {item.ageRating} · Safety {item.safetyScore}%
                </p>
              </div>
              <button
                className="video-modal-close"
                onClick={() => setShowPlayer(false)}
                aria-label="Close video player"
              >
                ✕
              </button>
            </div>

            {/* Embedded player or fallback */}
            {item.youtubeId && !embedError ? (
              <div className="video-modal-player">
                <iframe
                  src={`https://www.youtube.com/embed/${item.youtubeId}?autoplay=1&modestbranding=1&rel=0`}
                  title={item.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onError={() => setEmbedError(true)}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                />
              </div>
            ) : (
              <div className="video-modal-fallback">
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>▶</div>
                <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: '0.5rem', fontSize: '1rem' }}>
                  {embedError
                    ? 'This video cannot play inline — watch it directly on YouTube:'
                    : 'Click below to watch on YouTube:'}
                </p>
                <p style={{ fontWeight: 800, color: '#fff', fontSize: '1.1rem', marginBottom: '1.75rem' }}>
                  {item.title}
                </p>
                <a
                  href={watchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-modal-yt-btn"
                >
                  ▶ Watch on YouTube
                </a>
              </div>
            )}

            {/* Footer — always show external link when embedded */}
            {item.youtubeId && !embedError && (
              <div className="video-modal-footer">
                <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="video-modal-ext-link">
                  Open in YouTube ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
