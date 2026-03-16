// db.js — MySQL connection pool
// ต้อง npm install mysql2
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '10.8.1.88',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'it_ticket',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  // timezone: '+07:00',
});

// ทดสอบ connection ตอน startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL connected:', process.env.DB_HOST || '10.8.1.88');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] MySQL connection FAILED:', err.message);
    console.error('[DB] Falling back to in-memory mode');
  });

module.exports = pool;
