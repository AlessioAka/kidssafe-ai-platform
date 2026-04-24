// ============================================================
// routes/children.js  — Child profile & restriction management
// All routes require a valid parent JWT (authenticateParent).
//
// GET    /api/children              — list parent's children
// POST   /api/children              — add a child profile
// PUT    /api/children/:id          — update child info
// DELETE /api/children/:id          — remove child profile
// PUT    /api/children/:id/restrictions — update restrictions
// GET    /api/children/:id/history  — search history
// ============================================================

const express = require('express');
const db      = require('../database/db');
const { authenticateParent } = require('../middleware/auth');

const router = express.Router();

// Apply JWT auth to every route in this file
router.use(authenticateParent);

// SQL fragment to JOIN child with its restriction row
const CHILD_WITH_RESTRICTIONS = `
  SELECT
    c.id, c.name, c.age, c.avatar_emoji, c.pin, c.created_at,
    r.max_content_rating, r.allowed_categories, r.blocked_keywords,
    r.violence_level, r.allow_scary_content, r.educational_only,
    r.max_daily_minutes, r.parent_notes
  FROM children c
  LEFT JOIN restrictions r ON c.id = r.child_id
`;

// ----------------------------------------------------------
// GET /api/children
// Returns all child profiles for the authenticated parent
// ----------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `${CHILD_WITH_RESTRICTIONS} WHERE c.parent_id = $1 ORDER BY c.created_at ASC`,
      [req.parentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Error fetching children.' });
  }
});

// ----------------------------------------------------------
// POST /api/children
// Body: { name, age, avatar_emoji?, pin? }
// Creates a child profile. The DB trigger auto-creates
// a default restrictions row via trigger_default_restrictions.
// ----------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { name, age, avatar_emoji = '🦄', pin } = req.body;

    if (!name || !age) {
      return res.status(400).json({ error: 'Child name and age are required.' });
    }
    if (age < 1 || age > 18) {
      return res.status(400).json({ error: 'Age must be between 1 and 18.' });
    }

    // Insert child — trigger fires to create default restrictions
    const inserted = await db.query(
      `INSERT INTO children (parent_id, name, age, avatar_emoji, pin)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.parentId, name.trim(), parseInt(age), avatar_emoji, pin || null]
    );

    // Return the full profile including restriction defaults
    const result = await db.query(
      `${CHILD_WITH_RESTRICTIONS} WHERE c.id = $1`,
      [inserted.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add child error:', error);
    res.status(500).json({ error: 'Error adding child profile.' });
  }
});

// ----------------------------------------------------------
// PUT /api/children/:id
// Update a child's profile details (not restrictions)
// Body: { name?, age?, avatar_emoji?, pin? }
// ----------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, age, avatar_emoji, pin } = req.body;

    // Ownership check — ensure this child belongs to the calling parent
    const check = await db.query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
      [id, req.parentId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }

    await db.query(
      `UPDATE children
       SET name         = COALESCE($1, name),
           age          = COALESCE($2, age),
           avatar_emoji = COALESCE($3, avatar_emoji),
           pin          = $4,
           updated_at   = NOW()
       WHERE id = $5 AND parent_id = $6`,
      [name || null, age || null, avatar_emoji || null, pin || null, id, req.parentId]
    );

    const result = await db.query(
      `${CHILD_WITH_RESTRICTIONS} WHERE c.id = $1`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update child error:', error);
    res.status(500).json({ error: 'Error updating child profile.' });
  }
});

// ----------------------------------------------------------
// DELETE /api/children/:id
// Removes a child profile (cascades to restrictions + history)
// ----------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM children WHERE id = $1 AND parent_id = $2 RETURNING name',
      [id, req.parentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }
    res.json({ message: `${result.rows[0].name}'s profile has been removed.` });
  } catch (error) {
    console.error('Delete child error:', error);
    res.status(500).json({ error: 'Error deleting child profile.' });
  }
});

// ----------------------------------------------------------
// PUT /api/children/:id/restrictions
// Upsert content restrictions for a specific child
// Body: restriction fields (all optional — defaults applied)
// ----------------------------------------------------------
router.put('/:id/restrictions', async (req, res) => {
  try {
    const { id } = req.params;

    // Ownership check
    const check = await db.query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
      [id, req.parentId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }

    const {
      max_content_rating  = 'G',
      allowed_categories  = ['educational', 'cartoons', 'science', 'nature'],
      blocked_keywords    = [],
      violence_level      = 'none',
      allow_scary_content = false,
      educational_only    = false,
      max_daily_minutes   = 120,
      parent_notes        = '',
    } = req.body;

    // ON CONFLICT handles both insert (first save) and update
    const result = await db.query(
      `INSERT INTO restrictions
         (child_id, max_content_rating, allowed_categories, blocked_keywords,
          violence_level, allow_scary_content, educational_only,
          max_daily_minutes, parent_notes, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (child_id) DO UPDATE SET
         max_content_rating  = EXCLUDED.max_content_rating,
         allowed_categories  = EXCLUDED.allowed_categories,
         blocked_keywords    = EXCLUDED.blocked_keywords,
         violence_level      = EXCLUDED.violence_level,
         allow_scary_content = EXCLUDED.allow_scary_content,
         educational_only    = EXCLUDED.educational_only,
         max_daily_minutes   = EXCLUDED.max_daily_minutes,
         parent_notes        = EXCLUDED.parent_notes,
         updated_at          = NOW()
       RETURNING *`,
      [id, max_content_rating, allowed_categories, blocked_keywords,
       violence_level, allow_scary_content, educational_only,
       max_daily_minutes, parent_notes]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update restrictions error:', error);
    res.status(500).json({ error: 'Error updating restrictions.' });
  }
});

// ----------------------------------------------------------
// GET /api/children/:id/history
// Returns the last 20 AI searches made by this child
// ----------------------------------------------------------
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    const check = await db.query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
      [id, req.parentId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }

    const result = await db.query(
      'SELECT id, query, created_at FROM search_history WHERE child_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Error fetching search history.' });
  }
});

module.exports = router;
