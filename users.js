// users.js — User management via FastAPI (repair.mobile1234.site)
const axios = require('axios');
const { hashPwd } = require('./auth');

const API = process.env.REPAIR_API_URL || process.env.FASTAPI_URL || 'https://repair.mobile1234.site';
const KEY = process.env.REPAIR_API_KEY || process.env.FASTAPI_KEY || 'repair123';
const hdr = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };

let USERS = [];
let dbOK = false;

function toUser(row) {
  return {
    id:             String(row.id),
    name:           row.name || row.display_name || '',
    username:       row.username || '',
    password:       row.password || '',
    password_plain: row.password_plain || '',
    role:           row.role || 'engineer',
    brand:          row.brand || 'ALL',
    active:         row.active != null ? Number(row.active) : 1,
    line_user_id:   row.line_user_id || '',
    phone:          row.phone || '',
    email:          row.email || '',
  };
}

async function refreshCache() {
  try {
    const r = await axios.get(`${API}/api/users`, { headers: hdr, timeout: 8000 });
    const rows = r.data.users || r.data || [];
    if (Array.isArray(rows) && rows.length) {
      USERS = rows.map(toUser);
      dbOK = true;
      console.log('[Users] Loaded from FastAPI:', USERS.length, 'users');
    }
  } catch (e) {
    console.error('[Users] FastAPI load FAIL:', e.message);
    dbOK = false;
  }
}

async function loadPasswords() {
  try {
    for (const u of USERS) {
      if (u.password) continue;
      try {
        const r = await axios.get(`${API}/api/users/by-username/${u.username}`, { headers: hdr, timeout: 5000 });
        if (r.data && r.data.password) u.password = r.data.password;
        if (r.data && r.data.password_plain) u.password_plain = r.data.password_plain;
      } catch (_) {}
    }
  } catch (e) { console.error('[Users] loadPasswords:', e.message); }
}

async function init() {
  await refreshCache();
  if (USERS.length) await loadPasswords();

  if (!USERS.length) {
    console.warn('[Users] No data from FastAPI — using default admin');
    USERS = [
      { id:'1', name:'IT Admin', username:'admin', password:hashPwd('admin1234'), password_plain:'admin1234', role:'admin', brand:'ALL', active:1, line_user_id:'', phone:'', email:'' },
    ];
  }

  setInterval(async () => {
    await refreshCache();
    if (dbOK) await loadPasswords();
  }, 30000);
}

init();

function getAllUsers() {
  return USERS.filter(u => u.active === 1).map(u => ({
    id:             u.id,
    name:           u.name,
    username:       u.username,
    role:           u.role,
    brand:          u.brand,
    active:         u.active,
    line_user_id:   u.line_user_id,
    phone:          u.phone,
    email:          u.email,
    password_plain: u.password_plain,
  }));
}

function getUserById(id) {
  return USERS.find(u => String(u.id) === String(id)) || null;
}

function getUserByUsername(username) {
  return USERS.find(u => u.username === username) || null;
}

function createUser(data) {
  const { name, username, password, role, brand, line_user_id, phone, email } = data;
  if (!name || !username || !password || !role) throw new Error('Missing fields');
  if (USERS.find(u => u.username === username)) throw new Error('Username already exists');

  const hashed = hashPwd(password);
  const tmpId = 'tmp_' + Date.now();
  const user = {
    id: tmpId, name, username, password: hashed, password_plain: password,
    role, brand: brand || 'ALL', active: 1,
    line_user_id: line_user_id || '', phone: phone || '', email: email || '',
  };
  USERS.push(user);

  if (dbOK) {
    axios.post(`${API}/api/users`, {
      username, password, role, brand: brand || null,
      display_name: name, line_user_id: line_user_id || null,
      phone: phone || null, email: email || null,
    }, { headers: hdr, timeout: 8000 })
    .then(async r => {
      if (r.data.id) {
        user.id = String(r.data.id);
        console.log('[Users] CREATE OK → DB id=' + r.data.id, username);
      }
      await refreshCache();
      if (dbOK) await loadPasswords();
    })
    .catch(e => console.error('[Users] CREATE FAIL:', e.response?.data || e.message));
  }

  return { ...user, password: undefined };
}

function updateUser(id, data) {
  const i = USERS.findIndex(u => String(u.id) === String(id));
  if (i < 0) throw new Error('User not found');

  const plainPwd = data.password || null;
  if (data.password) data.password = hashPwd(data.password);

  USERS[i] = { ...USERS[i], ...data, id: USERS[i].id, username: USERS[i].username };
  if (plainPwd) USERS[i].password_plain = plainPwd;

  if (dbOK) {
    const payload = {};
    if (data.name)                       payload.display_name   = data.name;
    if (plainPwd) {
      payload.password       = plainPwd;
      payload.password_plain = plainPwd;
    }
    if (data.role)                       payload.role           = data.role;
    if (data.brand !== undefined)        payload.brand          = data.brand;
    if (data.line_user_id !== undefined) payload.line_user_id   = data.line_user_id;
    if (data.phone !== undefined)        payload.phone          = data.phone;
    if (data.email !== undefined)        payload.email          = data.email;
    if (data.active !== undefined)       payload.active         = data.active;

    if (Object.keys(payload).length) {
      axios.patch(`${API}/api/users/${id}`, payload, { headers: hdr, timeout: 8000 })
        .then(async r => {
          console.log('[Users] UPDATE OK id=' + id, 'affected=' + r.data.affected, Object.keys(payload).join(','));
          await refreshCache();
          if (dbOK) await loadPasswords();
        })
        .catch(e => console.error('[Users] UPDATE FAIL id=' + id + ':', e.response?.data || e.message));
    }
  }

  return { ...USERS[i], password: undefined };
}

function deleteUser(id) {
  const i = USERS.findIndex(u => String(u.id) === String(id));
  if (i < 0) throw new Error('User not found');
  USERS.splice(i, 1);

  if (dbOK) {
    axios.delete(`${API}/api/users/${id}`, { headers: hdr, timeout: 8000 })
      .then(async r => {
        console.log('[Users] DELETE OK id=' + id);
        await refreshCache();
        if (dbOK) await loadPasswords();
      })
      .catch(e => console.error('[Users] DELETE FAIL:', e.response?.data || e.message));
  }
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser };
