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

// On 401/403 from a protected route the stored token is invalid (e.g. a stale mock token).
// Clear auth state and notify the app so it redirects to login.
// Skip auth endpoints — a 401 there just means wrong password, not a bad token.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');
    if (!isAuthEndpoint && (error.response?.status === 401 || error.response?.status === 403)) {
      localStorage.removeItem('kidssafe_token');
      localStorage.removeItem('kidssafe_parent');
      localStorage.removeItem('kidssafe_selected_child');
      backendAvailable = null;
      window.dispatchEvent(new Event('kidssafe:session-expired'));
    }
    return Promise.reject(error);
  }
);

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
      try {
        const res = await api.post('/auth/register', { name, email, password });
        return res.data;
      } catch (err) {
        throw new Error(extractError(err));
      }
    }
    return mockRegister(name, email, password);
  },

  /** Login as a parent */
  async login(email: string, password: string): Promise<{ token: string; parent: Parent }> {
    const live = await checkBackend();
    if (live) {
      try {
        const res = await api.post('/auth/login', { email, password });
        return res.data;
      } catch (err) {
        const axErr = err as AxiosError<{ error: string }>;
        if (axErr.response?.status === 401) throw new Error('Wrong password or email address.');
        throw new Error(extractError(err));
      }
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

// ── Extended item type for the internal database ──────────
interface DBItem extends ContentRecommendation {
  searchTags: string[];
}

/** Maps query keywords → matching category names */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  // Science
  science: ['Science'], biology: ['Science'], chemistry: ['Science'],
  physics: ['Science'], experiment: ['Science'], stem: ['Science', 'Technology'],
  scientific: ['Science'], lab: ['Science'], laboratory: ['Science'],
  // History
  history: ['History'], historical: ['History'], ancient: ['History'],
  egypt: ['History'], egyptian: ['History'], rome: ['History'], roman: ['History'],
  greek: ['History'], greece: ['History'], medieval: ['History'],
  viking: ['History'], vikings: ['History'], tudor: ['History'],
  victorian: ['History'], war: ['History'], revolution: ['History'],
  civilization: ['History'], dynasty: ['History'], empire: ['History'],
  // Math
  math: ['Math'], maths: ['Math'], mathematics: ['Math'],
  numbers: ['Math'], counting: ['Math'], addition: ['Math'],
  subtraction: ['Math'], multiplication: ['Math'], division: ['Math'],
  fractions: ['Math'], geometry: ['Math'], algebra: ['Math'],
  shapes: ['Math'], times: ['Math'], arithmetic: ['Math'],
  // Nature
  nature: ['Nature'], environment: ['Nature'], ecosystem: ['Nature'],
  plants: ['Nature'], trees: ['Nature'], flowers: ['Nature'],
  weather: ['Nature'], climate: ['Nature'], seasons: ['Nature'],
  forest: ['Nature'], rainforest: ['Nature'], insects: ['Nature'],
  // Animals
  animals: ['Animals'], animal: ['Animals'], wildlife: ['Animals'],
  zoo: ['Animals'], lion: ['Animals'], elephant: ['Animals'],
  dolphin: ['Animals'], dolphins: ['Animals'], shark: ['Animals'],
  sharks: ['Animals'], bear: ['Animals'], wolf: ['Animals'],
  penguin: ['Animals'], bird: ['Animals'], birds: ['Animals'],
  fish: ['Animals'], whale: ['Animals'], cheetah: ['Animals'],
  // Space
  space: ['Space'], planets: ['Space'], astronomy: ['Space'],
  planet: ['Space'], solar: ['Space'], stars: ['Space'], star: ['Space'],
  moon: ['Space'], nasa: ['Space'], rocket: ['Space'], galaxy: ['Space'],
  universe: ['Space'], astronaut: ['Space'], mars: ['Space'],
  black: ['Space'], comet: ['Space'], asteroid: ['Space'],
  // Technology
  technology: ['Technology'], coding: ['Technology'], programming: ['Technology'],
  computers: ['Technology'], computer: ['Technology'], robots: ['Technology'],
  robotics: ['Technology'], internet: ['Technology'], digital: ['Technology'],
  html: ['Technology'], scratch: ['Technology'], code: ['Technology'],
  // Arts
  arts: ['Arts'], art: ['Arts'], drawing: ['Arts'], painting: ['Arts'],
  craft: ['Arts'], crafts: ['Arts'], sculpting: ['Arts'], origami: ['Arts'],
  creative: ['Arts'], draw: ['Arts'], colour: ['Arts'], color: ['Arts'],
  // Music
  music: ['Music'], songs: ['Music'], singing: ['Music'], song: ['Music'],
  instruments: ['Music'], piano: ['Music'], guitar: ['Music'],
  orchestra: ['Music'], classical: ['Music'], drum: ['Music'],
  // Cooking
  cooking: ['Cooking'], food: ['Cooking'], recipes: ['Cooking'],
  baking: ['Cooking'], chef: ['Cooking'], kitchen: ['Cooking'],
  recipe: ['Cooking'], healthy: ['Cooking'], smoothie: ['Cooking'],
  // Geography
  geography: ['Geography'], countries: ['Geography'], world: ['Geography'],
  maps: ['Geography'], continents: ['Geography'], cultures: ['Geography'],
  travel: ['Geography'], country: ['Geography'], africa: ['Geography'],
  europe: ['Geography'], asia: ['Geography'], ocean: ['Geography', 'Nature'],
  // Stories
  stories: ['Stories'], story: ['Stories'], books: ['Stories'],
  reading: ['Stories'], book: ['Stories'], fairy: ['Stories'],
  tales: ['Stories'], literature: ['Stories'],
  // Cartoons
  cartoons: ['Cartoons'], cartoon: ['Cartoons'], animation: ['Cartoons'],
  animated: ['Cartoons'], shows: ['Cartoons'], show: ['Cartoons'],
  // Sports
  sports: ['Sports'], sport: ['Sports'], exercise: ['Sports'],
  fitness: ['Sports'], football: ['Sports'], swimming: ['Sports'],
  yoga: ['Sports'], gymnastics: ['Sports'], athletics: ['Sports'],
  // Languages
  languages: ['Languages'], french: ['Languages'], spanish: ['Languages'],
  mandarin: ['Languages'], chinese: ['Languages'], language: ['Languages'],
  arabic: ['Languages'], sign: ['Languages'],
};

/** Comprehensive curated content database — 130+ items across 14 categories */
const CONTENT_DATABASE: DBItem[] = [
  // ── SCIENCE ──────────────────────────────────────────────────────────────
  { title: 'SciShow Kids – Why Is The Sky Blue?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Discover the fascinating science of light and wavelengths that makes our sky appear blue every single day.', whyRecommended: 'Perfect age-appropriate physics that builds real understanding from everyday observations.', platform: 'YouTube', safetyScore: 99, youtubeId: 'h3jPHrNtLoU', youtubeSearchQuery: 'SciShow Kids why is the sky blue', searchTags: ['science', 'light', 'physics', 'sky', 'blue'] },
  { title: 'SciShow Kids – What Is Gravity?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Explore the invisible force that keeps us on the ground and holds planets in orbit around the sun.', whyRecommended: 'Engaging explanation of a fundamental physics concept with fun demonstrations.', platform: 'YouTube', safetyScore: 99, youtubeId: 'R2GQRQVP-4Y', youtubeSearchQuery: 'SciShow Kids what is gravity', searchTags: ['science', 'gravity', 'physics', 'forces', 'planets'] },
  { title: 'SciShow Kids – The Water Cycle', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Follow a water droplet on its amazing journey through evaporation, clouds, rain, and back again.', whyRecommended: 'Excellent earth science content that connects weather to everyday life.', platform: 'YouTube', safetyScore: 99, youtubeId: 'al-do-HGuIk', youtubeSearchQuery: 'SciShow Kids water cycle explained', searchTags: ['science', 'water', 'rain', 'weather', 'cycle', 'clouds', 'evaporation'] },
  { title: 'SciShow Kids – How Does Photosynthesis Work?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Learn how plants turn sunlight, water, and air into food — the process that feeds almost all life on Earth.', whyRecommended: 'Core biology concept explained with beautiful animations and simple language.', platform: 'YouTube', safetyScore: 99, youtubeId: 'LlI5sEdaVyI', youtubeSearchQuery: 'SciShow Kids photosynthesis plants', searchTags: ['science', 'plants', 'biology', 'photosynthesis', 'sun', 'nature'] },
  { title: "SciShow Kids – What's an Atom?", type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Journey inside matter to discover atoms — the tiny building blocks that make up everything in the universe.', whyRecommended: 'Makes abstract chemistry concepts accessible and exciting for young minds.', platform: 'YouTube', safetyScore: 99, youtubeId: 'SolB1oq8nhI', youtubeSearchQuery: 'SciShow Kids what is an atom chemistry', searchTags: ['science', 'chemistry', 'atoms', 'molecules', 'matter'] },
  { title: 'SciShow Kids – Why Do Volcanoes Erupt?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Uncover the powerful geological forces inside the Earth that cause volcanoes to erupt dramatically.', whyRecommended: 'Combines geology and earth science with spectacular imagery kids love.', platform: 'YouTube', safetyScore: 98, youtubeId: 'lAmqsMXG3Io', youtubeSearchQuery: 'SciShow Kids volcanoes why do they erupt', searchTags: ['science', 'volcano', 'earth', 'geology', 'lava', 'eruption'] },
  { title: 'Crash Course Kids – The Scientific Method', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Learn how scientists ask questions, form hypotheses, test ideas, and draw conclusions from evidence.', whyRecommended: 'Teaches critical thinking and the process of inquiry used by scientists worldwide.', platform: 'YouTube', safetyScore: 98, youtubeId: 'yi0hwFDQTSQ', youtubeSearchQuery: 'Crash Course Kids scientific method', searchTags: ['science', 'scientific method', 'experiment', 'research', 'hypothesis'] },
  { title: 'Crash Course Kids – States of Matter', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Explore solids, liquids, gases, and plasma — the four states of matter and how they change into each other.', whyRecommended: 'Builds foundational chemistry knowledge with clear visuals and accessible explanations.', platform: 'YouTube', safetyScore: 98, youtubeId: 'dZp2ZXEEhIY', youtubeSearchQuery: 'Crash Course Kids states of matter solids liquids gases', searchTags: ['science', 'chemistry', 'matter', 'solids', 'liquids', 'gases', 'plasma'] },
  { title: 'Crash Course Kids – Food Webs and Ecosystems', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Discover how energy flows through food webs connecting plants, herbivores, carnivores, and decomposers.', whyRecommended: 'Outstanding biology content connecting living systems to the real world.', platform: 'YouTube', safetyScore: 98, youtubeId: '9aRPFEjWKsw', youtubeSearchQuery: 'Crash Course Kids food webs ecosystems', searchTags: ['science', 'nature', 'ecosystem', 'food web', 'biology', 'animals'] },
  { title: 'TED-Ed – How Do Vaccines Work?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'An animated journey inside the immune system to understand how vaccines train our bodies to fight disease.', whyRecommended: 'Critically important health literacy content presented with stunning animation.', platform: 'YouTube', safetyScore: 99, youtubeId: 'rb7TVW77ZCs', youtubeSearchQuery: 'TED-Ed how do vaccines work animation', searchTags: ['science', 'health', 'vaccines', 'biology', 'immune system', 'medicine', 'ted'] },
  { title: 'TED-Ed – What Is DNA and How Does It Work?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'A breathtaking animated look at the double helix of DNA and how it encodes all the instructions for life.', whyRecommended: 'Makes advanced biology approachable with stunning visuals and expert narration.', platform: 'YouTube', safetyScore: 98, youtubeId: 'zwibgNGe4aY', youtubeSearchQuery: 'TED-Ed what is DNA how does it work', searchTags: ['science', 'biology', 'dna', 'genetics', 'cells', 'ted'] },
  { title: 'The Magic School Bus – Inside the Earth', type: 'TV Show', category: 'Science', ageRating: 'G', description: "Ms Frizzle's class shrinks down to explore the Earth's layers — crust, mantle, and core — from the inside.", whyRecommended: 'A beloved classic that makes geology exciting through imaginative adventure.', platform: 'Netflix', safetyScore: 99, youtubeSearchQuery: 'Magic School Bus inside the earth geology', searchTags: ['science', 'earth', 'geology', 'layers', 'magic school bus'] },
  { title: 'Sid the Science Kid – Investigating Ramps', type: 'TV Show', category: 'Science', ageRating: 'G', description: 'Sid and his friends investigate how ramps work, learning about force, motion, and slope through play.', whyRecommended: 'Outstanding early science education using play-based learning that resonates with young children.', platform: 'PBS Kids', safetyScore: 100, youtubeSearchQuery: 'Sid the Science Kid PBS ramps forces motion', searchTags: ['science', 'physics', 'forces', 'motion', 'stem', 'preschool', 'sid'] },
  { title: 'SciShow Kids – Why Do We Dream?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'A fascinating look at what happens in our brains while we sleep and why we have dreams.', whyRecommended: 'Connects neuroscience to everyday experience, sparking curiosity about how the brain works.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'SciShow Kids why do we dream brain sleep', searchTags: ['science', 'brain', 'dreams', 'sleep', 'neuroscience', 'health'] },
  { title: "Bill Nye the Science Guy – Earth's Crust", type: 'TV Show', category: 'Science', ageRating: 'G', description: "Bill Nye's iconic series explores plate tectonics, earthquakes, and the geology of Earth's crust.", whyRecommended: 'Proven, classic science education with real experiments and infectious enthusiasm.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: "Bill Nye Science Guy earth's crust plate tectonics", searchTags: ['science', 'geology', 'earth', 'plates', 'earthquakes', 'bill nye'] },
  { title: 'PBS SciGirls – STEM Challenges', type: 'TV Show', category: 'Science', ageRating: 'G', description: 'Real girls use science, technology, engineering, and maths to solve fun real-world challenges.', whyRecommended: 'Excellent representation of girls in STEM with authentic problem-solving narratives.', platform: 'PBS Kids', safetyScore: 100, youtubeSearchQuery: 'PBS SciGirls STEM challenges for kids', searchTags: ['science', 'stem', 'engineering', 'technology', 'girls in stem'] },
  { title: 'Crash Course Kids – Energy Sources', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Explore renewable and non-renewable energy sources and learn how we power our modern world.', whyRecommended: 'Essential climate literacy content that empowers children to understand energy and the environment.', platform: 'YouTube', safetyScore: 98, youtubeId: 'M6E8R_9n9OE', youtubeSearchQuery: 'Crash Course Kids energy sources renewable fossil fuels', searchTags: ['science', 'energy', 'renewable', 'electricity', 'physics', 'environment', 'climate'] },
  { title: 'SciShow Kids – How Do Rainbows Form?', type: 'Educational Video', category: 'Science', ageRating: 'G', description: 'Use light, water, and prisms to understand why rainbows appear in the sky after rain.', whyRecommended: 'Beautiful optical science that children can explore for themselves at home.', platform: 'YouTube', safetyScore: 99, youtubeId: 'b1vMlnFW2ZY', youtubeSearchQuery: 'SciShow Kids how do rainbows form light prism', searchTags: ['science', 'light', 'rainbow', 'physics', 'optics', 'colour', 'rain'] },

  // ── HISTORY ──────────────────────────────────────────────────────────────
  { title: 'Horrible Histories – Terrible Tudors', type: 'TV Show', category: 'History', ageRating: 'PG', description: "The CBBC show brings Henry VIII's court and the Tudor dynasty to life with wild humour and real facts.", whyRecommended: 'Makes history memorable and fun without sacrificing accuracy — award-winning education.', platform: 'BBC iPlayer', safetyScore: 93, youtubeId: 'TfM2a2UWgYA', youtubeSearchQuery: 'Horrible Histories Terrible Tudors BBC', searchTags: ['history', 'tudor', 'henry viii', 'england', 'horrible histories', 'kings', 'queens'] },
  { title: 'Horrible Histories – Awful Egyptians', type: 'TV Show', category: 'History', ageRating: 'PG', description: 'Meet the pharaohs, explore pyramids, and discover the amazing science and culture of ancient Egypt.', whyRecommended: 'Highly engaging take on ancient history with authentic detail wrapped in comedy.', platform: 'BBC iPlayer', safetyScore: 93, youtubeId: 'qreFXLbUGKA', youtubeSearchQuery: 'Horrible Histories Awful Egyptians ancient Egypt BBC', searchTags: ['history', 'egypt', 'pharaoh', 'ancient', 'pyramid', 'mummies', 'horrible histories'] },
  { title: 'Horrible Histories – Vile Victorians', type: 'TV Show', category: 'History', ageRating: 'PG', description: "Explore Victorian Britain's dark side — child labour, workhouses, and the industrial revolution — with darkly comic flair.", whyRecommended: 'Tackles social history in a way that is both entertaining and genuinely educational.', platform: 'BBC iPlayer', safetyScore: 92, youtubeId: 'I8HMkfWFbYA', youtubeSearchQuery: 'Horrible Histories Vile Victorians BBC', searchTags: ['history', 'victorian', 'england', '19th century', 'industrial revolution', 'horrible histories'] },
  { title: "Horrible Histories – Savage Stone Age", type: 'TV Show', category: 'History', ageRating: 'PG', description: 'Journey back to prehistoric times to discover how our earliest ancestors hunted, cooked, and survived.', whyRecommended: 'Brilliant introduction to prehistoric history that sparks curiosity about human origins.', platform: 'BBC iPlayer', safetyScore: 92, youtubeId: 'gYFPGFe0vWs', youtubeSearchQuery: 'Horrible Histories Savage Stone Age prehistoric BBC', searchTags: ['history', 'stone age', 'prehistoric', 'ancient', 'cavemen', 'horrible histories'] },
  { title: "Liberty's Kids – The American Revolution", type: 'TV Show', category: 'History', ageRating: 'G', description: 'Follow young journalists reporting on the birth of the United States through the American Revolution.', whyRecommended: 'Excellent narrative approach that brings American history to life through relatable characters.', platform: 'YouTube', safetyScore: 97, youtubeId: 'H7h6AKHNFnw', youtubeSearchQuery: "Liberty's Kids American Revolution PBS", searchTags: ['history', 'american', 'revolution', 'usa', 'liberty', 'founding fathers', 'independence'] },
  { title: 'TED-Ed – The Rise and Fall of Rome', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'An animated deep-dive into how the Roman Republic became an empire and why it eventually collapsed.', whyRecommended: 'Masterful storytelling that connects ancient history to modern concepts of power and governance.', platform: 'YouTube', safetyScore: 97, youtubeId: 'PoV7oJGjYjk', youtubeSearchQuery: 'TED-Ed rise and fall of Roman Empire animation', searchTags: ['history', 'roman', 'rome', 'ancient', 'empire', 'caesar', 'ted'] },
  { title: 'TED-Ed – History of Ancient Egypt', type: 'Educational Video', category: 'History', ageRating: 'G', description: "From the unification of Upper and Lower Egypt to Cleopatra — 3000 years of one of history's greatest civilisations.", whyRecommended: 'Comprehensive and beautifully animated overview of one of the most popular historical topics.', platform: 'YouTube', safetyScore: 97, youtubeId: 'HltpGMfaMfM', youtubeSearchQuery: 'TED-Ed history of ancient Egypt civilisation animation', searchTags: ['history', 'egypt', 'pharaoh', 'ancient', 'pyramid', 'nile', 'cleopatra', 'ted'] },
  { title: 'TED-Ed – The Viking Age', type: 'Educational Video', category: 'History', ageRating: 'G', description: "Explore the Norse world of longships, raids, trade routes, and mythology that made the Vikings one of history's most fascinating peoples.", whyRecommended: "Dispels myths about Vikings while delivering genuinely interesting history in a compelling animated format.", platform: 'YouTube', safetyScore: 96, youtubeId: 'Hhv9BImopGU', youtubeSearchQuery: 'TED-Ed the Viking Age Norse history animation', searchTags: ['history', 'vikings', 'norse', 'scandinavia', 'medieval', 'mythology', 'ted'] },
  { title: 'TED-Ed – Ancient Greece and Democracy', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'Discover how ancient Athens invented democracy, philosophy, and the Olympics — foundations of Western civilisation.', whyRecommended: "Connects ancient ideas to modern values of democracy and citizenship in an engaging animated format.", platform: 'YouTube', safetyScore: 97, youtubeId: 'xuCn8ux2gbs', youtubeSearchQuery: 'TED-Ed ancient Greece democracy philosophy Athens animation', searchTags: ['history', 'greece', 'ancient', 'democracy', 'olympics', 'philosophy', 'ted'] },
  { title: 'TED-Ed – The Silk Road', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'Travel the ancient trade routes connecting China to the Mediterranean that shaped the ancient world.', whyRecommended: 'Excellent world history showing how cultures have always been interconnected through trade.', platform: 'YouTube', safetyScore: 97, youtubeId: 'vohrz5bRfSE', youtubeSearchQuery: 'TED-Ed the Silk Road ancient trade routes animation', searchTags: ['history', 'silk road', 'trade', 'ancient china', 'cultures', 'ted'] },
  { title: 'TED-Ed – How Did World War I Start?', type: 'Educational Video', category: 'History', ageRating: 'PG', description: 'Untangle the complex web of alliances, nationalism, and events that triggered the first global war in 1914.', whyRecommended: 'Outstanding modern history content that makes the causes of WWI genuinely understandable.', platform: 'YouTube', safetyScore: 94, youtubeId: 'Mun1dKkc_As', youtubeSearchQuery: 'TED-Ed how did World War 1 start causes animation', searchTags: ['history', 'world war', 'ww1', '20th century', 'war', 'europe', 'ted'] },
  { title: 'Crash Course Kids – Early Human Civilisations', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'From hunter-gatherers to the first cities — explore how early humans built the first civilisations in Mesopotamia.', whyRecommended: 'Well-structured overview of early human history that builds a strong chronological foundation.', platform: 'YouTube', safetyScore: 97, youtubeSearchQuery: 'Crash Course Kids early human civilisations Mesopotamia', searchTags: ['history', 'civilisation', 'ancient', 'mesopotamia', 'early humans', 'farming'] },
  { title: 'Kids vs. History – Ancient China', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'Explore the dynasties, the Great Wall, the Silk Road, and inventions of ancient Chinese civilisation.', whyRecommended: 'Engaging overview of Chinese history that broadens global historical perspective.', platform: 'YouTube', safetyScore: 97, youtubeSearchQuery: 'ancient China history for kids dynasties Great Wall', searchTags: ['history', 'china', 'ancient', 'dynasties', 'chinese', 'emperor', 'great wall'] },
  { title: "Horrible Histories – Groovy Greeks", type: 'TV Show', category: 'History', ageRating: 'PG', description: 'Laugh your way through ancient Greece — from Spartan warriors and Olympic games to Athenian democracy.', whyRecommended: 'Pairs the fun Horrible Histories format with genuinely important ancient history content.', platform: 'BBC iPlayer', safetyScore: 93, youtubeSearchQuery: 'Horrible Histories Groovy Greeks ancient Greece BBC', searchTags: ['history', 'greece', 'ancient', 'sparta', 'athens', 'olympics', 'horrible histories'] },
  { title: 'TED-Ed – How the Samurai Changed Japan', type: 'Educational Video', category: 'History', ageRating: 'G', description: "Discover the code of bushido, the feudal system, and how samurai warriors shaped Japanese culture for centuries.", whyRecommended: "Introduces students to Japanese history with beautiful animation and compelling narrative.", platform: 'YouTube', safetyScore: 96, youtubeSearchQuery: 'TED-Ed how samurai changed Japan feudal history animation', searchTags: ['history', 'japan', 'samurai', 'feudal', 'japanese', 'asia', 'bushido', 'ted'] },
  { title: 'DK Find Out! – The Age of Exploration', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'Follow Columbus, Magellan, and Vasco da Gama as European explorers mapped the globe in the 15th and 16th centuries.', whyRecommended: 'Excellent world history connecting geography and adventure with real historical figures.', platform: 'YouTube', safetyScore: 96, youtubeSearchQuery: 'DK Find Out age of exploration Columbus Magellan kids', searchTags: ['history', 'exploration', 'columbus', 'magellan', 'maps', 'geography', 'discovery'] },
  { title: 'BBC History – The Civil Rights Movement for Kids', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'Learn about Rosa Parks, Martin Luther King Jr., and the brave people who fought for equality in America.', whyRecommended: 'Essential social history that teaches children about justice, courage, and equality.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'civil rights movement for kids Martin Luther King Rosa Parks BBC', searchTags: ['history', 'civil rights', 'martin luther king', 'usa', 'equality', 'rosa parks', 'america'] },
  { title: 'TED-Ed – The Mayans: Advanced Civilisation', type: 'Educational Video', category: 'History', ageRating: 'G', description: 'Uncover the remarkable achievements of the Maya — their calendar, pyramids, astronomy, and writing system.', whyRecommended: 'Broadens historical understanding beyond Eurocentric history with a fascinating ancient civilisation.', platform: 'YouTube', safetyScore: 97, youtubeSearchQuery: 'TED-Ed Maya civilisation ancient history animation', searchTags: ['history', 'maya', 'mayan', 'ancient', 'civilisation', 'americas', 'pyramids', 'ted'] },

  // ── MATH ──────────────────────────────────────────────────────────────────
  { title: 'Numberblocks – Learn to Count', type: 'TV Show', category: 'Math', ageRating: 'G', description: 'Lovable number characters sing, dance, and adventure their way through the fundamentals of counting and arithmetic.', whyRecommended: 'Research-backed maths teaching proven to give children a strong numerical foundation.', platform: 'BBC', safetyScore: 100, youtubeId: 'okypbAk2nkI', youtubeSearchQuery: 'Numberblocks learn to count BBC CBeebies', searchTags: ['math', 'maths', 'numbers', 'counting', 'numberblocks', 'bbc', 'preschool'] },
  { title: 'Numberblocks – Multiplication Magic', type: 'TV Show', category: 'Math', ageRating: 'G', description: 'Watch number characters discover the patterns and magic of multiplication in fun and memorable adventures.', whyRecommended: 'Transforms abstract multiplication into visual, memorable experiences that make numbers click.', platform: 'BBC', safetyScore: 100, youtubeSearchQuery: 'Numberblocks multiplication BBC CBeebies', searchTags: ['math', 'maths', 'multiplication', 'times tables', 'numbers', 'numberblocks'] },
  { title: 'Math Antics – What Are Fractions?', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'A clear, step-by-step introduction to fractions — numerators, denominators, and how to think about parts of a whole.', whyRecommended: 'Exceptionally clear teaching that demystifies fractions for children who find them confusing.', platform: 'YouTube', safetyScore: 99, youtubeId: 'n0FZhQ_GkKw', youtubeSearchQuery: 'Math Antics what are fractions numerators denominators', searchTags: ['math', 'maths', 'fractions', 'division', 'numerator', 'denominator', 'parts'] },
  { title: 'Math Antics – Multiplying Numbers', type: 'Educational Video', category: 'Math', ageRating: 'G', description: "Master the times tables with Math Antics' structured, no-nonsense multiplication lessons.", whyRecommended: 'Crystal-clear explanations that build multiplication confidence and speed in a logical progression.', platform: 'YouTube', safetyScore: 99, youtubeId: 'oTeazmHBtE4', youtubeSearchQuery: 'Math Antics multiplying numbers times tables', searchTags: ['math', 'maths', 'multiplication', 'times tables', 'multiply', 'arithmetic'] },
  { title: 'Math Antics – Basic Geometry: Shapes', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'Explore 2D and 3D shapes, angles, lines, and the basic geometry that surrounds us every day.', whyRecommended: 'Lays strong foundations for spatial reasoning and geometric thinking in a fun visual way.', platform: 'YouTube', safetyScore: 99, youtubeId: 'qzHHnlULFhc', youtubeSearchQuery: 'Math Antics basic geometry shapes angles 2D 3D', searchTags: ['math', 'maths', 'geometry', 'shapes', 'angles', 'lines', '2d', '3d'] },
  { title: 'SciShow Kids – Maths in Nature (Fibonacci)', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'Spot the Fibonacci sequence in sunflowers, shells, and leaves — where nature and mathematics meet beautifully.', whyRecommended: 'Inspires wonder about mathematics by revealing its hidden presence in the natural world.', platform: 'YouTube', safetyScore: 99, youtubeId: 'kkGeOWYOFoA', youtubeSearchQuery: 'SciShow Kids maths in nature Fibonacci sequence', searchTags: ['math', 'maths', 'nature', 'patterns', 'fibonacci', 'sequence', 'shapes'] },
  { title: 'Khan Academy Kids – Addition and Subtraction', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'Fun interactive lessons covering addition, subtraction, and early number sense for foundation-level learners.', whyRecommended: "Adaptive learning from one of the world's most trusted educational platforms for children.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Khan Academy kids addition subtraction early maths', searchTags: ['math', 'maths', 'addition', 'subtraction', 'numbers', 'khan academy', 'early learning'] },
  { title: 'Times Tables Rock Stars – Times Tables Songs', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'Rock-themed songs and challenges that make learning the times tables genuinely entertaining and memorable.', whyRecommended: 'Using music to encode multiplication facts is proven to improve retention and enjoyment.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Times Tables Rock Stars songs multiplication kids', searchTags: ['math', 'maths', 'times tables', 'multiplication', 'number', 'songs', 'music'] },
  { title: 'Alphablocks – Numbers and Counting', type: 'TV Show', category: 'Math', ageRating: 'G', description: 'The creators of Alphablocks bring number characters to life in this companion series for early maths learners.', whyRecommended: 'From the trusted BBC team behind Alphablocks — a proven, research-backed approach to early numeracy.', platform: 'BBC', safetyScore: 100, youtubeSearchQuery: 'Alphablocks numbers counting BBC CBeebies', searchTags: ['math', 'maths', 'numbers', 'counting', 'alphablocks', 'bbc', 'preschool', 'early learning'] },
  { title: 'Math Antics – Long Division', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'Step-by-step guide to long division that breaks down this tricky operation into manageable, logical steps.', whyRecommended: 'Makes one of the most feared maths operations accessible and less intimidating for all learners.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'Math Antics long division step by step', searchTags: ['math', 'maths', 'division', 'long division', 'arithmetic', 'numbers'] },
  { title: 'PBS Kids – Curious George Counts', type: 'TV Show', category: 'Math', ageRating: 'G', description: 'Curious George applies maths to everyday situations, making numbers feel natural, fun, and useful.', whyRecommended: 'Embeds mathematical thinking within a beloved character-driven narrative children already know and love.', platform: 'PBS Kids', safetyScore: 100, youtubeSearchQuery: 'Curious George counting numbers maths PBS Kids', searchTags: ['math', 'maths', 'counting', 'numbers', 'curious george', 'pbs kids', 'preschool'] },
  { title: 'Crash Course Kids – Measurement', type: 'Educational Video', category: 'Math', ageRating: 'G', description: 'Learn about length, mass, volume, and temperature — how we measure the world around us with precision.', whyRecommended: 'Connects maths to practical, real-world measurement skills children will use throughout their lives.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'Crash Course Kids measurement length mass volume', searchTags: ['math', 'maths', 'measurement', 'length', 'mass', 'volume', 'units'] },

  // ── NATURE ────────────────────────────────────────────────────────────────
  { title: 'Wild Kratts – Animal Adaptations', type: 'TV Show', category: 'Nature', ageRating: 'G', description: 'Chris and Martin Kratt use their creature power suits to explore how animals adapt to survive in their habitats.', whyRecommended: 'Combines exciting adventure with genuine wildlife education and scientific vocabulary.', platform: 'PBS Kids', safetyScore: 99, youtubeId: 'A9E2rM5EKkI', youtubeSearchQuery: 'Wild Kratts animal adaptations PBS Kids', searchTags: ['nature', 'animals', 'adaptation', 'wildlife', 'wild kratts', 'habitat', 'pbs'] },
  { title: 'SciShow Kids – Why Do Leaves Change Colour?', type: 'Educational Video', category: 'Nature', ageRating: 'G', description: 'Uncover the science of chlorophyll and pigments that creates the spectacular autumn colour display.', whyRecommended: "Connects seasonal observation to plant biology in a way that encourages children to notice the world around them.", platform: 'YouTube', safetyScore: 99, youtubeId: 'GqCLFNqLHdM', youtubeSearchQuery: 'SciShow Kids why do leaves change colour autumn', searchTags: ['nature', 'leaves', 'autumn', 'trees', 'plants', 'seasons', 'chlorophyll'] },
  { title: "National Geographic Kids – Ocean Giants", type: 'Educational Video', category: 'Nature', ageRating: 'G', description: 'Meet the blue whale, manta ray, and other ocean giants in this stunning underwater exploration.', whyRecommended: 'Breathtaking footage inspires awe for marine life and the importance of ocean conservation.', platform: 'YouTube', safetyScore: 98, youtubeId: 'ZRLipHlBmYM', youtubeSearchQuery: 'National Geographic Kids ocean giants blue whale marine life', searchTags: ['nature', 'ocean', 'sea', 'marine', 'whale', 'coral reef', 'national geographic'] },
  { title: 'Blue Planet II – Ocean Wonders', type: 'Documentary', category: 'Nature', ageRating: 'G', description: "BBC's landmark ocean documentary with David Attenborough, revealing the beauty and secrets of our planet's seas.", whyRecommended: 'Award-winning cinematography and narration that creates genuine wonder and environmental awareness.', platform: 'BBC', safetyScore: 99, youtubeSearchQuery: 'Blue Planet II ocean wonders BBC Attenborough children', searchTags: ['nature', 'ocean', 'sea', 'blue planet', 'marine', 'fish', 'whale', 'attenborough', 'bbc'] },
  { title: 'Crash Course Kids – Biomes of the World', type: 'Educational Video', category: 'Nature', ageRating: 'G', description: 'Journey through tundra, desert, tropical rainforest, grassland, and more to understand the major biomes on Earth.', whyRecommended: "Builds comprehensive environmental literacy helping children understand Earth's diverse ecosystems.", platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'Crash Course Kids biomes ecosystems rainforest tundra desert', searchTags: ['nature', 'biomes', 'ecosystem', 'environment', 'rainforest', 'desert', 'tundra'] },
  { title: 'BBC Earth – Amazing Insects', type: 'Documentary', category: 'Nature', ageRating: 'G', description: 'The incredible world of insects — ants building cities, bees making honey, and fireflies lighting up the night.', whyRecommended: "Showcases the often-overlooked insect world with BBC's legendary production quality.", platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'BBC Earth amazing insects ants bees fireflies nature', searchTags: ['nature', 'insects', 'bugs', 'ants', 'bees', 'bbc', 'wildlife'] },
  { title: 'Octonauts – Underwater Discoveries', type: 'TV Show', category: 'Nature', ageRating: 'G', description: 'Captain Barnacles leads a crew of brave underwater explorers as they rescue sea creatures and explore the ocean.', whyRecommended: 'Introduces real marine biology concepts wrapped in an irresistibly fun adventure format.', platform: 'Netflix', safetyScore: 100, youtubeSearchQuery: 'Octonauts underwater ocean adventures Netflix', searchTags: ['nature', 'ocean', 'sea', 'underwater', 'octonauts', 'marine', 'rescue', 'animals'] },
  { title: 'Puffin Rock – Seaside Adventures', type: 'TV Show', category: 'Nature', ageRating: 'G', description: "Narrated by Chris O'Dowd, young puffin Oona explores her rocky island home alongside brother Baba.", whyRecommended: "Delightfully gentle nature documentary for young children narrated with warmth and real wildlife footage.", platform: 'Netflix', safetyScore: 100, youtubeSearchQuery: 'Puffin Rock Netflix nature documentary children', searchTags: ['nature', 'birds', 'ocean', 'puffins', 'seaside', 'wildlife', 'nest'] },
  { title: 'SciShow Kids – How Do Trees Grow?', type: 'Educational Video', category: 'Nature', ageRating: 'G', description: 'From a tiny seed to a towering tree — the remarkable biology of how trees grow, breathe, and feed.', whyRecommended: 'Connects botany to everyday surroundings, encouraging children to look at trees with fresh curiosity.', platform: 'YouTube', safetyScore: 99, youtubeId: 'pu5KM3mCMgQ', youtubeSearchQuery: 'SciShow Kids how do trees grow seeds plants biology', searchTags: ['nature', 'trees', 'plants', 'forest', 'photosynthesis', 'growth', 'seeds'] },
  { title: 'Wild Kratts – Deep Sea Creatures', type: 'TV Show', category: 'Nature', ageRating: 'G', description: 'Dive into the pitch-black ocean depths to discover the glowing, bizarre, and incredible creatures that live there.', whyRecommended: 'Opens up one of the least explored environments on Earth to young curiosity with scientific accuracy.', platform: 'PBS Kids', safetyScore: 99, youtubeSearchQuery: 'Wild Kratts deep sea creatures ocean PBS Kids', searchTags: ['nature', 'ocean', 'deep sea', 'sea creatures', 'wild kratts', 'bioluminescence', 'marine'] },
  { title: 'BBC Earth – Life in the Arctic', type: 'Documentary', category: 'Nature', ageRating: 'G', description: 'Polar bears, arctic foxes, and walruses battle the extreme cold of the Arctic in this breathtaking documentary.', whyRecommended: 'Spectacular BBC production showing animal resilience that naturally raises questions about climate change.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'BBC Earth life in the Arctic polar bear arctic fox', searchTags: ['nature', 'arctic', 'polar bear', 'ice', 'cold', 'habitat', 'bbc', 'wildlife'] },
  { title: 'Planet Earth – Rainforests', type: 'Documentary', category: 'Nature', ageRating: 'G', description: "BBC's landmark series captures the dazzling biodiversity of tropical rainforests with extraordinary footage.", whyRecommended: 'The gold standard of nature documentary, combining education with breathtaking cinematography.', platform: 'BBC', safetyScore: 99, youtubeSearchQuery: 'Planet Earth rainforest BBC Attenborough nature children', searchTags: ['nature', 'rainforest', 'jungle', 'animals', 'planet earth', 'bbc', 'biodiversity', 'attenborough'] },

  // ── ANIMALS ──────────────────────────────────────────────────────────────
  { title: 'National Geographic Kids – Lion Pride', type: 'Educational Video', category: 'Animals', ageRating: 'G', description: "Follow a pride of lions on the African savannah — hunting, raising cubs, and living in one of nature\'s most social families.", whyRecommended: "National Geographic's world-class wildlife footage delivers authentic learning about Africa's iconic big cat.", platform: 'YouTube', safetyScore: 98, youtubeId: 'aYFnXMfFEv0', youtubeSearchQuery: 'National Geographic Kids lion pride Africa savannah', searchTags: ['animals', 'lion', 'africa', 'wildlife', 'national geographic', 'big cat', 'safari'] },
  { title: 'BBC Earth – Amazing Baby Animals', type: 'Documentary', category: 'Animals', ageRating: 'G', description: 'Watch baby elephants, lion cubs, baby dolphins, and other newborn animals take their first steps into the world.', whyRecommended: "Irresistibly warm content that makes children care deeply about wildlife and conservation.", platform: 'YouTube', safetyScore: 100, youtubeId: '5n8NyJmVICQ', youtubeSearchQuery: 'BBC Earth amazing baby animals cute wildlife', searchTags: ['animals', 'baby animals', 'cute', 'wildlife', 'bbc', 'elephants', 'cubs', 'dolphins'] },
  { title: 'Wild Kratts – Dolphins: Ocean Acrobats', type: 'TV Show', category: 'Animals', ageRating: 'G', description: "Swim alongside bottlenose dolphins to discover their extraordinary intelligence, communication, and acrobatic skills.", whyRecommended: 'Teaches kids about marine mammal intelligence in an action-packed, scientifically accurate format.', platform: 'PBS Kids', safetyScore: 99, youtubeSearchQuery: 'Wild Kratts dolphins ocean PBS Kids episode', searchTags: ['animals', 'dolphins', 'ocean', 'marine', 'wild kratts', 'intelligence', 'mammals'] },
  { title: 'National Geographic Kids – Sharks Uncovered', type: 'Educational Video', category: 'Animals', ageRating: 'G', description: 'Bust the myths about sharks! Learn about great whites, hammerheads, and the vital role sharks play in ocean health.', whyRecommended: "Replaces fear with respect and fascination — critical for ocean conservation awareness in children.", platform: 'YouTube', safetyScore: 97, youtubeSearchQuery: 'National Geographic Kids sharks facts ocean uncovered', searchTags: ['animals', 'sharks', 'ocean', 'fish', 'marine', 'national geographic', 'great white', 'hammerhead'] },
  { title: 'BBC Earth – Elephant Family Journey', type: 'Documentary', category: 'Animals', ageRating: 'G', description: 'Follow a multigenerational elephant family across the African savannah as they search for water and food.', whyRecommended: "Showcases elephant social intelligence and family bonds in BBC's signature compelling style.", platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'BBC Earth elephant family journey Africa savannah', searchTags: ['animals', 'elephant', 'africa', 'big animals', 'wildlife', 'bbc', 'herd', 'savannah'] },
  { title: 'Wild Kratts – Cheetah: Speed Champion', type: 'TV Show', category: 'Animals', ageRating: 'G', description: "Discover how the cheetah became the world's fastest land animal and the science behind its incredible sprinting ability.", whyRecommended: "Combines physics and biology to explain real animal adaptations in Wild Kratts' signature fun format.", platform: 'PBS Kids', safetyScore: 99, youtubeSearchQuery: 'Wild Kratts cheetah speed champion fastest animal PBS', searchTags: ['animals', 'cheetah', 'africa', 'speed', 'wild kratts', 'fast', 'predator', 'adaptation'] },
  { title: 'National Geographic Kids – Polar Bears', type: 'Educational Video', category: 'Animals', ageRating: 'G', description: "Learn how polar bears survive the extreme Arctic cold, hunt seals on sea ice, and raise their cubs.", whyRecommended: 'Naturally introduces climate change as children learn how warming threatens polar bear habitats.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'National Geographic Kids polar bears Arctic survival', searchTags: ['animals', 'polar bear', 'arctic', 'ice', 'national geographic', 'climate', 'survive'] },
  { title: 'BBC Earth – The World of Penguins', type: 'Documentary', category: 'Animals', ageRating: 'G', description: 'From emperor penguins braving Antarctic blizzards to little blue penguins in New Zealand — the diverse penguin family.', whyRecommended: "One of the most beloved animal documentaries — combines humour, drama, and genuine wildlife science.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'BBC Earth penguin documentary emperor Antarctica', searchTags: ['animals', 'penguins', 'antarctica', 'birds', 'bbc', 'ice', 'fishing', 'flightless'] },
  { title: 'Wild Kratts – The Amazing Octopus', type: 'TV Show', category: 'Animals', ageRating: 'G', description: "Explore the master of disguise — the octopus and its extraordinary intelligence, camouflage, and problem-solving.", whyRecommended: "Highlights octopus intelligence in ways that genuinely astonish children and teachers alike.", platform: 'PBS Kids', safetyScore: 99, youtubeSearchQuery: 'Wild Kratts amazing octopus camouflage intelligence PBS', searchTags: ['animals', 'octopus', 'ocean', 'sea', 'wild kratts', 'intelligence', 'camouflage'] },
  { title: 'National Geographic Kids – Wolves', type: 'Documentary', category: 'Animals', ageRating: 'G', description: 'Discover the social lives, hunting techniques, and vital ecological role of wolf packs in the wild.', whyRecommended: 'Challenges misconceptions about wolves while teaching children about apex predators and ecosystems.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'National Geographic Kids wolves pack nature wildlife', searchTags: ['animals', 'wolves', 'forest', 'pack', 'wildlife', 'national geographic', 'predator'] },
  { title: 'BBC Earth – Birds of Paradise', type: 'Documentary', category: 'Animals', ageRating: 'G', description: "New Guinea's birds of paradise perform the world's most elaborate courtship dances in stunning BBC footage.", whyRecommended: "Spectacular, unique wildlife footage that builds wonder and curiosity about evolutionary biology.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'BBC Earth birds of paradise courtship dance New Guinea', searchTags: ['animals', 'birds', 'bird of paradise', 'wildlife', 'bbc', 'colour', 'evolution'] },
  { title: 'Wild Kratts – Whale Rescue', type: 'TV Show', category: 'Animals', ageRating: 'G', description: 'Join the Kratts as they help a stranded humpback whale while learning about whale migration and songs.', whyRecommended: 'Builds empathy for marine life while teaching real conservation science in a dramatic storyline.', platform: 'PBS Kids', safetyScore: 99, youtubeSearchQuery: 'Wild Kratts whale rescue humpback PBS Kids episode', searchTags: ['animals', 'whale', 'ocean', 'humpback', 'wild kratts', 'conservation', 'marine', 'rescue'] },

  // ── SPACE ──────────────────────────────────────────────────────────────────
  { title: 'SciShow Kids – Tour of the Solar System', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'Visit all eight planets, the asteroid belt, and the outer edges of our solar system on an animated tour.', whyRecommended: 'Comprehensive and engaging introduction to planetary science that excites genuine astronomical interest.', platform: 'YouTube', safetyScore: 99, youtubeId: 'mhHuDZSaOfU', youtubeSearchQuery: 'SciShow Kids tour of the solar system planets', searchTags: ['space', 'solar system', 'planets', 'sun', 'moon', 'astronomy', 'orbit'] },
  { title: 'SciShow Kids – What Are Stars Made Of?', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'From the life cycle of stars to supernovas — discover what makes these giant balls of fire burn in the night sky.', whyRecommended: 'Makes stellar astrophysics accessible and awe-inspiring for curious young minds.', platform: 'YouTube', safetyScore: 99, youtubeId: 'TBnBjWm60GU', youtubeSearchQuery: 'SciShow Kids what are stars made of astrophysics', searchTags: ['space', 'stars', 'sun', 'light', 'astronomy', 'supernova', 'nuclear fusion'] },
  { title: 'SciShow Kids – How Big Is the Universe?', type: 'Educational Video', category: 'Space', ageRating: 'G', description: "Use light years, galaxies, and mind-bending comparisons to grasp the universe's almost incomprehensible size.", whyRecommended: 'Inspires profound cosmic wonder while building real understanding of astronomical scale.', platform: 'YouTube', safetyScore: 99, youtubeId: 'pCJ_LdUgQw4', youtubeSearchQuery: 'SciShow Kids how big is the universe light years galaxies', searchTags: ['space', 'universe', 'size', 'astronomy', 'galaxies', 'light years', 'infinity'] },
  { title: 'SciShow Kids – What Makes a Planet?', type: 'Educational Video', category: 'Space', ageRating: 'G', description: "Why is Pluto no longer a planet? Discover the definition of a planet and what differentiates it from dwarf planets.", whyRecommended: "Uses the Pluto debate to teach children that science evolves — a powerful lesson in scientific thinking.", platform: 'YouTube', safetyScore: 99, youtubeId: 'L1aQDGDXFM4', youtubeSearchQuery: 'SciShow Kids what makes a planet Pluto dwarf planet', searchTags: ['space', 'planets', 'pluto', 'solar system', 'astronomy', 'dwarf planet'] },
  { title: 'NASA Kids – Exploring Mars', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'Ride along with NASA rovers Perseverance and Curiosity as they explore the red planet for signs of past life.', whyRecommended: "Real NASA mission content that lets children dream about being the astronauts who'll one day walk on Mars.", platform: 'YouTube', safetyScore: 99, youtubeId: 'libKVRa01L8', youtubeSearchQuery: 'NASA Kids exploring Mars rovers Perseverance Curiosity', searchTags: ['space', 'mars', 'planets', 'nasa', 'rover', 'exploration', 'red planet'] },
  { title: 'TED-Ed – How Does the Universe Work?', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'A beautifully animated journey through the Big Bang, dark matter, dark energy, and the structure of the universe.', whyRecommended: 'Handles cosmology at a level that is both accessible to children and genuinely mind-expanding.', platform: 'YouTube', safetyScore: 98, youtubeId: 'sE4YbGcKQi0', youtubeSearchQuery: 'TED-Ed how does the universe work Big Bang cosmology animation', searchTags: ['space', 'universe', 'big bang', 'dark matter', 'astronomy', 'ted', 'cosmology'] },
  { title: 'NASA Kids – Living on the Space Station', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'Real astronauts aboard the International Space Station show what eating, sleeping, and exercising in space is really like.', whyRecommended: 'Authentic footage from orbit makes space exploration tangible and inspires the next generation of astronauts.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'NASA Kids living on the International Space Station astronauts', searchTags: ['space', 'space station', 'iss', 'astronaut', 'nasa', 'gravity', 'orbit', 'zero gravity'] },
  { title: 'National Geographic Kids – Black Holes', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'What happens when a massive star collapses? Explore the mind-bending physics of black holes and event horizons.', whyRecommended: 'Makes one of the most mysterious phenomena in the universe accessible and thrilling for young astronomers.', platform: 'YouTube', safetyScore: 98, youtubeId: 'e-P5IFTqB98', youtubeSearchQuery: 'National Geographic Kids black holes space astronomy', searchTags: ['space', 'black hole', 'galaxy', 'astronomy', 'national geographic', 'physics', 'event horizon'] },
  { title: "Crash Course Kids – Earth's Moon", type: 'Educational Video', category: 'Space', ageRating: 'G', description: "Explore the Moon's origins, its phases, its effect on Earth's tides, and the history of lunar exploration.", whyRecommended: 'Connects familiar moon observations (phases, tides) to deeper astronomical science.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: "Crash Course Kids Earth's moon phases tides lunar", searchTags: ['space', 'moon', 'lunar', 'tides', 'phases', 'astronomy', 'earth', 'apollo'] },
  { title: 'SciShow Kids – Comets: Cosmic Snowballs', type: 'Educational Video', category: 'Space', ageRating: 'G', description: "Discover what comets are made of, where they come from, and why ancient people thought they were omens.", whyRecommended: "Combines astronomy with history for a fascinating look at one of space's most dramatic visitors.", platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'SciShow Kids comets cosmic snowballs astronomy', searchTags: ['space', 'comets', 'asteroids', 'solar system', 'astronomy', 'ice'] },
  { title: 'TED-Ed – How to Become an Astronaut', type: 'Educational Video', category: 'Space', ageRating: 'G', description: 'From training underwater to learning Russian — discover what it actually takes to become a NASA astronaut.', whyRecommended: 'Inspires career aspirations while delivering genuine content about space exploration and science.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'TED-Ed how to become an astronaut NASA training animation', searchTags: ['space', 'astronaut', 'nasa', 'training', 'rocket', 'career', 'ted'] },
  { title: 'National Geographic Kids – Saturn and Its Rings', type: 'Educational Video', category: 'Space', ageRating: 'G', description: "Saturn's iconic rings are made of billions of ice and rock particles — explore the science behind this stunning spectacle.", whyRecommended: 'The planet children ask about most, given its most captivating and memorable content.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'National Geographic Kids Saturn rings planets solar system', searchTags: ['space', 'saturn', 'rings', 'planets', 'solar system', 'astronomy', 'national geographic'] },

  // ── TECHNOLOGY ──────────────────────────────────────────────────────────
  { title: 'Code.org – Intro to Computer Science for Kids', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'Embark on a guided journey into programming using fun block-based coding with famous characters as guides.', whyRecommended: 'The most accessible and well-structured introduction to coding available for young learners.', platform: 'YouTube', safetyScore: 100, youtubeId: 'OAx_6-wdslM', youtubeSearchQuery: 'Code.org intro to computer science for kids programming', searchTags: ['technology', 'coding', 'programming', 'computer science', 'code', 'block coding', 'stem'] },
  { title: 'SciShow Kids – How Do Computers Work?', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'From transistors to RAM to the CPU — a kid-friendly breakdown of what is happening inside every computer.', whyRecommended: 'Essential digital literacy that demystifies computers and empowers children to understand the technology they use daily.', platform: 'YouTube', safetyScore: 99, youtubeId: 'QXP0fJJVBRU', youtubeSearchQuery: 'SciShow Kids how do computers work CPU RAM transistors', searchTags: ['technology', 'computers', 'how computers work', 'science', 'stem', 'cpu', 'hardware'] },
  { title: 'TED-Ed – How the Internet Works', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'Packets, routers, IP addresses, and servers — a beautifully animated explanation of the global internet infrastructure.', whyRecommended: 'Crucial digital literacy for the 21st century, explained clearly with no jargon for young learners.', platform: 'YouTube', safetyScore: 99, youtubeId: 'x3c1ih2NJEg', youtubeSearchQuery: 'TED-Ed how the internet works packets routers animation', searchTags: ['technology', 'internet', 'how internet works', 'ted', 'digital', 'network', 'wifi'] },
  { title: 'SciShow Kids – What Are Robots?', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'From factory robots to Mars rovers — explore what robots are, how they are programmed, and where they work.', whyRecommended: "Makes robotics tangible by connecting it to machines children have already heard about, from rovers to vacuum bots.", platform: 'YouTube', safetyScore: 99, youtubeId: 'nzBV8bCFB9k', youtubeSearchQuery: 'SciShow Kids what are robots robotics programming', searchTags: ['technology', 'robots', 'robotics', 'stem', 'programming', 'artificial intelligence', 'machines'] },
  { title: 'Scratch – Learn to Code by Making Games', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'Use MIT Scratch to create your own animated stories, interactive games, and art — real programming, made for kids.', whyRecommended: 'The world-standard beginner coding tool — children create something real from the very first lesson.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Scratch learn to code make games MIT programming kids', searchTags: ['technology', 'coding', 'scratch', 'programming', 'games', 'mit', 'animation', 'creative'] },
  { title: 'BBC Bitesize – Introduction to Computing', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'Algorithms, debugging, binary, and networks — BBC Bitesize covers the key concepts of the computing curriculum.', whyRecommended: 'Directly aligned to the computing curriculum with clear, no-nonsense explanations from a trusted educational source.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'BBC Bitesize computing algorithms binary networks introduction', searchTags: ['technology', 'computing', 'bbc', 'digital literacy', 'computers', 'algorithms', 'binary'] },
  { title: 'TED-Ed – What Is Artificial Intelligence?', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: "A clear and fair-minded look at what AI actually is — machine learning, neural networks, and what it can't do.", whyRecommended: "Prepares children to think critically about AI — one of the most important digital literacy topics today.", platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'TED-Ed what is artificial intelligence machine learning animation', searchTags: ['technology', 'artificial intelligence', 'ai', 'machine learning', 'robots', 'future', 'ted'] },
  { title: 'Google CS First – Creative Coding Projects', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: "Use Scratch to create music visualisers, fashion shows, and interactive stories using Google's free coding curriculum.", whyRecommended: "Google's free curriculum provides world-class coding education with engaging creative project themes.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Google CS First Scratch creative coding projects kids', searchTags: ['technology', 'coding', 'programming', 'google', 'projects', 'scratch', 'creative', 'cs first'] },
  { title: 'Khan Academy – Intro to HTML and Web Pages', type: 'Educational Video', category: 'Technology', ageRating: 'G', description: "Build your first web page using HTML tags — learn how the world's websites are actually constructed.", whyRecommended: 'Learning to build real web pages is the most empowering introduction to technology a child can have.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Khan Academy intro to HTML web pages for kids programming', searchTags: ['technology', 'coding', 'html', 'website', 'khan academy', 'web', 'programming'] },
  { title: "SciShow Kids – How GPS Works", type: 'Educational Video', category: 'Technology', ageRating: 'G', description: 'Satellites, signals, and triangulation — the surprisingly clever science that lets your phone know exactly where you are.', whyRecommended: 'Connects everyday technology to fascinating physics, inspiring curiosity about the systems that run modern life.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'SciShow Kids how does GPS work satellites signals', searchTags: ['technology', 'gps', 'satellites', 'space', 'navigation', 'stem', 'science'] },

  // ── ARTS ──────────────────────────────────────────────────────────────────
  { title: 'Art for Kids Hub – How to Draw a Dragon', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: 'Follow step-by-step instructions to draw an epic fire-breathing dragon — perfect for all skill levels.', whyRecommended: 'Accessible and encouraging art instruction that builds confidence through achievable creative success.', platform: 'YouTube', safetyScore: 100, youtubeId: 'Yjpgz5pnFhE', youtubeSearchQuery: 'Art for Kids Hub how to draw a dragon step by step', searchTags: ['arts', 'art', 'drawing', 'how to draw', 'dragon', 'creative'] },
  { title: 'Art for Kids Hub – Watercolour Painting Basics', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: 'Learn blending, wet-on-wet technique, and colour mixing with watercolours in this beginner-friendly painting lesson.', whyRecommended: 'Nurtures fine motor skills and colour theory understanding through hands-on creative practice.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Art for Kids Hub watercolour painting basics techniques beginner', searchTags: ['arts', 'art', 'painting', 'watercolour', 'creative', 'colour', 'technique'] },
  { title: 'Art with Mati and Dada – Famous Painters', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: 'Meet Picasso, Van Gogh, Monet, and Frida Kahlo through the eyes of Mati and Dada in beautiful animated storytelling.', whyRecommended: 'Introduces great artists and art history in a wonderfully accessible and imaginative format.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'Art with Mati and Dada famous painters Picasso Van Gogh', searchTags: ['arts', 'art', 'famous artists', 'painters', 'history of art', 'picasso', 'van gogh', 'monet'] },
  { title: 'MoMA Art Lab – Creating with Shapes', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: "The Museum of Modern Art's kids platform guides children to create abstract art inspired by Matisse and Mondrian.", whyRecommended: "Using world-class museum content to make modern art accessible is an inspired approach to art education.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'MoMA Art Lab for kids shapes creating abstract Matisse', searchTags: ['arts', 'art', 'modern art', 'museum', 'creative', 'shapes', 'abstract', 'moma'] },
  { title: 'TED-Ed – Why Is the Mona Lisa So Famous?', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: "Explore why Leonardo da Vinci's small portrait became the most famous painting in the world.", whyRecommended: 'Uses cultural history to spark genuine curiosity about art, fame, and what makes something great.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'TED-Ed why is the Mona Lisa famous Leonardo da Vinci animation', searchTags: ['arts', 'art', 'mona lisa', 'da vinci', 'renaissance', 'history', 'ted', 'painting'] },
  { title: 'Origami for Kids – Easy Animals', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: 'Fold paper cranes, frogs, and butterflies with clear step-by-step origami instructions for young beginners.', whyRecommended: 'Develops patience, following instructions, fine motor skills, and spatial reasoning through ancient Japanese art.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'origami for kids easy animals step by step paper folding', searchTags: ['arts', 'craft', 'origami', 'paper folding', 'creative', 'japan', 'animals', 'hands on'] },
  { title: 'National Gallery – Art for Kids', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: 'Curators from the National Gallery London explain the stories and techniques in their most famous paintings.', whyRecommended: 'World-class museum content that makes great paintings feel personal and accessible to young visitors.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: "National Gallery London art for kids paintings curator children's", searchTags: ['arts', 'art', 'gallery', 'paintings', 'museum', 'national gallery', 'london', 'famous art'] },
  { title: 'Tate Kids – What Is Modern Art?', type: 'Educational Video', category: 'Arts', ageRating: 'G', description: 'The Tate gallery explains abstract, conceptual, and modern art in ways that challenge and delight young viewers.', whyRecommended: 'Encourages open-minded thinking and teaches children that art can mean many things and spark debate.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Tate Kids what is modern art abstract conceptual explained children', searchTags: ['arts', 'art', 'modern art', 'tate', 'gallery', 'creative', 'abstract', 'conceptual'] },

  // ── MUSIC ──────────────────────────────────────────────────────────────────
  { title: 'Sesame Street – Classic Learning Songs', type: 'TV Show', category: 'Music', ageRating: 'G', description: "Big Bird, Elmo, and the Sesame Street gang sing timeless educational songs about letters, numbers, and feelings.", whyRecommended: 'Decades of research-backed music education that has proven its effectiveness with generations of children.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Sesame Street classic learning songs Elmo Big Bird alphabet', searchTags: ['music', 'songs', 'singing', 'learning', 'sesame street', 'nursery rhymes', 'alphabet'] },
  { title: "Classical Baby – Mozart's Magic", type: 'Educational Video', category: 'Music', ageRating: 'G', description: "Beautifully animated sequences paired with Mozart's greatest compositions introduce classical music to young ears.", whyRecommended: 'Early exposure to classical music builds musical vocabulary, pattern recognition, and aesthetic appreciation.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: "Classical Baby Mozart's magic classical music for children", searchTags: ['music', 'classical', 'mozart', 'orchestra', 'instruments', 'symphony', 'beethoven'] },
  { title: 'TED-Ed – How Does Music Affect the Brain?', type: 'Educational Video', category: 'Music', ageRating: 'G', description: 'Discover why music gives us chills, makes us dance, and why it can help us learn other subjects more effectively.', whyRecommended: 'The science behind music motivates children to engage with music as both listeners and performers.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: 'TED-Ed how does music affect the brain emotion learning animation', searchTags: ['music', 'how music works', 'brain', 'science', 'emotion', 'ted', 'learning'] },
  { title: 'Little Baby Bum – Nursery Rhymes', type: 'TV Show', category: 'Music', ageRating: 'G', description: 'Beloved nursery rhymes with colourful 3D animations including Wheels on the Bus, Twinkle Twinkle, and more.', whyRecommended: 'Nursery rhymes build phonological awareness and lay crucial foundations for language development.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Little Baby Bum nursery rhymes wheels on the bus twinkle', searchTags: ['music', 'nursery rhymes', 'songs', 'babies', 'young children', 'twinkle', 'singing'] },
  { title: 'PBS Kids – Daniel Tiger Music and Songs', type: 'TV Show', category: 'Music', ageRating: 'G', description: 'Daniel Tiger sings simple, memorable songs that teach social-emotional skills and self-regulation strategies.', whyRecommended: 'Music as emotional intelligence — teaching children to regulate emotions through simple, memorable melodies.', platform: 'PBS Kids', safetyScore: 100, youtubeSearchQuery: 'Daniel Tiger music songs emotions PBS Kids social emotional', searchTags: ['music', 'songs', 'emotions', 'daniel tiger', 'pbs', 'feelings', 'social skills'] },
  { title: 'World Music Journey – African Drums', type: 'Educational Video', category: 'Music', ageRating: 'G', description: 'Experience the rhythms and instruments of West African music, from talking drums to balafon and kora.', whyRecommended: 'Broadens musical horizons and builds cultural appreciation through the rich traditions of African music.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'world music for kids African drums West Africa rhythms culture', searchTags: ['music', 'world music', 'africa', 'drums', 'percussion', 'culture', 'rhythm', 'instruments'] },
  { title: 'Piano Lessons for Kids – Complete Beginners', type: 'Educational Video', category: 'Music', ageRating: 'G', description: 'Start playing piano from scratch — notes, scales, hand position, and your first songs in a child-friendly format.', whyRecommended: "Learning an instrument builds discipline, dexterity, and mathematical thinking alongside musical enjoyment.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'piano lessons for kids complete beginners notes scales', searchTags: ['music', 'piano', 'instruments', 'learn music', 'beginners', 'notes', 'scales'] },
  { title: 'Cbeebies – Nursery Rhyme Time', type: 'TV Show', category: 'Music', ageRating: 'G', description: "BBC's CBeebies presents classic and new nursery rhymes performed with enthusiasm, dance, and colourful animation.", whyRecommended: "BBC quality production makes musical education joyful and accessible for the youngest children.", platform: 'BBC', safetyScore: 100, youtubeSearchQuery: 'CBeebies nursery rhyme time BBC songs children', searchTags: ['music', 'nursery rhymes', 'songs', 'bbc', 'cbeebies', 'preschool', 'dance', 'singing'] },

  // ── COOKING ──────────────────────────────────────────────────────────────
  { title: 'Junior Chef – Healthy Smoothie Bowls', type: 'Educational Video', category: 'Cooking', ageRating: 'G', description: 'Learn to blend delicious and nutritious smoothie bowls with fruit, granola, and seeds in this kid-friendly cooking lesson.', whyRecommended: 'Teaches healthy eating habits and kitchen confidence through a simple, fun recipe children love.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'junior chef healthy smoothie bowls kids cooking recipe', searchTags: ['cooking', 'food', 'smoothie', 'healthy', 'fruit', 'recipe', 'nutrition'] },
  { title: 'Kids Can Cook – Homemade Pasta', type: 'Educational Video', category: 'Cooking', ageRating: 'G', description: 'Mix, knead, roll, and cut real pasta dough from scratch — a tactile cooking experience kids absolutely love.', whyRecommended: 'Making food from scratch teaches patience, science, and the joy of creating something delicious yourself.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'kids can cook homemade pasta from scratch recipe dough', searchTags: ['cooking', 'food', 'pasta', 'recipe', 'kitchen', 'chef', 'dough', 'italian'] },
  { title: "Young Chefs Academy – Baking a Loaf of Bread", type: 'Educational Video', category: 'Cooking', ageRating: 'G', description: 'Discover the science of yeast, gluten, and rising as you bake a proper loaf of bread from scratch.', whyRecommended: 'Perfect blend of science and cooking — children learn chemistry while making something genuinely useful.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: "Young Chefs Academy baking bread loaf yeast kids recipe", searchTags: ['cooking', 'baking', 'bread', 'kitchen', 'recipe', 'yeast', 'science', 'chemistry'] },
  { title: 'Kids Kitchen – Rainbow Veggie Wraps', type: 'Educational Video', category: 'Cooking', ageRating: 'G', description: 'Chop colourful vegetables, make hummus, and assemble beautiful, healthy wraps in this vibrant cooking lesson.', whyRecommended: 'Encourages vegetable eating and food preparation skills through colourful, appealing visual presentation.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'kids kitchen rainbow veggie wraps healthy recipe children', searchTags: ['cooking', 'food', 'vegetables', 'healthy', 'recipe', 'kitchen', 'lunch', 'colour'] },
  { title: "Sesame Street – Healthy Eating with Elmo", type: 'TV Show', category: 'Cooking', ageRating: 'G', description: 'Elmo and the Sesame Street gang explore where food comes from, what makes food healthy, and how to cook simple dishes.', whyRecommended: 'Leverages the beloved Sesame Street brand to build positive associations with healthy foods from an early age.', platform: 'PBS Kids', safetyScore: 100, youtubeSearchQuery: 'Sesame Street healthy eating Elmo cooking food nutrition', searchTags: ['cooking', 'food', 'healthy', 'sesame street', 'elmo', 'nutrition', 'vegetables', 'preschool'] },
  { title: 'Science of Cooking – Why Does Bread Rise?', type: 'Educational Video', category: 'Cooking', ageRating: 'G', description: 'Yeast, carbon dioxide, and gluten networks — the fascinating food science that makes bread light and fluffy.', whyRecommended: 'Shows children that cooking is applied chemistry, building bridges between science and everyday life.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'science of cooking why does bread rise yeast chemistry kids', searchTags: ['cooking', 'science', 'bread', 'baking', 'yeast', 'chemistry', 'food', 'biology'] },
  { title: "Junior Bake Off – Children's Competition", type: 'TV Show', category: 'Cooking', ageRating: 'G', description: 'Young bakers aged 9–15 compete in technical challenges and showstoppers in the most wholesome baking competition on TV.', whyRecommended: 'Inspires baking ambition and shows children that cooking is a real and impressive skill worth developing.', platform: 'Channel 4', safetyScore: 98, youtubeSearchQuery: "Junior Bake Off children's baking competition Channel 4", searchTags: ['cooking', 'baking', 'competition', 'cakes', 'bread', 'junior', 'show', 'recipes'] },

  // ── GEOGRAPHY ──────────────────────────────────────────────────────────────
  { title: 'National Geographic Kids – Continents and Countries', type: 'Educational Video', category: 'Geography', ageRating: 'G', description: 'A tour of all seven continents covering their countries, landmarks, climates, and unique wildlife.', whyRecommended: 'Builds core geographical knowledge with stunning visual content from the world leaders in geography education.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'National Geographic Kids continents countries world geography', searchTags: ['geography', 'countries', 'world', 'continents', 'maps', 'national geographic', 'landmarks'] },
  { title: 'TED-Ed – How to Read a Map', type: 'Educational Video', category: 'Geography', ageRating: 'G', description: 'Scale, compass rose, contour lines, and grid references — the key skills needed to understand any map.', whyRecommended: 'Practical map-reading skills with real-world applications, taught in a clear, logical progression.', platform: 'YouTube', safetyScore: 98, youtubeId: 'oTeazmHBtE4', youtubeSearchQuery: 'TED-Ed how to read a map scale contour lines compass', searchTags: ['geography', 'maps', 'reading maps', 'navigation', 'scale', 'contour', 'ted'] },
  { title: 'BBC Bitesize – Rivers and the Water Cycle', type: 'Educational Video', category: 'Geography', ageRating: 'G', description: 'From mountain springs to the sea — how rivers shape landscapes, create features, and connect to the wider water cycle.', whyRecommended: 'Core physical geography taught by a trusted educational partner aligned to the school curriculum.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'BBC Bitesize rivers water cycle physical geography children', searchTags: ['geography', 'rivers', 'water cycle', 'landscape', 'physical geography', 'bbc', 'erosion'] },
  { title: 'National Geographic – The Amazon Rainforest', type: 'Documentary', category: 'Geography', ageRating: 'G', description: 'Explore the lungs of the Earth — its biodiversity, indigenous communities, and the urgent threats it faces.', whyRecommended: 'Combines geography, ecology, and environmental activism into one of the most important topics on the planet.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'National Geographic Amazon rainforest geography biodiversity children', searchTags: ['geography', 'amazon', 'rainforest', 'south america', 'national geographic', 'environment', 'brazil'] },
  { title: "Crash Course Kids – Earth's Hemispheres", type: 'Educational Video', category: 'Geography', ageRating: 'G', description: 'Why do seasons happen in reverse on opposite sides of the equator? Explore hemispheres, latitude, and longitude.', whyRecommended: 'Makes abstract geographical concepts like hemisphere and latitude concrete through relatable examples.', platform: 'YouTube', safetyScore: 98, youtubeSearchQuery: "Crash Course Kids Earth's hemispheres latitude longitude seasons", searchTags: ['geography', 'hemispheres', 'latitude', 'longitude', 'seasons', 'equator', 'earth science'] },
  { title: 'Geography Now – Japan', type: 'Educational Video', category: 'Geography', ageRating: 'G', description: 'A thorough, engaging tour of Japan — its geography, culture, history, politics, and fascinating facts.', whyRecommended: "Geography Now's methodical, enthusiastic approach makes learning about countries genuinely exciting.", platform: 'YouTube', safetyScore: 97, youtubeSearchQuery: 'Geography Now Japan country culture geography facts', searchTags: ['geography', 'japan', 'countries', 'culture', 'asia', 'facts', 'world'] },
  { title: 'BBC Bitesize – Climate Zones of the World', type: 'Educational Video', category: 'Geography', ageRating: 'G', description: "Polar, temperate, tropical, arid — learn how the distance from the equator shapes a region\'s climate and ecosystems.", whyRecommended: 'Foundational geographical knowledge connecting climate science to everyday experiences and environments.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'BBC Bitesize climate zones world tropical polar temperate', searchTags: ['geography', 'climate', 'climate zones', 'tropical', 'polar', 'desert', 'biomes', 'bbc'] },
  { title: 'Kids vs World – Amazing Africa Facts', type: 'Educational Video', category: 'Geography', ageRating: 'G', description: 'Discover the 54 countries, seven wonders, diverse cultures, and incredible wildlife of the African continent.', whyRecommended: 'Celebrates African geography, culture, and history — providing a positive and thorough continent profile.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'amazing Africa facts for kids geography countries wildlife cultures', searchTags: ['geography', 'africa', 'continent', 'countries', 'cultures', 'wildlife', 'sahara', 'nile'] },

  // ── STORIES ────────────────────────────────────────────────────────────────
  { title: 'Storyline Online – Where the Wild Things Are', type: 'Educational Video', category: 'Stories', ageRating: 'G', description: "Maurice Sendak's classic picture book read aloud by a celebrity reader with beautiful illustrations.", whyRecommended: 'Builds a love of reading and discusses big emotions like anger and longing in a safe, imaginative context.', platform: 'YouTube', safetyScore: 100, youtubeId: 'iq0PzZ9UMks', youtubeSearchQuery: 'Storyline Online Where the Wild Things Are read aloud children', searchTags: ['stories', 'books', 'reading', 'where the wild things are', 'classic', 'picture book', 'emotions'] },
  { title: 'Storyline Online – The Giving Tree', type: 'Educational Video', category: 'Stories', ageRating: 'G', description: "Shel Silverstein's moving tale of generosity read by a celebrity with warm illustrations on Storyline Online.", whyRecommended: "Explores generosity, unconditional love, and growing up through one of the most beloved children\'s books.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Storyline Online The Giving Tree Shel Silverstein read aloud', searchTags: ['stories', 'books', 'reading', 'giving tree', 'shel silverstein', 'kindness', 'trees'] },
  { title: "Matilda the Musical", type: 'Movie', category: 'Stories', ageRating: 'PG', description: "A brilliant girl with extraordinary gifts triumphs over cruelty in Roald Dahl's beloved story, reimagined as a musical.", whyRecommended: 'Celebrates intelligence, justice, and courage — a powerful message wrapped in spectacular musical numbers.', platform: 'Netflix', safetyScore: 94, youtubeSearchQuery: 'Matilda the Musical Netflix Roald Dahl film', searchTags: ['stories', 'film', 'matilda', 'books', 'reading', 'musical', 'roald dahl', 'netflix'] },
  { title: "James and the Giant Peach", type: 'Movie', category: 'Stories', ageRating: 'G', description: "Roald Dahl's fantastical tale of James, a giant peach, and a cast of oversized insects on an adventure to New York.", whyRecommended: "Imagination, friendship, and bravery are celebrated in one of the most inventive children\'s stories ever written.", platform: 'Disney+', safetyScore: 96, youtubeSearchQuery: 'James and the Giant Peach Roald Dahl animated film', searchTags: ['stories', 'film', 'roald dahl', 'james giant peach', 'adventure', 'fantasy', 'insects'] },
  { title: "BBC CBeebies – Bedtime Stories", type: 'TV Show', category: 'Stories', ageRating: 'G', description: 'Celebrity guests read a calming bedtime story every night in this beloved BBC tradition, with beautiful illustrations.', whyRecommended: 'The perfect wind-down routine that builds love of reading and language through nightly storytelling.', platform: 'BBC', safetyScore: 100, youtubeSearchQuery: 'BBC CBeebies Bedtime Stories celebrity reading children', searchTags: ['stories', 'books', 'reading', 'bedtime', 'cbeebies', 'bbc', 'celebrity', 'calm'] },
  { title: "Reading Rainbow – Book Club Adventures", type: 'Educational Video', category: 'Stories', ageRating: 'G', description: "LeVar Burton's classic show introduces children to the joy of books, exploring themes and introducing great stories.", whyRecommended: 'An iconic reading motivation show that has inspired millions of children to pick up a book.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Reading Rainbow book club LeVar Burton children books', searchTags: ['stories', 'books', 'reading', 'reading rainbow', 'library', 'literature', 'LeVar Burton'] },
  { title: "Fantastic Mr Fox – Roald Dahl", type: 'Movie', category: 'Stories', ageRating: 'PG', description: "Wes Anderson's stop-motion masterpiece brings Roald Dahl's cunning fox to life in a stylishly funny family film.", whyRecommended: 'A visually gorgeous film that pairs brilliantly with reading the book — introducing children to both Dahl and Anderson.', platform: 'Disney+', safetyScore: 95, youtubeSearchQuery: 'Fantastic Mr Fox Wes Anderson Roald Dahl animated film', searchTags: ['stories', 'film', 'roald dahl', 'fantastic mr fox', 'animation', 'animals', 'adventure'] },
  { title: "Pixar – The Art of Great Storytelling", type: 'Educational Video', category: 'Stories', ageRating: 'G', description: "Pixar's storytelling team shares the rules, beats, and secrets behind creating stories that move audiences..", whyRecommended: 'Inspires young storytellers while teaching narrative structure used by the greatest animated films ever made.', platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'Pixar storytelling rules art of story children writing', searchTags: ['stories', 'storytelling', 'film', 'animation', 'pixar', 'creative writing', 'narrative'] },
  { title: "Classic Fairy Tales – Brothers Grimm Animated", type: 'TV Show', category: 'Stories', ageRating: 'G', description: "Hansel and Gretel, Cinderella, Rapunzel — Brothers Grimm classics in beautifully drawn animated versions.", whyRecommended: 'Foundational stories of Western literature that explore themes of courage, kindness, and consequences.', platform: 'YouTube', safetyScore: 97, youtubeSearchQuery: 'Brothers Grimm fairy tales animated children Cinderella Rapunzel', searchTags: ['stories', 'fairy tales', 'classic', 'grimm', 'animated', 'cinderella', 'rapunzel', 'hansel gretel'] },
  { title: "Roald Dahl's The BFG", type: 'Movie', category: 'Stories', ageRating: 'PG', description: "Steven Spielberg's magical adaptation of Roald Dahl's story of a Big Friendly Giant who befriends a young girl.", whyRecommended: 'Celebrates the power of unlikely friendships and imagination in a technically spectacular family film.', platform: 'Disney+', safetyScore: 95, youtubeSearchQuery: 'The BFG Roald Dahl Spielberg film fantasy children', searchTags: ['stories', 'film', 'bfg', 'roald dahl', 'giant', 'fantasy', 'friendship', 'dreams'] },

  // ── CARTOONS ──────────────────────────────────────────────────────────────
  { title: "Bluey – Family Adventures", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: 'A lovable Blue Heeler puppy and her hilarious family navigate imaginative games, big emotions, and family life in Brisbane.', whyRecommended: 'Exceptional family values, emotional intelligence, and the importance of play — the best family show on TV.', platform: 'Disney+', safetyScore: 100, youtubeSearchQuery: 'Bluey episodes Disney+ family adventures Australia', searchTags: ['cartoons', 'animation', 'bluey', 'family', 'australia', 'games', 'emotions', 'dogs'] },
  { title: "Peppa Pig – Muddy Puddles and Adventures", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Peppa, George, and their family of pigs enjoy simple, cheerful everyday adventures in Peppa's friendly neighbourhood.", whyRecommended: 'Gentle, positive stories that model healthy family communication and social relationships for young children.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Peppa Pig muddy puddles family adventures episodes', searchTags: ['cartoons', 'animation', 'peppa pig', 'family', 'preschool', 'george', 'pigs'] },
  { title: "The Octonauts – Ocean Rescue Missions", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: 'A crew of adventurous animal explorers dive into the ocean depths, rescue sea creatures, and discover marine mysteries.', whyRecommended: 'Introduces real marine biology and ocean science wrapped in an irresistibly fun adventure format.', platform: 'Netflix', safetyScore: 100, youtubeSearchQuery: 'Octonauts ocean rescue missions Netflix BBC episodes', searchTags: ['cartoons', 'animation', 'octonauts', 'ocean', 'adventure', 'nature', 'rescue', 'animals'] },
  { title: "Hilda – Nordic Folklore Adventures", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Hilda befriends trolls, giants, and spirits as she explores the magical wilderness around her town of Trolberg.", whyRecommended: 'Celebrates bravery, friendship, and nature through gorgeous Nordic-inspired animation with real emotional depth.', platform: 'Netflix', safetyScore: 98, youtubeSearchQuery: 'Hilda Netflix animated series Nordic folklore adventures', searchTags: ['cartoons', 'animation', 'hilda', 'adventure', 'fantasy', 'nature', 'magic', 'trolls', 'nordic'] },
  { title: "Hey Duggee – Badge Collecting", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Duggee and the Squirrel Club earn badges by doing activities, learning new skills, and discovering the world around them.", whyRecommended: 'Educational, gentle, and funny — the perfect show for younger children with subtle jokes adults enjoy too.', platform: 'BBC', safetyScore: 100, youtubeSearchQuery: 'Hey Duggee badge collecting BBC CBeebies episodes', searchTags: ['cartoons', 'animation', 'hey duggee', 'badges', 'activities', 'preschool', 'bbc', 'squirrels'] },
  { title: "Shaun the Sheep – Farm Adventures", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Shaun the sheep outwits the farmer and leads the flock in silent, slapstick comedy adventures on the farm.", whyRecommended: "Dialogue-free animation builds inference skills and proves that stories can be told powerfully without words.", platform: 'BBC', safetyScore: 100, youtubeSearchQuery: 'Shaun the Sheep farm adventures BBC episodes', searchTags: ['cartoons', 'animation', 'shaun the sheep', 'comedy', 'slapstick', 'bbc', 'farm', 'aardman'] },
  { title: "Over the Garden Wall – Autumn Mystery", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Two brothers wander through an enchanting but mysterious autumnal forest called the Unknown in this unique miniseries.", whyRecommended: 'Atmospheric, literary cartoon that rewards older children with humour, folklore, and genuine mystery.', platform: 'Netflix', safetyScore: 97, youtubeSearchQuery: 'Over the Garden Wall Cartoon Network autumn mystery miniseries', searchTags: ['cartoons', 'animation', 'over the garden wall', 'mystery', 'autumn', 'forest', 'adventure'] },
  { title: "Kipo and the Age of Wonderbeasts", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Kipo Oak ventures into a post-apocalyptic world filled with mutant animals and discovers a society built on music.", whyRecommended: 'Celebrates diversity, music, and empathy in a wildly imaginative world with refreshingly positive messages.', platform: 'Netflix', safetyScore: 98, youtubeSearchQuery: 'Kipo and the Age of Wonderbeasts Netflix animated', searchTags: ['cartoons', 'animation', 'kipo', 'adventure', 'fantasy', 'diversity', 'music', 'wonderbeasts'] },
  { title: "Paw Patrol – Team Rescue Adventures", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "Ryder and his team of rescue pups use their special vehicles and skills to keep Adventure Bay safe.", whyRecommended: "Models teamwork, problem-solving, and community service in an exciting, accessible format for young children.", platform: 'Paramount+', safetyScore: 100, youtubeSearchQuery: 'Paw Patrol team rescue adventures Ryder episodes', searchTags: ['cartoons', 'animation', 'paw patrol', 'rescue', 'dogs', 'teamwork', 'adventure', 'ryder'] },
  { title: "Moomin – Scandinavian Magic", type: 'TV Show', category: 'Cartoons', ageRating: 'G', description: "The beloved Moomin family explores their valley of magical creatures, seasons, and philosophical adventures.", whyRecommended: 'Classic Scandinavian storytelling that explores nature, friendship, and life with quiet wisdom and charm.', platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Moomin animated series Scandinavian classic children episodes', searchTags: ['cartoons', 'animation', 'moomin', 'nordic', 'adventure', 'friendship', 'nature', 'finland'] },
  { title: "The Dragon Prince – Epic Fantasy", type: 'TV Show', category: 'Cartoons', ageRating: 'PG', description: "Two human princes and an elven assassin join forces to bring peace to a divided land in this beautifully animated fantasy.", whyRecommended: "Exceptional world-building with diverse characters, strong ethical themes, and compelling adventure storytelling.", platform: 'Netflix', safetyScore: 95, youtubeSearchQuery: 'The Dragon Prince Netflix animated fantasy epic series', searchTags: ['cartoons', 'animation', 'dragon prince', 'fantasy', 'adventure', 'elves', 'diversity'] },
  { title: "Gravity Falls – Mystery in Gravity Falls", type: 'TV Show', category: 'Cartoons', ageRating: 'PG', description: "Twins Dipper and Mabel spend the summer with their great-uncle in a weird, mystery-filled Oregon town.", whyRecommended: "Brilliant mystery-comedy that rewards curious children who love puzzles, codes, and unexpected twists.", platform: 'Disney+', safetyScore: 93, youtubeSearchQuery: 'Gravity Falls Mystery Disney+ animated series episodes', searchTags: ['cartoons', 'animation', 'gravity falls', 'mystery', 'comedy', 'twins', 'adventure', 'disney'] },

  // ── SPORTS ─────────────────────────────────────────────────────────────────
  { title: "Cosmic Kids Yoga – Adventure Yoga", type: 'Educational Video', category: 'Sports', ageRating: 'G', description: "Jamie Amor leads children through yoga poses woven into stories about space, animals, and fairy tales.", whyRecommended: "Combines mindfulness, physical exercise, and storytelling into a uniquely beneficial experience for young bodies and minds.", platform: 'YouTube', safetyScore: 100, youtubeId: 'o7YJtM_WUkQ', youtubeSearchQuery: 'Cosmic Kids Yoga adventure stories Jamie Amor children', searchTags: ['sports', 'yoga', 'exercise', 'fitness', 'mindfulness', 'flexibility', 'breathing', 'stories'] },
  { title: "PE with Joe – Kids Home Workout", type: 'Educational Video', category: 'Sports', ageRating: 'G', description: "Joe Wicks' popular 30-minute PE sessions designed specifically for children — fun, sweaty, and accessible at home.", whyRecommended: "Joe Wicks' energy and expertise make exercise genuinely exciting — perfect for building healthy active habits.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: "PE with Joe Wicks kids home workout exercise", searchTags: ['sports', 'exercise', 'fitness', 'workout', 'pe', 'joe wicks', 'cardio', 'movement'] },
  { title: "BBC Sport – How Football Works", type: 'Educational Video', category: 'Sports', ageRating: 'G', description: "The rules, positions, tactics, and skills that make football the world's most popular sport, explained clearly.", whyRecommended: "Sport literacy alongside physical activity motivation — understanding the game enhances the experience of playing it.", platform: 'YouTube', safetyScore: 99, youtubeSearchQuery: 'BBC Sport how football works rules positions tactics children', searchTags: ['sports', 'football', 'soccer', 'rules', 'bbc', 'tactics', 'positions'] },
  { title: "Olympic Kids – Sports and Values", type: 'Educational Video', category: 'Sports', ageRating: 'G', description: "Learn about Olympic sports from swimming to gymnastics, and the values of excellence, respect, and friendship.", whyRecommended: "Inspires sporting ambition while teaching the values of fair play, dedication, and global sportsmanship.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Olympic Kids sports values gymnastics swimming children Olympics', searchTags: ['sports', 'olympics', 'exercise', 'fitness', 'gymnastics', 'swimming', 'athletics'] },
  { title: "BBC Bitesize – History of the Olympics", type: 'Educational Video', category: 'Sports', ageRating: 'G', description: "From ancient Greece to the modern games — the fascinating 2,700-year history of the greatest sporting event on Earth.", whyRecommended: "Bridges history and sports education — appealing to both history lovers and sports enthusiasts.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'BBC Bitesize history of the Olympics ancient Greece modern games', searchTags: ['sports', 'olympics', 'history', 'greece', 'ancient', 'athletics', 'bbc', 'competition'] },
  { title: "Beginner Swimming Lessons – Learn to Swim", type: 'Educational Video', category: 'Sports', ageRating: 'G', description: "Qualified swim coaches guide children through basic swimming techniques — floating, kicking, and breathing.", whyRecommended: "Swimming is a vital life skill — learning technique from qualified instructors builds water safety confidence.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'beginner swimming lessons for kids learn to swim technique', searchTags: ['sports', 'swimming', 'water sports', 'exercise', 'fitness', 'water safety', 'beginners'] },

  // ── LANGUAGES ──────────────────────────────────────────────────────────────
  { title: "Dora the Explorer – Learn Spanish Together", type: 'TV Show', category: 'Languages', ageRating: 'G', description: "Dora and her monkey Boots guide children through Spanish vocabulary in exciting adventures across different environments.", whyRecommended: "Made language learning feel like adventure for a generation of children — still highly effective for Spanish basics.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Dora the Explorer learn Spanish together adventures Boots', searchTags: ['languages', 'spanish', 'dora', 'learning', 'bilingual', 'vocabulary', 'preschool'] },
  { title: "TED-Ed – Why Learn a Second Language?", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "The brain science of bilingualism — why learning a second language makes you smarter, more creative, and more empathetic.", whyRecommended: "Motivates children to embrace language learning by explaining the remarkable cognitive benefits of bilingualism.", platform: 'YouTube', safetyScore: 99, youtubeId: 'ap77oJGjYjk', youtubeSearchQuery: 'TED-Ed why learn a second language bilingualism brain animation', searchTags: ['languages', 'learning languages', 'bilingual', 'brain', 'ted', 'motivation'] },
  { title: "French with Alexa – Kids French Lessons", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "Structured, fun French lessons starting from zero — colours, numbers, animals, greetings, and everyday vocabulary.", whyRecommended: "Clear, patient teaching style perfectly suited to children starting French for the very first time.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'French with Alexa kids French lessons beginners colours numbers', searchTags: ['languages', 'french', 'learning french', 'beginners', 'vocabulary', 'greetings', 'numbers'] },
  { title: "Learn Mandarin Chinese for Kids", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "Animated characters introduce Mandarin tones, basic vocabulary, greetings, numbers, and simple phrases.", whyRecommended: "Starting Mandarin young, when accent and tone acquisition is easiest, gives a lifelong advantage.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'learn Mandarin Chinese for kids beginners tones vocabulary animated', searchTags: ['languages', 'mandarin', 'chinese', 'learning', 'vocabulary', 'tones', 'beginners'] },
  { title: "British Sign Language for Kids", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "Learn BSL signs for animals, food, family, greetings, and basic conversation in this clear, child-friendly tutorial.", whyRecommended: "Learning sign language builds inclusion, communication, and respect for the deaf community from an early age.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'British Sign Language for kids BSL beginners animals food greetings', searchTags: ['languages', 'sign language', 'bsl', 'asl', 'accessibility', 'deaf', 'communication', 'inclusion'] },
  { title: "Spanish Songs for Kids – Colours and Numbers", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "Catchy Spanish songs that teach colours, numbers 1–20, days of the week, and months in an entertaining musical format.", whyRecommended: "Music-based language learning is among the most effective methods for young children — highly memorable.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Spanish songs for kids colours numbers days of week music', searchTags: ['languages', 'spanish', 'songs', 'music', 'colours', 'numbers', 'vocabulary', 'learning'] },
  { title: "Arabic for Kids – Beginners", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "Learn the Arabic alphabet, greetings, numbers, and common words through colourful animations and simple exercises.", whyRecommended: "Arabic is the fifth most spoken language — early exposure opens doors to culture, literature, and the wider world.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Arabic for kids beginners alphabet greetings numbers animated', searchTags: ['languages', 'arabic', 'learning arabic', 'alphabet', 'middle east', 'greetings', 'beginners'] },
  { title: "Duolingo Kids – Language Adventures", type: 'Educational Video', category: 'Languages', ageRating: 'G', description: "The world's most popular language app explains how it teaches Spanish, French, German, and more to young beginners.", whyRecommended: "Duolingo has gamified language learning — understanding how it works motivates children to engage with the app.", platform: 'YouTube', safetyScore: 100, youtubeSearchQuery: 'Duolingo kids language learning Spanish French German adventures', searchTags: ['languages', 'duolingo', 'learning', 'vocabulary', 'bilingual', 'spanish', 'french', 'german'] },
];

/** Maps query tokens to matched category names and does fuzzy title/tag matching */
function mockAISearch(query: string, childId: number): SearchResponse {
  const children = getMockChildren();
  const child = children.find(c => c.id === childId);
  const queryLower = query.toLowerCase().trim();
  const tokens = queryLower.split(/\s+/).filter(Boolean);

  // Collect categories matched by keywords
  const matchedCategories = new Set<string>();
  for (const token of tokens) {
    const cats = TOPIC_KEYWORDS[token];
    if (cats) cats.forEach(c => matchedCategories.add(c));
  }
  // Also check multi-word keyword phrases
  for (const [phrase, cats] of Object.entries(TOPIC_KEYWORDS)) {
    if (phrase.includes(' ') && queryLower.includes(phrase)) {
      cats.forEach(c => matchedCategories.add(c));
    }
  }

  let results: DBItem[];

  if (matchedCategories.size > 0) {
    // Primary: items whose category matches the detected topics
    const primary = CONTENT_DATABASE.filter(item => matchedCategories.has(item.category));
    // Secondary: items whose tags or title contain any query token (other categories)
    const secondary = CONTENT_DATABASE.filter(item => {
      if (matchedCategories.has(item.category)) return false;
      return tokens.some(t =>
        item.title.toLowerCase().includes(t) ||
        item.searchTags.some(tag => tag.includes(t))
      );
    });
    results = [...primary, ...secondary];
  } else {
    // Generic text search across title, description, and tags
    results = CONTENT_DATABASE.filter(item =>
      tokens.some(t =>
        item.title.toLowerCase().includes(t) ||
        item.description.toLowerCase().includes(t) ||
        item.searchTags.some(tag => tag.includes(t))
      )
    );
    if (results.length === 0) {
      // Fallback: return a diverse sampler
      results = CONTENT_DATABASE.filter((_, i) => i % 8 === 0);
    }
  }

  // Apply child restrictions if profile exists
  if (child) {
    if (child.max_content_rating === 'G') {
      results = results.filter(r => r.ageRating === 'G');
    } else if (child.max_content_rating === 'PG') {
      results = results.filter(r => r.ageRating !== 'PG-13');
    }
    if (child.blocked_keywords && child.blocked_keywords.length > 0) {
      results = results.filter(r =>
        !child.blocked_keywords!.some(kw =>
          r.title.toLowerCase().includes(kw.toLowerCase()) ||
          r.description.toLowerCase().includes(kw.toLowerCase())
        )
      );
    }
  }

  return {
    query,
    childName: child?.name || 'Child',
    recommendations: results.slice(0, 30),
    generatedAt: new Date().toISOString(),
  };
}

function mockSuggestions(childId: number): SuggestionsResponse {
  const children = getMockChildren();
  const child = children.find(c => c.id === childId);
  // Pick one item from each category for variety
  const seen = new Set<string>();
  const suggestions = CONTENT_DATABASE.filter(item => {
    if (seen.has(item.category)) return false;
    seen.add(item.category);
    return true;
  }).slice(0, 12);
  return {
    childName: child?.name || 'Child',
    recommendations: suggestions,
    generatedAt: new Date().toISOString(),
  };
}

export { extractError };
export default api;
