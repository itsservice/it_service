// auth.js
const crypto = require('crypto');

// ── Password hashing ──────────────────────────────────────────
const SALT = process.env.PWD_SALT || 'it-ticket-salt-2025';
function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
}

// ── Sessions (in-memory + TTL refresh) ───────────────────────
// ✅ แก้: เพิ่ม sliding expiry — ทุกครั้งที่ใช้งาน token จะต่ออายุอีก 12h
// กัน session หมดอายุระหว่างใช้งาน
const sessions = new Map();
const SESSION_TTL = 12 * 60 * 60 * 1000; // 12 ชั่วโมง

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    user: {
      id:       user.id,
      name:     user.name,
      username: user.username,
      role:     user.role,
      brand:    user.brand,
    },
    expires: Date.now() + SESSION_TTL,
    createdAt: Date.now(),
  });
  // ✅ ล้าง sessions ที่หมดอายุแล้วทุกครั้งที่ login ใหม่
  pruneExpiredSessions();
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) {
    sessions.delete(token);
    return null;
  }
  // ✅ Sliding expiry: ต่ออายุทุกครั้งที่ใช้งาน
  s.expires = Date.now() + SESSION_TTL;
  return s;
}

function deleteSession(token) {
  sessions.delete(token);
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now > s.expires) sessions.delete(token);
  }
}

// ✅ ล้าง session หมดอายุทุก 30 นาที กัน memory leak
setInterval(pruneExpiredSessions, 30 * 60 * 1000);

// ── requireAuth middleware ────────────────────────────────────
function requireAuth(roles = []) {
  return (req, res, next) => {
    const h     = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    const s     = getSession(token);
    if (!s) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบ' });
    if (roles.length && !roles.includes(s.user.role))
      return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์' });
    req.user  = s.user;
    req.token = token;
    next();
  };
}

// ── Activity Log ──────────────────────────────────────────────
const logs = [];
function addLog({ user, action, ticketId, ticketLabel, detail }) {
  const e = {
    id:        Date.now().toString(36),
    ts:        new Date().toISOString(),
    displayTs: new Date().toLocaleString('th-TH', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit',
    }),
    user:       user ? { id:user.id, name:user.name, role:user.role } : { name:'System', role:'system' },
    action,
    ticketId:   ticketId   || null,
    ticketLabel: ticketLabel || null,
    detail:     detail     || null,
  };
  logs.unshift(e);
  if (logs.length > 200) logs.length = 200; // ตัดให้เหลือ 200 (ลดจาก 500)
  return e;
}

function getLogs(limit = 100, ticketId = null) {
  const l = ticketId ? logs.filter(x => x.ticketId === ticketId) : logs;
  return l.slice(0, limit);
}

module.exports = {
  hashPwd,
  createSession, getSession, deleteSession,
  requireAuth,
  addLog, getLogs,
};
