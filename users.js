// users.js — User store
// รหัสผ่าน pre-hashed ด้วย SHA256 + salt='it-ticket-salt-2025'
const { hashPwd } = require('./auth');

// Default accounts:
// superadmin / super1234
// admin      / admin1234
// manager    / mgr1234
// eng1       / eng1234
// eng2       / eng5678
// eng3       / eng9012
let USERS = [
  { id:'u1', name:'Super Admin',   username:'superadmin', password:'22004d5575404eabc53a9b0b76bebcc788f794acf3cef9bb8008aa12c2022e5f', role:'superadmin', brand:"ALL",     active:true },
  { id:'u2', name:'Admin System',  username:'admin',      password:'1cbef4c73bf3cfb46072b35d389c7a51368adf5f57d1714054b0c835b162a57f', role:'admin',      brand:"ALL",     active:true },
  { id:'u3', name:'Manager',       username:'manager',    password:'6224787c76914fc773e780b60a0b919c0ec280f60f9250c494de45843a407f68', role:'manager',    brand:"ALL",     active:true },
  { id:'u4', name:'ช่าง เทคนิค 1', username:'eng1',       password:'bce9905077888da6f162ce35ec0f896759202a4776395f39b69db8f38c94f150', role:'engineer',   brand:"Dunkin'", active:true },
  { id:'u5', name:'ช่าง เทคนิค 2', username:'eng2',       password:'f4df3f1b97d107e46a952cd0e634a896d0376cb7a03418c7a71cad8a939257d8', role:'engineer',   brand:"Dunkin'", active:true },
  { id:'u6', name:'ช่าง เทคนิค 3', username:'eng3',       password:'120971449677300fa4d36378c729f2e622ee54f2b5d5df428f5a19111ff34455', role:'engineer',   brand:"Dunkin'", active:true },
];

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
    id: 'u' + Date.now(), name, username,
    password: hashPwd(password),
    role, brand: brand || 'ALL', active: true,
    createdAt: new Date().toISOString(),
  };
  USERS.push(user);
  return { ...user, password: undefined };
}
function updateUser(id, data) {
  const idx = USERS.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('User not found');
  if (data.password) data.password = hashPwd(data.password);
  USERS[idx] = { ...USERS[idx], ...data, id: USERS[idx].id, username: USERS[idx].username };
  return { ...USERS[idx], password: undefined };
}
function deleteUser(id) {
  const idx = USERS.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('User not found');
  USERS.splice(idx, 1);
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser };
