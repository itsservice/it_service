// auth.js
const crypto = require('crypto');

// ── Password hashing ──────────────────────────────────────────
const SALT = process.env.PWD_SALT || 'it-ticket-salt-2025';
function hashPwd(pwd) {
  return crypto.createHash('sha256').update(pwd + SALT).digest('hex');
}

// ── Sessions (in-memory + TTL refresh) ───────────────────────
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
    expires:   Date.now() + SESSION_TTL,
    createdAt: Date.now(),
  });
  pruneExpiredSessions();
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() > s.expires) { sessions.delete(token); return null; }
  s.expires = Date.now() + SESSION_TTL; // sliding expiry
  return s;
}

function deleteSession(token) { sessions.delete(token); }

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [t, s] of sessions) { if (now > s.expires) sessions.delete(t); }
}
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

// ── Activity Log — MySQL persistent ─────────────────────────
// In-memory fallback (ใช้เวลา DB ยังไม่พร้อม)
const memLogs = [];

// Lazy-load db pool เพื่อหลีกเลี่ยง circular dependency
let _db = null;
function getDb() {
  if (!_db) { try { _db = require('./db'); } catch(e) { /* db.js ไม่มี */ } }
  return _db;
}

function addLog({ user, action, ticketId, ticketLabel, detail }) {
  const logKey   = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now      = new Date();
  const displayTs = now.toLocaleString('th-TH', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
  const entry = {
    id:          logKey,
    ts:          now.toISOString(),
    displayTs,
    user:        user ? { id: user.id, name: user.name, role: user.role } : { name: 'System', role: 'system' },
    action,
    ticketId:    ticketId    || null,
    ticketLabel: ticketLabel || null,
    detail:      detail      || null,
  };

  // In-memory (สำหรับ fallback และ getLogs เร็ว)
  memLogs.unshift(entry);
  if (memLogs.length > 200) memLogs.length = 200;

  // Persist ลง MySQL (async, ไม่ block)
  const db = getDb();
  if (db) {
    db.query(
      `INSERT INTO activity_logs
         (log_key, ts, user_id, user_name, user_role, action, ticket_id, ticket_label, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logKey,
        now,
        user?.id    || null,
        user?.name  || 'System',
        user?.role  || 'system',
        action,
        ticketId    || null,
        ticketLabel || null,
        detail      || null,
      ]
    ).catch(e => console.warn('[Log] DB insert failed:', e.message));
  }

  return entry;
}

// getLogs — ดึงจาก DB (persistent) หรือ fallback to memory
async function getLogsAsync({ limit = 200, userName = null, action = null, dateFrom = null, dateTo = null, ticketId = null } = {}) {
  const db = getDb();
  if (!db) return memLogs.slice(0, limit); // fallback

  try {
    const conditions = [];
    const params     = [];

    if (userName)  { conditions.push('user_name LIKE ?');   params.push(`%${userName}%`); }
    if (action)    { conditions.push('action = ?');          params.push(action); }
    if (dateFrom)  { conditions.push('ts >= ?');             params.push(new Date(dateFrom)); }
    if (dateTo)    { conditions.push('ts <= ?');             params.push(new Date(dateTo + ' 23:59:59')); }
    if (ticketId)  { conditions.push('ticket_id = ?');       params.push(ticketId); }

    const where  = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(Math.min(limit, 1000));

    const [rows] = await db.query(
      `SELECT * FROM activity_logs ${where} ORDER BY ts DESC LIMIT ?`,
      params
    );

    return rows.map(r => ({
      id:          r.log_key,
      ts:          r.ts?.toISOString?.() || String(r.ts),
      displayTs:   new Date(r.ts).toLocaleString('th-TH', {
                     day:'2-digit', month:'2-digit', year:'numeric',
                     hour:'2-digit', minute:'2-digit',
                   }),
      user:        { id: r.user_id, name: r.user_name || 'System', role: r.user_role || 'system' },
      action:      r.action,
      ticketId:    r.ticket_id    || null,
      ticketLabel: r.ticket_label || null,
      detail:      r.detail       || null,
    }));
  } catch(e) {
    console.warn('[Log] DB select failed:', e.message);
    return memLogs.slice(0, limit);
  }
}

// Sync wrapper (backward compat สำหรับโค้ดเดิม)
function getLogs(limit = 200, ticketId = null) {
  return memLogs
    .filter(x => !ticketId || x.ticketId === ticketId)
    .slice(0, limit);
}

module.exports = {
  hashPwd,
  createSession, getSession, deleteSession,
  requireAuth,
  addLog, getLogs, getLogsAsync,
};
