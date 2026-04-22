// ============================================================
// types/index.ts — Shared TypeScript interfaces & types
// These match the backend API responses exactly.
// ============================================================

// ── Authentication ─────────────────────────────────────────

/** Parent/guardian account */
export interface Parent {
  id: number;
  name: string;
  email: string;
}

/** Shape of the auth state stored in React context */
export interface AuthState {
  parent: Parent | null;
  token: string | null;
  selectedChild: Child | null;
}

// ── Children & Restrictions ────────────────────────────────

/** Content restrictions a parent sets for a child */
export interface Restrictions {
  max_content_rating: 'G' | 'PG' | 'PG-13';
  allowed_categories: string[];
  blocked_keywords: string[];
  violence_level: 'none' | 'mild';
  allow_scary_content: boolean;
  educational_only: boolean;
  max_daily_minutes: number;
  parent_notes: string;
}

/** Child profile (joined with restrictions in API responses) */
export interface Child extends Partial<Restrictions> {
  id: number;
  parent_id?: number;
  name: string;
  age: number;
  avatar_emoji: string;
  pin?: string;
  created_at?: string;
}

// ── AI Recommendations ─────────────────────────────────────

/** A single AI-generated content recommendation */
export interface ContentRecommendation {
  title: string;
  type: 'TV Show' | 'Movie' | 'YouTube Channel' | 'Educational Video' | 'Podcast';
  category: string;
  ageRating: 'G' | 'PG' | 'PG-13';
  description: string;
  whyRecommended: string;
  platform: string;
  safetyScore: number;   // 1–100, 100 = perfectly safe
}

/** Full response from POST /api/ai/search */
export interface SearchResponse {
  query: string;
  childName: string;
  recommendations: ContentRecommendation[];
  generatedAt: string;
}

/** Full response from GET /api/ai/suggestions/:childId */
export interface SuggestionsResponse {
  childName: string;
  recommendations: ContentRecommendation[];
  generatedAt: string;
}

// ── API Errors ─────────────────────────────────────────────
export interface ApiError {
  error: string;
}

// ── Available content categories ──────────────────────────
export const CONTENT_CATEGORIES = [
  'educational',
  'cartoons',
  'science',
  'nature',
  'sports',
  'arts',
  'stories',
  'music',
  'comedy',
  'history',
  'technology',
  'cooking',
] as const;

export type ContentCategory = typeof CONTENT_CATEGORIES[number];

// ── Avatar options for child profiles ─────────────────────
export const AVATAR_OPTIONS = ['🦄', '🐶', '🐱', '🐼', '🐸', '🦊', '🐯', '🐻', '🐺', '🐷', '🐨', '🐙'];
