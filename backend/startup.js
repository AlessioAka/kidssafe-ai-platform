// ============================================================
// startup.js  — Boots embedded PostgreSQL then starts Express
//
// This file replaces running `node server.js` directly.
// It spins up a real PostgreSQL 16 instance (bundled via the
// embedded-postgres npm package), creates the kidssafe database,
// runs the schema if needed, patches DATABASE_URL, then
// requires server.js to start Express as normal.
// ============================================================

require('dotenv').config();

const path = require('path');
const { default: EmbeddedPostgres } = require('embedded-postgres');
const fs   = require('fs');

const PG_PORT     = 5432;
const PG_USER     = 'postgres';
const PG_PASSWORD = 'kidssafe';
const PG_DB       = 'kidssafe';
const DATA_DIR    = path.join(__dirname, 'data', 'pgdata');

async function main() {
  console.log('\n========================================');
  console.log('  🗄️  Starting Embedded PostgreSQL…');
  console.log('========================================');

  // Ensure the data directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user:        PG_USER,
    password:    PG_PASSWORD,
    port:        PG_PORT,
    persistent:  true,   // data survives restarts
  });

  // Only initialise on first run (PG_VERSION file marks an existing cluster)
  const pgVersionFile = path.join(DATA_DIR, 'PG_VERSION');
  if (!fs.existsSync(pgVersionFile)) {
    await pg.initialise();
  }
  await pg.start();
  console.log(`✅ PostgreSQL running on port ${PG_PORT}`);

  // Create the kidssafe database (safe to call repeatedly)
  try {
    await pg.createDatabase(PG_DB);
    console.log(`✅ Database '${PG_DB}' ready`);
  } catch (e) {
    // Already exists — that's fine
    if (!e.message?.includes('already exists')) {
      console.warn('createDatabase warning:', e.message);
    } else {
      console.log(`✅ Database '${PG_DB}' already exists`);
    }
  }

  // Point the app at the embedded instance
  process.env.DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DB}`;

  // Apply schema idempotently
  {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS parents (
          id            SERIAL PRIMARY KEY,
          email         VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name          VARCHAR(100) NOT NULL,
          created_at    TIMESTAMP DEFAULT NOW(),
          updated_at    TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS children (
          id           SERIAL PRIMARY KEY,
          parent_id    INTEGER REFERENCES parents(id) ON DELETE CASCADE NOT NULL,
          name         VARCHAR(100) NOT NULL,
          age          INTEGER NOT NULL CHECK (age >= 1 AND age <= 18),
          avatar_emoji VARCHAR(10) DEFAULT '🦄',
          pin          VARCHAR(6),
          created_at   TIMESTAMP DEFAULT NOW(),
          updated_at   TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS restrictions (
          id                  SERIAL PRIMARY KEY,
          child_id            INTEGER REFERENCES children(id) ON DELETE CASCADE NOT NULL UNIQUE,
          max_content_rating  VARCHAR(10) DEFAULT 'G',
          allowed_categories  TEXT[] DEFAULT ARRAY['educational','cartoons','science','nature'],
          blocked_keywords    TEXT[] DEFAULT ARRAY[]::TEXT[],
          violence_level      VARCHAR(20) DEFAULT 'none',
          allow_scary_content BOOLEAN DEFAULT FALSE,
          educational_only    BOOLEAN DEFAULT FALSE,
          max_daily_minutes   INTEGER DEFAULT 120,
          parent_notes        TEXT DEFAULT '',
          created_at          TIMESTAMP DEFAULT NOW(),
          updated_at          TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS search_history (
          id         SERIAL PRIMARY KEY,
          child_id   INTEGER REFERENCES children(id) ON DELETE CASCADE NOT NULL,
          query      VARCHAR(500) NOT NULL,
          results    JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE OR REPLACE FUNCTION create_default_restrictions()
        RETURNS TRIGGER AS $$
        BEGIN
          INSERT INTO restrictions (child_id) VALUES (NEW.id);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_default_restrictions'
          ) THEN
            CREATE TRIGGER trigger_default_restrictions
            AFTER INSERT ON children
            FOR EACH ROW EXECUTE FUNCTION create_default_restrictions();
          END IF;
        END;
        $$;
      `);
      console.log('✅ Schema applied');
    } catch (err) {
      console.warn('Schema warning (non-fatal):', err.message);
    } finally {
      await pool.end();
    }
  }

  // Graceful shutdown
  process.on('SIGINT',  async () => { await pg.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await pg.stop(); process.exit(0); });

  // Hand off to the main Express server
  require('./server');
}


main().catch(err => {
  console.error('❌ Startup failed:', err.message);
  console.error(err);
  process.exit(1);
});
