// ============================================================
// routes/auth.js  — Parent authentication (register & login)
// POST /api/auth/register  — Create a new parent account
// POST /api/auth/login     — Authenticate and get a JWT token
// ============================================================

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database/db');

const router = express.Router();

// ----------------------------------------------------------
// POST /api/auth/register
// Body: { name, email, password }
// Returns: { token, parent }
// ----------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ── Validation ──────────────────────────────────────────
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // ── Duplicate check ──────────────────────────────────────
    const existing = await db.query(
      'SELECT id FROM parents WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // ── Hash password (bcrypt, cost factor 12) ───────────────
    const passwordHash = await bcrypt.hash(password, 12);

    // ── Insert parent ────────────────────────────────────────
    const result = await db.query(
      `INSERT INTO parents (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), email.toLowerCase(), passwordHash]
    );

    const parent = result.rows[0];

    // ── Issue JWT (7-day expiry) ──────────────────────────────
    const token = jwt.sign(
      { parentId: parent.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully!',
      token,
      parent: { id: parent.id, name: parent.name, email: parent.email },
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration. Please try again.' });
  }
});

// ----------------------------------------------------------
// POST /api/auth/login
// Body: { email, password }
// Returns: { token, parent }
// ----------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Fetch parent record (return generic error to avoid email enumeration)
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM parents WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const parent = result.rows[0];

    // Compare plain-text password against stored bcrypt hash
    const valid = await bcrypt.compare(password, parent.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { parentId: parent.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      parent: { id: parent.id, name: parent.name, email: parent.email },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login. Please try again.' });
  }
});

module.exports = router;
