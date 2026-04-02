const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // This stops Node from panicking over Supabase's cert
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

pool.on('error', (err, client) => {
  console.error('Idle client error. The cloud dropped the connection.', err.message);
});