// ============================================================
// services/api.ts — Centralised API service layer
//
// All HTTP calls to the backend go through this file.
// If the backend is unreachable, falls back to localStorage
// so the app can always be demonstrated without a running server.
// ============================================================

import axios, { AxiosError } from 'axios';
import type {
  Parent, Child, Restrictions, SearchResponse,
  SuggestionsResponse, ContentRecommendation,
} from '../types';

// ── Axios instance ─────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the stored JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kidssafe_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Detect backend availability ────────────────────────────
let backendAvailable: boolean | null = null;

async function checkBackend(): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  try {
    await axios.get(`${API_BASE}/api/health`, { timeout: 3000 });
    backendAvailable = true;
  } catch {
    backendAvailable = false;
    console.warn('Backend not reachable — running in localStorage demo mode');
  }
  return backendAvailable;
}

// ── Utility to extract error messages ─────────────────────
function extractError(error: unknown): string {
  const axErr = error as AxiosError<{ error: string }>;
  return axErr.response?.data?.error || 'Something went wrong. Please try again.';
}

// ============================================================
//  AUTH
// ============================================================

export const authService = {
  /** Register a new parent account */
  async register(name: string, email: string, password: string): Promise<{ token: string; parent: Parent }> {
    const live = await checkBackend();
    if (live) {
      const res = await api.post('/auth/register', { name, email, password });
      return res.data;
    }
    // ── Mock register ──────────────────────────────────────
    return mockRegister(name, email, password);
  },

  /** Login as a parent */
  async login(email: string, password: string): Promise<{ token: string; parent: Parent }> {
    const live = await checkBackend();
    if (live) {
      const res = await api.post('/auth/login', { email, password });
      return res.data;
    }
    return mockLogin(email, password);
  },
};

// ============================================================
//  CHILDREN
// ============================================================

export const childrenService = {
  /** Fetch all children for the authenticated parent */
  async getAll(): Promise<Child[]> {
    const live = await checkBackend();
    if (live) {
      const res = await api.get('/children');
      return res.data;
    }
    return mockGetChildren();
  },

  /** Create a new child profile */
  async create(data: Partial<Child>): Promise<Child> {
    const live = await checkBackend();
    if (live) {
      const res = await api.post('/children', data);
      return res.data;
    }
    return mockAddChild(data);
  },

  /** Update a child's basic info */
  async update(id: number, data: Partial<Child>): Promise<Child> {
    const live = await checkBackend();
    if (live) {
      const res = await api.put(`/children/${id}`, data);
      return res.data;
    }
    return mockUpdateChild(id, data);
  },

  /** Delete a child profile */
  async remove(id: number): Promise<{ message: string }> {
    const live = await checkBackend();
    if (live) {
      const res = await api.delete(`/children/${id}`);
      return res.data;
    }
    return mockDeleteChild(id);
  },

  /** Save content restrictions for a child */
  async saveRestrictions(id: number, restrictions: Partial<Restrictions>): Promise<Restrictions> {
    const live = await checkBackend();
    if (live) {
      const res = await api.put(`/children/${id}/restrictions`, restrictions);
      return res.data;
    }
    return mockSaveRestrictions(id, restrictions);
  },

  /** Get a child's AI search history */
  async getHistory(id: number): Promise<{ id: number; query: string; created_at: string }[]> {
    const live = await checkBackend();
    if (live) {
      const res = await api.get(`/children/${id}/history`);
      return res.data;
    }
    return [];
  },
};

// ============================================================
//  AI
// ============================================================

export const aiService = {
  /** Search for age-appropriate content */
  async search(query: string, childId: number): Promise<SearchResponse> {
    const live = await checkBackend();
    if (live) {
      const res = await api.post('/ai/search', { query, childId });
      return res.data;
    }
    return mockAISearch(query, childId);
  },

  /** Load personalised home-feed suggestions */
  async getSuggestions(childId: number): Promise<SuggestionsResponse> {
    const live = await checkBackend();
    if (live) {
      const res = await api.get(`/ai/suggestions/${childId}`);
      return res.data;
    }
    return mockSuggestions(childId);
  },
};

// ============================================================
//  MOCK / DEMO IMPLEMENTATIONS (used when backend is offline)
//  Data is persisted to localStorage so state survives refreshes.
// ============================================================

const LS_PARENTS  = 'kidssafe_mock_parents';
const LS_CHILDREN = 'kidssafe_mock_children';

function getParents(): (Parent & { password: string })[] {
  return JSON.parse(localStorage.getItem(LS_PARENTS) || '[]');
}
function saveParents(p: (Parent & { password: string })[]) {
  localStorage.setItem(LS_PARENTS, JSON.stringify(p));
}
function getMockChildren(): Child[] {
  return JSON.parse(localStorage.getItem(LS_CHILDREN) || '[]');
}
function saveMockChildren(c: Child[]) {
  localStorage.setItem(LS_CHILDREN, JSON.stringify(c));
}

function mockRegister(name: string, email: string, password: string) {
  const parents = getParents();
  if (parents.find(p => p.email === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const parent: Parent & { password: string } = {
    id: Date.now(), name, email: email.toLowerCase(), password,
  };
  saveParents([...parents, parent]);
  const token = btoa(JSON.stringify({ parentId: parent.id, exp: Date.now() + 7 * 86400000 }));
  return { token, parent: { id: parent.id, name: parent.name, email: parent.email } };
}

function mockLogin(email: string, password: string) {
  const parents = getParents();
  const parent = parents.find(p => p.email === email.toLowerCase() && p.password === password);
  if (!parent) throw new Error('Invalid email or password.');
  const token = btoa(JSON.stringify({ parentId: parent.id, exp: Date.now() + 7 * 86400000 }));
  return { token, parent: { id: parent.id, name: parent.name, email: parent.email } };
}

function mockGetChildren(): Child[] {
  const stored = getMockChildren();
  const token = localStorage.getItem('kidssafe_token');
  if (!token) return [];
  try {
    const { parentId } = JSON.parse(atob(token));
    return stored.filter(c => c.parent_id === parentId);
  } catch { return []; }
}

function mockAddChild(data: Partial<Child>): Child {
  const token = localStorage.getItem('kidssafe_token')!;
  const { parentId } = JSON.parse(atob(token));
  const child: Child = {
    id: Date.now(),
    parent_id: parentId,
    name: data.name || 'Child',
    age: data.age || 6,
    avatar_emoji: data.avatar_emoji || '🦄',
    pin: data.pin,
    created_at: new Date().toISOString(),
    max_content_rating: 'G',
    allowed_categories: ['educational', 'cartoons', 'science', 'nature'],
    blocked_keywords: [],
    violence_level: 'none',
    allow_scary_content: false,
    educational_only: false,
    max_daily_minutes: 120,
    parent_notes: '',
  };
  saveMockChildren([...getMockChildren(), child]);
  return child;
}

function mockUpdateChild(id: number, data: Partial<Child>): Child {
  const children = getMockChildren();
  const idx = children.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Child not found.');
  children[idx] = { ...children[idx], ...data };
  saveMockChildren(children);
  return children[idx];
}

function mockDeleteChild(id: number) {
  saveMockChildren(getMockChildren().filter(c => c.id !== id));
  return { message: 'Child profile removed.' };
}

function mockSaveRestrictions(id: number, restrictions: Partial<Restrictions>) {
  const children = getMockChildren();
  const idx = children.findIndex(c => c.id === id);
  if (idx !== -1) {
    children[idx] = { ...children[idx], ...restrictions };
    saveMockChildren(children);
  }
  return restrictions as Restrictions;
}

/** Curated fallback recommendations used in demo/offline mode */
const DEMO_CONTENT: ContentRecommendation[] = [
  { title: 'Bluey',                  type: 'TV Show',         category: 'Animation',   ageRating: 'G',  description: 'A lovable Blue Heeler puppy and her imaginative family enjoy everyday adventures.',            whyRecommended: 'Excellent family values and promotes imaginative play.',              platform: 'Disney+',  safetyScore: 99 },
  { title: 'Sesame Street',          type: 'TV Show',         category: 'Educational', ageRating: 'G',  description: 'Classic educational show teaching letters, numbers, and social skills.',                      whyRecommended: 'Decades of proven educational value for young learners.',             platform: 'PBS Kids', safetyScore: 100 },
  { title: 'National Geographic Kids', type: 'YouTube Channel', category: 'Science',  ageRating: 'G',  description: 'Stunning wildlife facts and amazing animal videos from around the world.',                     whyRecommended: 'Sparks curiosity about nature and the animal kingdom.',               platform: 'YouTube',  safetyScore: 98 },
  { title: 'SciShow Kids',           type: 'YouTube Channel', category: 'Educational', ageRating: 'G',  description: 'Science made fun with engaging experiments and easy explanations.',                           whyRecommended: 'Outstanding STEM content that makes learning exciting.',              platform: 'YouTube',  safetyScore: 99 },
  { title: 'Numberblocks',           type: 'TV Show',         category: 'Educational', ageRating: 'G',  description: 'Number characters bring maths to life through songs and adventures.',                         whyRecommended: 'Builds strong early maths foundations in a fun, visual way.',         platform: 'BBC',      safetyScore: 100 },
  { title: 'TED-Ed',                 type: 'YouTube Channel', category: 'Educational', ageRating: 'G',  description: 'Short animated lessons covering science, history, maths, and more.',                          whyRecommended: 'Thought-provoking content that inspires lifelong learning.',          platform: 'YouTube',  safetyScore: 97 },
  { title: 'Peppa Pig',              type: 'TV Show',         category: 'Animation',   ageRating: 'G',  description: 'Cheerful adventures of Peppa and her family and friends.',                                    whyRecommended: 'Gentle, positive stories that build social awareness.',               platform: 'YouTube',  safetyScore: 99 },
  { title: 'Matilda the Musical',    type: 'Movie',           category: 'Stories',     ageRating: 'PG', description: 'A brilliant girl with telekinetic powers finds courage with her teacher\'s help.',             whyRecommended: 'Celebrates intelligence, kindness, and standing up for what is right.', platform: 'Netflix', safetyScore: 94 },
];

function mockAISearch(query: string, childId: number): SearchResponse {
  const children = getMockChildren();
  const child = children.find(c => c.id === childId);
  return {
    query,
    childName: child?.name || 'Child',
    recommendations: DEMO_CONTENT,
    generatedAt: new Date().toISOString(),
  };
}

function mockSuggestions(childId: number): SuggestionsResponse {
  const children = getMockChildren();
  const child = children.find(c => c.id === childId);
  return {
    childName: child?.name || 'Child',
    recommendations: DEMO_CONTENT,
    generatedAt: new Date().toISOString(),
  };
}

export { extractError };
export default api;
