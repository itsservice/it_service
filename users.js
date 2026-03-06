// users.js — User store
// ════════════════════════════════════════════════
// ✏️  แก้ชื่อช่างได้ที่นี่เลยครับ
// ════════════════════════════════════════════════
const { hashPwd } = require('./auth');

const ENGINEERS = [
  { id:'e1', name:'ช่าง 1', username:'eng1', password:'bce9905077888da6f162ce35ec0f896759202a4776395f39b69db8f38c94f150' }, // eng1234
  { id:'e2', name:'ช่าง 2', username:'eng2', password:'41e76934255628204c8eb7dff7c4e9265a3a8ba269b699780471abf01479ae5c' }, // eng2345
  { id:'e3', name:'ช่าง 3', username:'eng3', password:'00e537c965b91139a4c97e34d53b0852438b4e9c402510b24e12b4517f36de84' }, // eng3456
  { id:'e4', name:'ช่าง 4', username:'eng4', password:'0d2d34296e4e399d5c25c4458f04ab52d149a5c8ca55e3dc5e44ce85595c2d67' }, // eng4567
  { id:'e5', name:'ช่าง 5', username:'eng5', password:'f4df3f1b97d107e46a952cd0e634a896d0376cb7a03418c7a71cad8a939257d8' }, // eng5678
];

// ════════════════════════════════════════════════
// Admin accounts (อย่าเปลี่ยนโดยไม่จำเป็น)
// ════════════════════════════════════════════════
let USERS = [
  { id:'u1', name:'Super Admin',  username:'superadmin', password:'22004d5575404eabc53a9b0b76bebcc788f794acf3cef9bb8008aa12c2022e5f', role:'superadmin', brand:'ALL', active:true }, // super1234
  { id:'u2', name:'Admin System', username:'admin',      password:'1cbef4c73bf3cfb46072b35d389c7a51368adf5f57d1714054b0c835b162a57f', role:'admin',      brand:'ALL', active:true }, // admin1234
  { id:'u3', name:'Manager',      username:'manager',    password:'6224787c76914fc773e780b60a0b919c0ec280f60f9250c494de45843a407f68', role:'manager',    brand:'ALL', active:true }, // mgr1234
  // ── Engineers (จาก ENGINEERS ด้านบน) ──
  ...ENGINEERS.map(e => ({ ...e, role:'engineer', brand:"Dunkin'", active:true })),
];

function getAllUsers()           { return USERS.map(u => ({ ...u, password:undefined })); }
function getUserById(id)         { return USERS.find(u => u.id === id) || null; }
function getUserByUsername(u)    { return USERS.find(x => x.username === u) || null; }

function createUser(data) {
  const { name, username, password, role, brand } = data;
  if (!name||!username||!password||!role) throw new Error('Missing required fields');
  if (USERS.find(u => u.username === username)) throw new Error('Username already exists');
  const user = { id:'u'+Date.now(), name, username, password:hashPwd(password), role, brand:brand||'ALL', active:true, createdAt:new Date().toISOString() };
  USERS.push(user);
  return { ...user, password:undefined };
}
function updateUser(id, data) {
  const idx = USERS.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('User not found');
  if (data.password) data.password = hashPwd(data.password);
  USERS[idx] = { ...USERS[idx], ...data, id:USERS[idx].id, username:USERS[idx].username };
  return { ...USERS[idx], password:undefined };
}
function deleteUser(id) {
  const idx = USERS.findIndex(u => u.id === id);
  if (idx < 0) throw new Error('User not found');
  USERS.splice(idx, 1);
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser, ENGINEERS };
