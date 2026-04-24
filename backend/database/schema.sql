-- ============================================================
-- KidsSafe AI Platform - PostgreSQL Database Schema
-- Run this file once to set up your database:
--   psql -U postgres -d kidssafe -f schema.sql
-- ============================================================

-- Drop tables if they exist (clean slate for setup)
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS restrictions CASCADE;
DROP TABLE IF EXISTS children CASCADE;
DROP TABLE IF EXISTS parents CASCADE;

-- ============================================================
-- PARENTS TABLE
-- Stores parent/guardian accounts
-- ============================================================
CREATE TABLE parents (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CHILDREN TABLE
-- Each parent can have multiple child profiles
-- ============================================================
CREATE TABLE children (
  id         SERIAL PRIMARY KEY,
  parent_id  INTEGER REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  age        INTEGER NOT NULL CHECK (age >= 1 AND age <= 18),
  avatar_emoji VARCHAR(10) DEFAULT '🦄',
  pin        VARCHAR(6),         -- optional 4-6 digit PIN for child login
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- RESTRICTIONS TABLE
-- Parent-defined content restrictions per child
-- ============================================================
CREATE TABLE restrictions (
  id                  SERIAL PRIMARY KEY,
  child_id            INTEGER REFERENCES children(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Content rating ceiling (G = all ages, PG = parental guidance, PG-13 = teens)
  max_content_rating  VARCHAR(10) DEFAULT 'G',

  -- Allowed content categories stored as a text array
  allowed_categories  TEXT[] DEFAULT ARRAY['educational','cartoons','science','nature'],

  -- Topics/keywords the parent wants blocked
  blocked_keywords    TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- How much violence is acceptable: 'none' | 'mild'
  violence_level      VARCHAR(20) DEFAULT 'none',

  -- Whether scary/horror content is permitted
  allow_scary_content BOOLEAN DEFAULT FALSE,

  -- Whether ONLY educational content is allowed
  educational_only    BOOLEAN DEFAULT FALSE,

  -- Maximum screen time per day in minutes (0 = unlimited)
  max_daily_minutes   INTEGER DEFAULT 120,

  -- Free-text notes from the parent to the AI
  parent_notes        TEXT DEFAULT '',

  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SEARCH HISTORY TABLE
-- Tracks AI searches made by children
-- ============================================================
CREATE TABLE search_history (
  id         SERIAL PRIMARY KEY,
  child_id   INTEGER REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  query      VARCHAR(500) NOT NULL,
  results    JSONB DEFAULT '[]',   -- AI recommendations stored as JSON
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: Auto-create default restrictions when child is added
-- ============================================================
CREATE OR REPLACE FUNCTION create_default_restrictions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO restrictions (child_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_default_restrictions
AFTER INSERT ON children
FOR EACH ROW EXECUTE FUNCTION create_default_restrictions();

-- ============================================================
-- SAMPLE DATA (optional - remove in production)
-- ============================================================
-- INSERT INTO parents (name, email, password_hash)
-- VALUES ('Test Parent', 'parent@test.com', '<bcrypt-hash-here>');
