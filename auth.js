// auth.js — Session auth + Activity log
const crypto = require('crypto');

// ── Sessions (memory, 12h TTL) ────────────────────────────────
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// SALT ต้องตรงกับที่ใช้ pre-hash รหัสผ่านใน users.js เสมอ
// ถ้าต้องการเปลี่ยน ต้อง pre-hash รหัสผ่านใหม่ทั้งหมดด้วย
const HASH_SALT = 'it-ticket-salt-2025';

function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + HASH_SALT).digest('hex');
}

function createSession(user) {
  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    user: { id: user.id, name: user.name, username: user.username, role: user.role, brand: user.brand },
    expires: Date.now() + 12 * 60 * 60 * 1000 // 12h
  });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) { sessions.delete(token); return null; }
  return s;
}

function deleteSession(token) {
  sessions.delete(token);
}

// ── Middleware ─────────────────────────────────────────────────
function requireAuth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const s = getSession(token);
    if (!s) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบ' });
    if (roles.length && !roles.includes(s.user.role)) {
      return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' });
    }
    req.user = s.user;
    req.token = token;
    next();
  };
}

// ── Activity Log (memory ring buffer, last 500 entries) ────────
const MAX_LOGS = 500;
const activityLog = [];

function addLog({ user, action, ticketId, ticketLabel, detail }) {
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    ts: new Date().toISOString(),
    displayTs: new Date().toLocaleString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }),
    user: user ? { id: user.id, name: user.name, role: user.role } : { name: 'System', role: 'system' },
    action,
    ticketId: ticketId || null,
    ticketLabel: ticketLabel || ticketId || null,
    detail: detail || null,
  };
  activityLog.unshift(entry);
  if (activityLog.length > MAX_LOGS) activityLog.pop();
  return entry;
}

function getLogs(limit = 100, ticketId = null) {
  let logs = activityLog;
  if (ticketId) logs = logs.filter(l => l.ticketId === ticketId);
  return logs.slice(0, limit);
}

module.exports = { hashPwd, createSession, getSession, deleteSession, requireAuth, addLog, getLogs };
