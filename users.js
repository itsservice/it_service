// users.js — User management: MySQL (table ที่มีอยู่แล้ว) + memory cache
// columns ใน DB: id, username, password, role, brand, display_name, created_at
// columns ใหม่ (ต้อง run migration): line_user_id, phone, email, active, updated_at
//
// getAllUsers(), getUserByUsername() = SYNC (อ่านจาก memory)
// createUser(), updateUser(), deleteUser() = SYNC (เขียน memory ทันที + async เขียน DB)

const { hashPwd } = require('./auth');

let db = null;
let useDB = false;

// ── Default users (ใช้ถ้า DB ไม่ได้) ───────────────
const DEFAULTS = [
  { id:'1', name:'IT Admin',           username:'admin',     pwd:'admin1234',  role:'admin',    brand:null },
  { id:'2', name:'Engineer Dunkin',     username:'eng_dunkin', pwd:'eng1234',   role:'engineer', brand:'Dunkin' },
  { id:'3', name:'Engineer Greyhound',  username:'eng_grey',   pwd:'eng1234',   role:'engineer', brand:'Greyhound Cafe' },
  { id:'4', name:'Engineer Au Bon Pain',username:'eng_abp',    pwd:'eng1234',   role:'engineer', brand:'Au Bon Pain' },
  { id:'5', name:'Engineer Funky Fries',username:'eng_funky',  pwd:'eng1234',   role:'engineer', brand:'Funky Fries' },
];

// ── Memory cache ────────────────────────────────────
let USERS = DEFAULTS.map(u => ({
  id: String(u.id),
  name: u.name,
  username: u.username,
  password: hashPwd(u.pwd),
  role: u.role,
  brand: u.brand || 'ALL',
  active: 1,
  line_user_id: '',
  phone: '',
  email: '',
}));

// ── DB row → memory format ──────────────────────────
function rowToUser(row) {
  return {
    id:           String(row.id),
    name:         row.display_name || row.name || '',
    username:     row.username || '',
    password:     row.password || '',
    role:         row.role || 'engineer',
    brand:        row.brand || 'ALL',
    active:       row.active !== undefined ? row.active : 1,
    line_user_id: row.line_user_id || '',
    phone:        row.phone || '',
    email:        row.email || '',
  };
}

// ── Init DB ─────────────────────────────────────────
async function initDB() {
  try {
    db = require('./db');
    await db.query('SELECT 1');
    useDB = true;
    console.log('[Users] MySQL connected');
    await syncFromDB();
    // Auto-sync ทุก 30 วินาที
    setInterval(() => syncFromDB().catch(() => {}), 30000);
  } catch (e) {
    console.warn('[Users] MySQL not available:', e.message, '— memory only');
    useDB = false;
  }
}

async function syncFromDB() {
  if (!useDB || !db) return;
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE active=1 OR active IS NULL ORDER BY id'
    );
    if (rows.length) {
      USERS = rows.map(rowToUser);
      console.log('[Users] Synced from DB:', rows.length, 'users');
    }
  } catch (e) {
    console.error('[Users] syncFromDB error:', e.message);
  }
}

initDB();

// ═══ READ (SYNC) ═══

function getAllUsers() {
  return USERS.filter(u => u.active === 1 || u.active === true).map(u => ({
    id:           u.id,
    name:         u.name,
    username:     u.username,
    role:         u.role,
    brand:        u.brand,
    active:       u.active,
    line_user_id: u.line_user_id || '',
    phone:        u.phone || '',
    email:        u.email || '',
  }));
}

function getUserById(id) {
  return USERS.find(u => String(u.id) === String(id)) || null;
}

function getUserByUsername(username) {
  return USERS.find(u => u.username === username) || null;
}

// ═══ WRITE (SYNC memory + ASYNC DB) ═══

function createUser(data) {
  const { name, username, password, role, brand, line_user_id, phone, email } = data;
  if (!name || !username || !password || !role) throw new Error('Missing fields');
  if (USERS.find(u => u.username === username)) throw new Error('Username already exists');

  const hashed = hashPwd(password);
  const user = {
    id: String(Date.now()),
    name, username, password: hashed,
    role, brand: brand || 'ALL', active: 1,
    line_user_id: line_user_id || '', phone: phone || '', email: email || '',
  };

  USERS.push(user);

  // Async write to DB
  if (useDB && db) {
    db.query(
      `INSERT INTO users (username, password, role, brand, display_name, line_user_id, phone, email, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [username, hashed, role, brand || null, name, line_user_id || null, phone || null, email || null]
    ).then(([result]) => {
      // Update memory id กับ DB auto-increment id
      const dbId = String(result.insertId);
      user.id = dbId;
      console.log('[Users] DB INSERT OK:', username, 'id=', dbId);
    }).catch(e => console.error('[Users] DB INSERT error:', e.message));
  }

  return { ...user, password: undefined };
}

function updateUser(id, data) {
  const i = USERS.findIndex(u => String(u.id) === String(id));
  if (i < 0) throw new Error('User not found');

  if (data.password) data.password = hashPwd(data.password);

  // Map name → display_name สำหรับ DB
  const dbData = { ...data };
  if (data.name) dbData.display_name = data.name;

  // Memory update
  USERS[i] = { ...USERS[i], ...data, id: USERS[i].id, username: USERS[i].username };

  // Async DB update
  if (useDB && db) {
    const allowed = {
      name:         'display_name',
      password:     'password',
      role:         'role',
      brand:        'brand',
      active:       'active',
      line_user_id: 'line_user_id',
      phone:        'phone',
      email:        'email',
    };
    const sets = [], vals = [];
    for (const [jsKey, dbCol] of Object.entries(allowed)) {
      if (data[jsKey] !== undefined) {
        sets.push(`${dbCol}=?`);
        vals.push(data[jsKey]);
      }
    }
    if (sets.length) {
      vals.push(id);
      db.query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, vals)
        .then(() => console.log('[Users] DB UPDATE OK:', USERS[i].username, '→', Object.keys(data).join(',')))
        .catch(e => console.error('[Users] DB UPDATE error:', e.message));
    }
  }

  return { ...USERS[i], password: undefined };
}

function deleteUser(id) {
  const i = USERS.findIndex(u => String(u.id) === String(id));
  if (i < 0) throw new Error('User not found');

  USERS.splice(i, 1);

  if (useDB && db) {
    db.query('UPDATE users SET active=0 WHERE id=?', [id])
      .then(() => console.log('[Users] DB soft-delete OK:', id))
      .catch(e => console.error('[Users] DB DELETE error:', e.message));
  }
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser };
