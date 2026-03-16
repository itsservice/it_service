// users.js — MySQL-first user management
// อ่าน/เขียน MySQL ตรงๆ — memory cache แค่สำหรับ sync reads
// DB columns: id(INT AI), username, password, role, brand, line_user_id, phone, email, active, display_name, created_at, updated_at

const { hashPwd } = require('./auth');

let db = null;
let useDB = false;
let USERS = []; // memory cache สำหรับ sync reads

// ── DB row → app format ─────────────────────────────
function toUser(row) {
  return {
    id:           String(row.id),
    name:         row.display_name || row.name || '',
    username:     row.username || '',
    password:     row.password || '',
    role:         row.role || 'engineer',
    brand:        row.brand || 'ALL',
    active:       row.active != null ? Number(row.active) : 1,
    line_user_id: row.line_user_id || '',
    phone:        row.phone || '',
    email:        row.email || '',
  };
}

// ── Init ─────────────────────────────────────────────
async function initDB() {
  try {
    db = require('./db');
    const [test] = await db.query('SELECT 1');
    useDB = true;
    console.log('[Users] MySQL OK');
    await refreshCache();
    setInterval(() => refreshCache().catch(()=>{}), 30000);
  } catch(e) {
    console.warn('[Users] MySQL FAIL:', e.message, '— memory only');
    useDB = false;
    // Fallback defaults
    USERS = [
      { id:'1', name:'IT Admin', username:'admin', password:hashPwd('admin1234'), role:'admin', brand:'ALL', active:1, line_user_id:'', phone:'', email:'' },
    ];
  }
}

async function refreshCache() {
  if (!useDB) return;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE active=1 OR active IS NULL ORDER BY id');
    USERS = rows.map(toUser);
  } catch(e) { console.error('[Users] refreshCache:', e.message); }
}

initDB();

// ═══════════════════════════════════════════════════
// READ — SYNC (จาก memory cache)
// ═══════════════════════════════════════════════════

function getAllUsers() {
  return USERS.filter(u => u.active === 1).map(u => ({
    id: u.id, name: u.name, username: u.username,
    role: u.role, brand: u.brand, active: u.active,
    line_user_id: u.line_user_id, phone: u.phone, email: u.email,
  }));
}

function getUserById(id) {
  return USERS.find(u => String(u.id) === String(id)) || null;
}

function getUserByUsername(username) {
  return USERS.find(u => u.username === username) || null;
}

// ═══════════════════════════════════════════════════
// WRITE — เขียน DB ก่อน แล้ว refresh cache
// ═══════════════════════════════════════════════════

function createUser(data) {
  const { name, username, password, role, brand, line_user_id, phone, email } = data;
  if (!name || !username || !password || !role) throw new Error('Missing fields');
  if (USERS.find(u => u.username === username)) throw new Error('Username already exists');

  const hashed = hashPwd(password);

  if (useDB && db) {
    // เขียน DB แบบ fire-and-forget แต่ refresh cache ทันที
    db.query(
      'INSERT INTO users (username, password, role, brand, display_name, line_user_id, phone, email, active) VALUES (?,?,?,?,?,?,?,?,1)',
      [username, hashed, role, brand||null, name, line_user_id||null, phone||null, email||null]
    ).then(async ([result]) => {
      console.log('[Users] INSERT OK id=' + result.insertId, username);
      await refreshCache(); // refresh ทันทีหลัง insert
    }).catch(e => console.error('[Users] INSERT FAIL:', e.message));
  }

  // Memory: ใส่ทันทีเพื่อให้ response ตอบได้เลย
  const tempId = 'tmp_' + Date.now();
  const user = { id:tempId, name, username, password:hashed, role, brand:brand||'ALL', active:1, line_user_id:line_user_id||'', phone:phone||'', email:email||'' };
  USERS.push(user);

  return { id:tempId, name, username, role, brand:brand||'ALL', active:1, line_user_id:line_user_id||'', phone:phone||'', email:email||'' };
}

function updateUser(id, data) {
  const i = USERS.findIndex(u => String(u.id) === String(id));
  if (i < 0) throw new Error('User not found');

  if (data.password) data.password = hashPwd(data.password);

  // Memory update ก่อน
  USERS[i] = { ...USERS[i], ...data, id:USERS[i].id, username:USERS[i].username };

  if (useDB && db) {
    // Map js field → db column
    const MAP = {
      name:'display_name', password:'password', role:'role', brand:'brand',
      active:'active', line_user_id:'line_user_id', phone:'phone', email:'email'
    };
    const sets=[], vals=[];
    for (const [js, col] of Object.entries(MAP)) {
      if (data[js] !== undefined) { sets.push(col+'=?'); vals.push(data[js]); }
    }
    if (sets.length) {
      vals.push(id);
      db.query('UPDATE users SET '+sets.join(',')+' WHERE id=?', vals)
        .then(async ([result]) => {
          console.log('[Users] UPDATE OK id='+id, 'affected='+result.affectedRows, Object.keys(data).filter(k=>k!=='password').join(','));
          await refreshCache();
        })
        .catch(e => console.error('[Users] UPDATE FAIL id='+id+':', e.message));
    }
  }

  return { ...USERS[i], password:undefined };
}

function deleteUser(id) {
  const i = USERS.findIndex(u => String(u.id) === String(id));
  if (i < 0) throw new Error('User not found');
  USERS.splice(i, 1);

  if (useDB && db) {
    db.query('UPDATE users SET active=0 WHERE id=?', [id])
      .then(([r]) => { console.log('[Users] DELETE OK id='+id, 'affected='+r.affectedRows); refreshCache(); })
      .catch(e => console.error('[Users] DELETE FAIL:', e.message));
  }
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser };
