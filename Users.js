// users.js — User store (memory, expandable to Lark)
const { hashPwd } = require('./auth');

// ── Default users (ตั้งรหัสผ่านใหม่ก่อน deploy จริง!) ─────────
let USERS = [
  { id:'u1', name:'Super Admin',   username:'superadmin', password:hashPwd('super1234'),  role:'superadmin', brand:'ALL',           active:true },
  { id:'u2', name:'Admin System',  username:'admin',      password:hashPwd('admin1234'),  role:'admin',      brand:'ALL',           active:true },
  { id:'u3', name:'Manager',       username:'manager',    password:hashPwd('mgr1234'),    role:'manager',    brand:'ALL',           active:true },
  { id:'u4', name:'ช่าง เทคนิค 1', username:'eng1',       password:hashPwd('eng1234'),    role:'engineer',   brand:'Greyhound Cafe', active:true },
  { id:'u5', name:'ช่าง เทคนิค 2', username:'eng2',       password:hashPwd('eng5678'),    role:'engineer',   brand:'Au Bon Pain',    active:true },
  { id:'u6', name:'ช่าง เทคนิค 3', username:'eng3',       password:hashPwd('eng9012'),    role:'engineer',   brand:"Dunkin'",        active:true },
];

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Admin',
  manager:    'Manager',
  engineer:   'ช่าง',
  staff:      'Staff',
};

function getAllUsers() {
  return USERS.map(u => ({ ...u, password: undefined }));
}

function getUserById(id) {
  return USERS.find(u => u.id === id) || null;
}

function getUserByUsername(username) {
  return USERS.find(u => u.username === username) || null;
}

function createUser(data) {
  const { name, username, password, role, brand } = data;
  if (!name || !username || !password || !role) throw new Error('Missing required fields');
  if (USERS.find(u => u.username === username)) throw new Error('Username already exists');
  const user = {
    id: 'u' + Date.now(),
    name, username,
    password: hashPwd(password),
    role, brand: brand || 'ALL',
    active: true,
    createdAt: new Date().toISOString(),
  };
  USERS.push(user);
  return { ...user, password: undefined };
}

function updateUser(id, data) {
  const idx = USERS.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('User not found');
  const u = USERS[idx];
  if (data.password) data.password = hashPwd(data.password);
  USERS[idx] = { ...u, ...data, id: u.id, username: u.username };
  return { ...USERS[idx], password: undefined };
}

function deleteUser(id) {
  const idx = USERS.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('User not found');
  USERS.splice(idx, 1);
}

module.exports = {
  getAllUsers, getUserById, getUserByUsername,
  createUser, updateUser, deleteUser,
  ROLE_LABELS,
};
