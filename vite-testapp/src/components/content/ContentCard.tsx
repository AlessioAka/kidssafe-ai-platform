// ============================================================
// components/content/ContentCard.tsx
// Displays a single AI-recommended piece of content.
// Used in the kids home page grid.
// ============================================================

import type { ContentRecommendation } from '../../types';

// Maps content type to a friendly emoji icon
const TYPE_ICONS: Record<string, string> = {
  'TV Show':           '📺',
  'Movie':             '🎬',
  'YouTube Channel':   '▶️',
  'Educational Video': '🎓',
  'Podcast':           '🎙️',
};

// Maps age rating to a badge CSS class
const RATING_CLASS: Record<string, string> = {
  'G':    'badge-g',
  'PG':   'badge-pg',
  'PG-13':'badge-pg13',
};

// Maps category name (lowercase) to a CSS class for the top border colour
function catClass(category: string): string {
  const key = category.toLowerCase().replace(/[^a-z]/g, '');
  return `cat-${key}`;
}

interface ContentCardProps {
  item: ContentRecommendation;
  /** Stagger the card entrance animation */
  index?: number;
}

export default function ContentCard({ item, index = 0 }: ContentCardProps) {
  return (
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

      {/* Why recommended (AI reason) */}
      <div className="content-card-why">
        💡 {item.whyRecommended}
      </div>

      {/* Safety score bar at the bottom */}
      <div className="content-card-footer">
        <div className="safety-bar">
          <div
            className="safety-fill"
            style={{ width: `${item.safetyScore}%` }}
          />
        </div>
        <span className="safety-label">✓ {item.safetyScore}%</span>
      </div>
    </div>
  );
}
