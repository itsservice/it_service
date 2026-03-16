// users.js — User management with MySQL backend
// Fallback: ถ้า MySQL เชื่อมไม่ได้ จะใช้ in-memory เหมือนเดิม
const { hashPwd } = require('./auth');

let db = null;
let useDB = false;

// ── In-memory fallback data ─────────────────────────
const DEFAULT_USERS = [
  { id:'u1', name:'Super Admin',  username:'superadmin', pwd:'super1234', role:'superadmin', brand:'ALL' },
  { id:'u2', name:'Admin System', username:'admin',      pwd:'admin1234', role:'admin',      brand:'ALL' },
  { id:'u3', name:'Manager',      username:'manager',    pwd:'mgr1234',   role:'manager',    brand:'ALL' },
  { id:'e1', name:'ช่าง 1', username:'eng1', pwd:'eng1234', role:'engineer', brand:"Dunkin'" },
  { id:'e2', name:'ช่าง 2', username:'eng2', pwd:'eng2345', role:'engineer', brand:"Dunkin'" },
  { id:'e3', name:'ช่าง 3', username:'eng3', pwd:'eng3456', role:'engineer', brand:"Dunkin'" },
  { id:'e4', name:'ช่าง 4', username:'eng4', pwd:'eng4567', role:'engineer', brand:"Dunkin'" },
  { id:'e5', name:'ช่าง 5', username:'eng5', pwd:'eng5678', role:'engineer', brand:"Dunkin'" },
];

let MEM_USERS = DEFAULT_USERS.map(u => ({
  id: u.id, name: u.name, username: u.username,
  password: hashPwd(u.pwd),
  role: u.role, brand: u.brand, active: true,
  line_user_id: '', phone: '', email: '',
}));

// ── Init: try to connect MySQL ──────────────────────
async function initDB() {
  try {
    db = require('./db');
    const [rows] = await db.query('SELECT COUNT(*) as cnt FROM users');
    useDB = true;
    console.log('[Users] MySQL connected, users in DB:', rows[0].cnt);

    // Auto-seed if empty
    if (rows[0].cnt === 0) {
      console.log('[Users] DB empty — seeding default users...');
      for (const u of DEFAULT_USERS) {
        await db.query(
          'INSERT INTO users (id, name, username, password, role, brand, active, line_user_id, phone, email) VALUES (?,?,?,?,?,?,1,?,?,?)',
          [u.id, u.name, u.username, hashPwd(u.pwd), u.role, u.brand, '', '', '']
        );
      }
      console.log('[Users] Seeded', DEFAULT_USERS.length, 'users');
    }
  } catch (e) {
    console.warn('[Users] MySQL not available:', e.message);
    console.warn('[Users] Using in-memory mode (data lost on restart)');
    useDB = false;
  }
}

// Run init on load
initDB();

// ═══ CRUD FUNCTIONS ═══

async function getAllUsers() {
  if (useDB) {
    try {
      const [rows] = await db.query(
        'SELECT id, name, username, role, brand, active, line_user_id, phone, email, created_at FROM users WHERE active=1 ORDER BY FIELD(role,"superadmin","admin","manager","lead_engineer","engineer"), name'
      );
      return rows.map(r => ({ ...r, password: undefined }));
    } catch (e) {
      console.error('[Users] DB getAllUsers error:', e.message);
      return MEM_USERS.map(u => ({ ...u, password: undefined }));
    }
  }
  return MEM_USERS.map(u => ({ ...u, password: undefined }));
}

async function getUserById(id) {
  if (useDB) {
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE id=?', [id]);
      return rows[0] || null;
    } catch (e) { console.error('[Users] DB error:', e.message); }
  }
  return MEM_USERS.find(u => u.id === id) || null;
}

function getUserByUsername(username) {
  // Sync version สำหรับ auth — ต้อง sync เพราะ auth.js เรียกแบบ sync
  if (useDB) {
    // ใช้ cache จาก memory (sync ลง MEM_USERS ตอน startup)
    return MEM_USERS.find(u => u.username === username) || null;
  }
  return MEM_USERS.find(u => u.username === username) || null;
}

// Sync memory cache จาก DB (เรียกหลัง create/update/delete)
async function syncMemory() {
  if (!useDB) return;
  try {
    const [rows] = await db.query('SELECT * FROM users ORDER BY name');
    MEM_USERS = rows;
  } catch (e) { console.error('[Users] syncMemory error:', e.message); }
}

async function createUser(data) {
  const { name, username, password, role, brand, line_user_id, phone, email } = data;
  if (!name || !username || !password || !role) throw new Error('Missing required fields (name, username, password, role)');

  const id = 'u' + Date.now();
  const hashed = hashPwd(password);

  if (useDB) {
    try {
      // Check duplicate
      const [dup] = await db.query('SELECT id FROM users WHERE username=?', [username]);
      if (dup.length) throw new Error('Username already exists');

      await db.query(
        'INSERT INTO users (id, name, username, password, role, brand, active, line_user_id, phone, email) VALUES (?,?,?,?,?,?,1,?,?,?)',
        [id, name, username, hashed, role, brand || 'ALL', line_user_id || '', phone || '', email || '']
      );
      await syncMemory();
      return { id, name, username, role, brand: brand || 'ALL', active: true, line_user_id: line_user_id || '', phone: phone || '', email: email || '' };
    } catch (e) {
      if (e.message.includes('already exists')) throw e;
      console.error('[Users] DB createUser error:', e.message);
      // Fallback to memory
    }
  }

  // Memory fallback
  if (MEM_USERS.find(u => u.username === username)) throw new Error('Username already exists');
  const user = { id, name, username, password: hashed, role, brand: brand || 'ALL', active: true, line_user_id: line_user_id || '', phone: phone || '', email: email || '' };
  MEM_USERS.push(user);
  return { ...user, password: undefined };
}

async function updateUser(id, data) {
  if (data.password) data.password = hashPwd(data.password);

  if (useDB) {
    try {
      // Build SET clause dynamically
      const allowed = ['name', 'password', 'role', 'brand', 'active', 'line_user_id', 'phone', 'email'];
      const sets = [];
      const vals = [];
      for (const key of allowed) {
        if (data[key] !== undefined) {
          sets.push(`${key}=?`);
          vals.push(data[key]);
        }
      }
      if (!sets.length) throw new Error('Nothing to update');
      vals.push(id);
      await db.query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, vals);
      await syncMemory();

      const updated = MEM_USERS.find(u => u.id === id);
      return updated ? { ...updated, password: undefined } : { id, ...data, password: undefined };
    } catch (e) {
      console.error('[Users] DB updateUser error:', e.message);
    }
  }

  // Memory fallback
  const i = MEM_USERS.findIndex(u => u.id === id);
  if (i < 0) throw new Error('User not found');
  MEM_USERS[i] = { ...MEM_USERS[i], ...data, id: MEM_USERS[i].id, username: MEM_USERS[i].username };
  return { ...MEM_USERS[i], password: undefined };
}

async function deleteUser(id) {
  if (useDB) {
    try {
      await db.query('UPDATE users SET active=0 WHERE id=?', [id]); // soft delete
      await syncMemory();
      return;
    } catch (e) { console.error('[Users] DB deleteUser error:', e.message); }
  }
  const i = MEM_USERS.findIndex(u => u.id === id);
  if (i < 0) throw new Error('User not found');
  MEM_USERS.splice(i, 1);
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser, syncMemory };
