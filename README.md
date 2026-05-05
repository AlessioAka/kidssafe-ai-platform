# 🛡️ KidsSafe — AI-Powered Children's Content Safety Platform

> A full-stack web application that gives parents complete control over what their children can discover online, powered by OpenAI GPT-4.

![Stack](https://img.shields.io/badge/React-19-blue?logo=react)
![Stack](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)
![Stack](https://img.shields.io/badge/PostgreSQL-Database-blue?logo=postgresql)
![Stack](https://img.shields.io/badge/OpenAI-GPT--4-orange?logo=openai)
![Stack](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)

---

## 🚀 What is KidsSafe?

Children using mainstream platforms (YouTube, Netflix, Google) are exposed to algorithmically served content optimised for **engagement, not safety**. KidsSafe solves this by:

- Giving parents **8 independent controls** per child (rating ceiling, categories, blocked keywords, violence toggle, scary content toggle, educational mode, screen-time limit, AI notes)
- Routing **every child search through OpenAI GPT-4**, constrained by the parent's exact rules
- Providing a **PIN-protected child profile** system so siblings can't use the wrong profile
- Returning a **safety score (1–100)** and plain-language reason for every AI recommendation
- Website URL - http://localhost:5173

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript 5 + Vite 8 + React Router 7 |
| Backend | Node.js + Express + JWT authentication |
| Database | PostgreSQL (relational schema, triggers, JSONB) |
| AI Engine | OpenAI GPT-4o-mini (server-side, structured JSON output) |
| HTTP Client | Axios with JWT interceptor |

---

## 📁 Project Structure

```
kidssafe/
├── vite-testapp/          # React frontend
│   └── src/
│       ├── components/    # AISearchBar, ContentCard, Navbar
│       ├── contexts/      # AuthContext (global login state)
│       ├── pages/         # LandingPage, Login, Register, Dashboard, Kids
│       ├── services/      # api.ts (all HTTP calls + offline fallback)
│       └── types/         # TypeScript interfaces
│
└── backend/               # Node.js API server
    ├── database/
    │   ├── schema.sql     # PostgreSQL tables, triggers, indexes
    │   └── db.js          # Connection pool
    ├── middleware/
    │   └── auth.js        # JWT validation middleware
    ├── routes/
    │   ├── auth.js        # POST /register, POST /login
    │   ├── children.js    # CRUD + restrictions
    │   └── ai.js          # GPT-4 search + suggestions
    └── server.js          # Express entry point
```

---

## ⚡ Quick Start (Demo Mode — No Backend Required)

```bash
# 1. Install and run the frontend
cd vite-testapp
npm install
npm run dev

# 2. Open http://localhost:5173
# 3. Register any email/password — the app works fully in demo mode
```

The app detects no backend is running and switches to localStorage demo mode automatically. All features work including the AI search (uses curated safe content).

---

## 🔧 Full Stack Setup

### 1. PostgreSQL Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE kidssafe;"

# Run the schema (creates all tables, trigger, indexes, sample data)
psql -U postgres -d kidssafe -f backend/database/schema.sql
```

### 2. Backend Environment

Create `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/kidssafe
JWT_SECRET=your-secret-key-change-in-production
OPENAI_API_KEY=sk-your-openai-key-here
FRONTEND_URL=http://localhost:5173
```

### 3. Start Backend

```bash
cd backend
npm install
npm run dev
# Server running at http://localhost:5000
```

### 4. Start Frontend

```bash
cd vite-testapp
npm install
npm run dev
# App running at http://localhost:5173
```

---

## 🗄️ Database Schema

```
parents        (id, email, password_hash, name)
    │
    └── children   (id, parent_id → parents, name, age, avatar_emoji, pin)
            │
            ├── restrictions  (child_id → children, max_content_rating,
            │                  allowed_categories[], blocked_keywords[],
            │                  violence_level, allow_scary_content,
            │                  educational_only, max_daily_minutes, parent_notes)
            │
            └── search_history (child_id → children, query, results JSONB)
```

A PostgreSQL **trigger** automatically creates a safe default restrictions row the moment a child profile is added.

---

## 🔐 Security

- Passwords hashed with **bcrypt** (cost factor 12)
- **JWT** tokens expire after 7 days
- All database queries use **parameterised statements** (SQL injection proof)
- OpenAI API key is **server-side only** — never exposed to the browser
- Every backend route scoped to `WHERE parent_id = $1` — cross-family data access is impossible

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/health | No | Server health check |
| POST | /api/auth/register | No | Create parent account |
| POST | /api/auth/login | No | Login, receive JWT |
| GET | /api/children | JWT | List parent's children |
| POST | /api/children | JWT | Add child profile |
| PUT | /api/children/:id/restrictions | JWT | Save all 8 parental controls |
| DELETE | /api/children/:id | JWT | Delete child (cascades) |
| GET | /api/children/:id/history | JWT | Child's search history |
| POST | /api/ai/search | JWT | AI-filtered content search |
| GET | /api/ai/suggestions/:id | JWT | Personalised home feed |

---

## 🎓 Assignment

**Unit:** CMS22204 — Full Stack Application Development  
**University:** Ravensbourne University London  
**Level:** 5 | **Credits:** 40 |  
**Student:** Alessio Akabuogu
