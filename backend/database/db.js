// ============================================================
// database/db.js  — PostgreSQL connection pool
// Uses the 'pg' library to manage efficient DB connections.
// The pool reuses connections instead of opening a new one
// for every request, which is critical for performance.
// ============================================================

const { Pool } = require('pg');

// Create a connection pool.
// Reads DATABASE_URL from .env (see .env.example).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/kidssafe',
  // Enable SSL in production (e.g. Heroku) but not locally
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,                    // Maximum simultaneous connections
  idleTimeoutMillis: 30000,   // Release idle connections after 30 s
  connectionTimeoutMillis: 2000, // Fail fast if DB unreachable
});

// Test the connection once at startup so we know immediately
// if the database is reachable.
pool.connect((err, client, release) => {
  if (err) {
    console.error('⚠️  PostgreSQL connection failed:', err.message);
    console.log('   → Make sure PostgreSQL is running');
    console.log('   → Set DATABASE_URL in backend/.env');
    console.log('   → Run: psql -U postgres -c "CREATE DATABASE kidssafe;"');
    console.log('   → Then: psql -U postgres -d kidssafe -f database/schema.sql\n');
  } else {
    console.log('✅ Connected to PostgreSQL');
    release();
  }
});

module.exports = {
  // Standard query: db.query(sql, [params])
  query: (text, params) => pool.query(text, params),
  // For transactions that need a dedicated client
  getClient: () => pool.connect(),
  pool,
};
