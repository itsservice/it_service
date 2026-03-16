// users.js
// ════════════════════════════════
// ✏️ แก้ชื่อช่าง / เพิ่ม LINE User ID ได้ที่นี่
// ════════════════════════════════
const { hashPwd } = require('./auth');

const ENGINEERS = [
  { id:'e1', name:'ช่าง 1', username:'eng1', pwd:'eng1234', line_user_id:'' },
  { id:'e2', name:'ช่าง 2', username:'eng2', pwd:'eng2345', line_user_id:'' },
  { id:'e3', name:'ช่าง 3', username:'eng3', pwd:'eng3456', line_user_id:'' },
  { id:'e4', name:'ช่าง 4', username:'eng4', pwd:'eng4567', line_user_id:'' },
  { id:'e5', name:'ช่าง 5', username:'eng5', pwd:'eng5678', line_user_id:'' },
];

let USERS = [
  { id:'u1', name:'Super Admin',  username:'superadmin', password:hashPwd('super1234'), role:'superadmin', brand:'ALL', active:true, line_user_id:'', phone:'' },
  { id:'u2', name:'Admin System', username:'admin',      password:hashPwd('admin1234'), role:'admin',      brand:'ALL', active:true, line_user_id:'', phone:'' },
  { id:'u3', name:'Manager',      username:'manager',    password:hashPwd('mgr1234'),   role:'manager',    brand:'ALL', active:true, line_user_id:'', phone:'' },
  ...ENGINEERS.map(e => ({
    id: e.id, name: e.name, username: e.username,
    password: hashPwd(e.pwd),
    role:'engineer', brand:"Dunkin'", active:true,
    line_user_id: e.line_user_id || '',
    phone: '',
  })),
];

function getAllUsers() {
  return USERS.map(u => ({
    ...u,
    password: undefined,
    line_user_id: u.line_user_id || '',
    phone: u.phone || '',
  }));
}

function getUserById(id)      { return USERS.find(u=>u.id===id)||null; }
function getUserByUsername(u)  { return USERS.find(x=>x.username===u)||null; }

function createUser(data) {
  const { name, username, password, role, brand, line_user_id, phone } = data;
  if (!name||!username||!password||!role) throw new Error('Missing fields');
  if (USERS.find(u=>u.username===username)) throw new Error('Username already exists');
  const user = {
    id: 'u'+Date.now(),
    name,
    username,
    password: hashPwd(password),
    role,
    brand: brand||'ALL',
    active: true,
    line_user_id: line_user_id || '',
    phone: phone || '',
  };
  USERS.push(user);
  return { ...user, password:undefined };
}

function updateUser(id, data) {
  const i = USERS.findIndex(u=>u.id===id);
  if (i<0) throw new Error('User not found');
  // hash password ถ้ามีส่งมา
  if (data.password) data.password = hashPwd(data.password);
  // merge ทุก field รวม line_user_id, phone
  USERS[i] = {
    ...USERS[i],
    ...data,
    id: USERS[i].id,           // ห้ามเปลี่ยน
    username: USERS[i].username // ห้ามเปลี่ยน
  };
  return { ...USERS[i], password:undefined };
}

function deleteUser(id) {
  const i = USERS.findIndex(u=>u.id===id);
  if (i<0) throw new Error('User not found');
  USERS.splice(i,1);
}

module.exports = { getAllUsers, getUserById, getUserByUsername, createUser, updateUser, deleteUser };
