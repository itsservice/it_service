// users.js — User management: MySQL + memory cache
// getAllUsers() และ getUserByUsername() ยังเป็น SYNC เหมือนเดิม
// แต่ข้อมูลจะ sync จาก MySQL ทุก 30 วินาที + หลังทุก create/update/delete
const { hashPwd } = require('./auth');

let db = null;
let useDB = false;

// ── Default users (seed ถ้า DB ว่าง) ────────────────
const DEFAULTS = [
  { id:'u1', name:'Super Admin',  username:'superadmin', pwd:'super1234', role:'superadmin', brand:'ALL' },
  { id:'u2', name:'Admin System', username:'admin',      pwd:'admin1234', role:'admin',      brand:'ALL' },
  { id:'u3', name:'Manager',      username:'manager',    pwd:'mgr1234',   role:'manager',    brand:'ALL' },
  { id:'e1', name:'ช่าง 1', username:'eng1', pwd:'eng1234', role:'engineer', brand:"Dunkin'" },
  { id:'e2', name:'ช่าง 2', username:'eng2', pwd:'eng2345', role:'engineer', brand:"Dunkin'" },
  { id:'e3', name:'ช่าง 3', username:'eng3', pwd:'eng3456', role:'engineer', brand:"Dunkin'" },
  { id:'e4', name:'ช่าง 4', username:'eng4', pwd:'eng4567', role:'engineer', brand:"Dunkin'" },
  { id:'e5', name:'ช่าง 5', username:'eng5', pwd:'eng5678', role:'engineer', brand:"Dunkin'" },
];

// ── Memory cache (ใช้ตอบ sync calls) ────────────────
let USERS = DEFAULTS.map(u => ({
  id: u.id, name: u.name, username: u.username,
  password: hashPwd(u.pwd),
  role: u.role, brand: u.brand, active: true,
  line_user_id: '', phone: '', email: '',
}));

// ── Init DB + sync ──────────────────────────────────
async function initDB() {
  try {
    db = require('./db');
    await db.query('SELECT 1');
    useDB = true;
    console.log('[Users] MySQL connected');

    // Check if empty → seed
    const [rows] = await db.query('SELECT COUNT(*) as cnt FROM users');
    if (rows[0].cnt === 0) {
      console.log('[Users] DB empty — seeding defaults...');
      for (const u of DEFAULTS) {
        await db.query(
          'INSERT INTO users (id,name,username,password,role,brand,active,line_user_id,phone,email) VALUES (?,?,?,?,?,?,1,?,?,?)',
          [u.id, u.name, u.username, hashPwd(u.pwd), u.role, u.brand, '', '', '']
        );
      }
      console.log('[Users] Seeded', DEFAULTS.length, 'users');
    }

    // Load to memory
    await syncFromDB();

    // Auto-sync ทุก 30 วินาที
    setInterval(() => syncFromDB().catch(() => {}), 30000);

  } catch (e) {
    console.warn('[Users] MySQL not available:', e.message, '— using memory only');
    useDB = false;
  }
}

async function syncFromDB() {
  if (!useDB || !db) return;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE active=1 ORDER BY name');
    if (rows.length) {
      USERS = rows;
      console.log('[Users] Synced from DB:', rows.length, 'users');
    }
  } catch (e) {
    console.error('[Users] syncFromDB error:', e.message);
  }
}

// Start init
initDB();

// ═══ SYNC FUNCTIONS (เหมือนเดิมทุกประการ) ═══

function getAllUsers() {
  return USERS.filter(u => u.active !== false && u.active !== 0).map(u => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    brand: u.brand,
    active: u.active,
    line_user_id: u.line_user_id || '',
    phone: u.phone || '',
    email: u.email || '',
    // password ไม่ส่งออก
  }));
}

function getUserById(id) {
  return USERS.find(u => u.id === id) || null;
}

function getUserByUsername(username) {
  return USERS.find(u => u.username === username) || null;
}

// ═══ WRITE FUNCTIONS (เขียน DB + update memory) ═══

function createUser(data) {
  const { name, username, password, role, brand, line_user_id, phone, email } = data;
  if (!name || !username || !password || !role) throw new Error('Missing fields (name, username, password, role)');
  if (USERS.find(u => u.username === username)) throw new Error('Username already exists');

  const id = 'u' + Date.now();
  const hashed = hashPwd(password);
  const user = {
    id, name, username, password: hashed,
    role, brand: brand || 'ALL', active: true,
    line_user_id: line_user_id || '', phone: phone || '', email: email || '',
  };

  // Memory
  USERS.push(user);

  // DB (async, ไม่ block)
  if (useDB && db) {
    db.query(
      'INSERT INTO users (id,name,username,password,role,brand,active,line_user_id,phone,email) VALUES (?,?,?,?,?,?,1,?,?,?)',
      [id, name, username, hashed, role, brand || 'ALL', line_user_id || '', phone || '', email || '']
    ).then(() => console.log('[Users] DB INSERT OK:', username))
     .catch(e => console.error('[Users] DB INSERT error:', e.message));
  }

  return { ...user, password: undefined };
}

function updateUser(id, data) {
  const i = USERS.findIndex(u => u.id === id);
  if (i < 0) throw new Error('User not found');

  if (data.password) data.password = hashPwd(data.password);

  // Memory
  USERS[i] = { ...USERS[i], ...data, id: USERS[i].id, username: USERS[i].username };

  // DB (async)
  if (useDB && db) {
    const allowed = ['name', 'password', 'role', 'brand', 'active', 'line_user_id', 'phone', 'email'];
    const sets = [], vals = [];
    for (const key of allowed) {
      if (data[key] !== undefined) { sets.push(`${key}=?`); vals.push(data[key]); }
    }
    if (sets.length) {
      vals.push(id);
      db.query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, vals)
        .then(() => console.log('[Users] DB UPDATE OK:', USERS[i].username))
        .catch(e => console.error('[Users] DB UPDATE error:', e.message));
    }
  }

  return { ...USERS[i], password: undefined };
}

function deleteUser(id) {
  const i = USERS.findIndex(u => u.id === id);
  if (i < 0) throw new Error('User not found');

  // Memory: soft delete
  USERS.splice(i, 1);

  // DB: soft delete
  if (useDB && db) {
    db.query('UPDATE users SET active=0 WHERE id=?', [id])
      .then(() => console.log('[Users] DB soft-delete OK:', id))
      .catch(e => console.error('[Users] DB DELETE error:', e.message));
  }
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser };
