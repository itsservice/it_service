// db.js — MySQL connection pool
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '10.8.1.88',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'admin',
  password: process.env.DB_PASSWORD || 'P@ssw0rd!@1234',
  database: process.env.DB_NAME     || 'it_ticket',
  charset:  'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

module.exports = pool;
