# 🛡️ KidsSafe AI Platform

**A full-stack web application that helps parents keep their children safe online using AI-powered content filtering.**

Module: CMS22204 | Student: Alessio Akabuogu

---

## What is KidsSafe?

KidsSafe is a platform where parents set the rules and children explore freely — knowing that every piece of content they see has been reviewed by AI and approved by their parent. Parents can block topics, set age ratings, limit screen time, and create separate profiles for each child. Children get a fun, colourful space to search for shows, videos, and movies — all filtered to be safe for their age.

---

## Tech Stack

| Part | Technology |
|---|---|
| Frontend | React 19 + TypeScript, Vite, React Router v7 |
| Backend | Node.js, Express 4 |
| Database | PostgreSQL 14+ |
| AI | OpenAI gpt-4o-mini |
| Auth | JWT (JSON Web Tokens) + bcrypt |

---

## Quick Start (Demo Mode — no backend needed)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser. Register any email/password — everything works in demo mode using localStorage.

---

## Full Setup (with backend and database)

### 1. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 2. Database
```bash
psql -U postgres -c "CREATE DATABASE kidssafe;"
psql -U postgres -d kidssafe -f backend/database/schema.sql
```

### 3. Backend — create `backend/.env`
```
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/kidssafe
JWT_SECRET=any-long-random-string
OPENAI_API_KEY=sk-...        (leave blank for demo mode)
FRONTEND_URL=http://localhost:5173
```

### 4. Start backend
```bash
cd backend
npm install
npm run dev
```

---

## Project Structure

```
kidssafe-full/
├── frontend/                   ← React + TypeScript frontend
│   └── src/
│       ├── components/         ← Reusable UI (Navbar, ContentCard, AISearchBar)
│       ├── contexts/           ← AuthContext – global login state
│       ├── pages/              ← All pages (Landing, Dashboard, KidsHome…)
│       ├── services/api.ts     ← All API calls + demo mode fallback
│       └── types/index.ts      ← Shared TypeScript interfaces
└── backend/                    ← Node.js + Express API
    ├── routes/
    │   ├── auth.js             ← POST /api/auth/register, /api/auth/login
    │   ├── children.js         ← CRUD for child profiles + restrictions
    │   └── ai.js               ← POST /api/ai/search, GET /api/ai/suggestions/:id
    ├── database/
    │   ├── db.js               ← PostgreSQL connection pool
    │   └── schema.sql          ← Table definitions + default-restriction trigger
    ├── middleware/auth.js       ← JWT verification middleware
    └── server.js               ← Express entry point
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/health | Server health check |
| POST | /api/auth/register | Create parent account |
| POST | /api/auth/login | Login and get JWT |
| GET | /api/children | Get all child profiles |
| POST | /api/children | Add a child |
| PUT | /api/children/:id | Update child info |
| DELETE | /api/children/:id | Delete child |
| PUT | /api/children/:id/restrictions | Save content restrictions |
| GET | /api/children/:id/history | Get AI search history |
| POST | /api/ai/search | AI content search |
| GET | /api/ai/suggestions/:childId | Personalised home feed |

---

## Features

- 🛡️ **Parent controls** — age ratings (G/PG/PG-13), allowed categories, blocked keywords
- 🤖 **AI filtering** — every recommendation goes through parent restrictions before being shown
- 👧 **Multi-child profiles** — separate settings, avatar, and PIN for each child
- ⏱️ **Screen-time limits** — set a daily maximum per child
- 🌙 **Demo mode** — works fully without a backend (localStorage fallback)
- 📊 **Search history** — parents can review what their child searched for

---

## Limitations

1. Screen-time limits are stored but not enforced at the browser level
2. Demo mode stores passwords in plain text in localStorage (fine for testing only)
3. AI safety scores are self-reported by the model, not independently verified
4. JWT tokens are in localStorage rather than secure HttpOnly cookies
5. No real-time notifications when children search for blocked topics

---

## License

Educational project — CMS22204
