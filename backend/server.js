// ============================================================
// server.js  — KidsSafe AI Platform — Express Entry Point
//
// Start in development:  npm run dev
// Start in production:   npm start
//
// Required environment variables (create a .env file):
//   PORT=5000
//   DATABASE_URL=postgresql://localhost:5432/kidssafe
//   JWT_SECRET=change-this-secret-in-production
//   OPENAI_API_KEY=sk-...          (optional — demo mode used if absent)
//   FRONTEND_URL=http://localhost:5173
// ============================================================

const express = require('express');
const cors    = require('cors');
require('dotenv').config();          // Load .env variables first

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Route handlers ─────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const childrenRoutes = require('./routes/children');
const aiRoutes       = require('./routes/ai');

// ── Middleware ─────────────────────────────────────────────────────────────

// Allow requests from the React dev server (and optionally a deployed domain)
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',   // Vite sometimes picks the next port
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON bodies (up to 10 MB for any base-64 encoded media)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple request logger for development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Health-check — useful for deployment checks and front-end connectivity test
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'KidsSafe API',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth',     authRoutes);      // Registration & login
app.use('/api/children', childrenRoutes);  // Child profiles & restrictions
app.use('/api/ai',       aiRoutes);        // AI content recommendations

// ── Error handling ──────────────────────────────────────────────────────────

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.path} not found.` });
});

// Global error handler — catches anything not caught in route handlers
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  🛡️  KidsSafe AI Platform — Backend');
  console.log('========================================');
  console.log(`  🚀 Server: http://localhost:${PORT}`);
  console.log(`  🌍 Env:    ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🤖 AI:     ${process.env.OPENAI_API_KEY ? 'OpenAI connected' : 'Demo mode (no API key)'}`);
  console.log('\n  Endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/auth/register');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/children');
  console.log('  POST /api/children');
  console.log('  PUT  /api/children/:id');
  console.log('  DEL  /api/children/:id');
  console.log('  PUT  /api/children/:id/restrictions');
  console.log('  GET  /api/children/:id/history');
  console.log('  POST /api/ai/search');
  console.log('  GET  /api/ai/suggestions/:childId');
  console.log('========================================\n');
});

module.exports = app;
