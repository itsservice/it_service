// app.js — IT Ticket System v2
const express = require('express');
const path    = require('path');

const { hashPwd, createSession, getSession, deleteSession, requireAuth, addLog, getLogs } = require('./auth');
const { getAllUsers, getUserByUsername, createUser, updateUser, deleteUser } = require('./users');
const { listTickets, getTicket, updateTicket, createTicket, debugSchema, ensureFieldMap, clickButton, LARK_BUTTONS } = require('./larkService');
const larkRouter = require('./larkWebhook');
const lineRouter = require('./lineWebhook');

const app = express();
app.use(express.json({ limit:'10mb', verify:(req,_,buf)=>{ req.rawBody=buf; } }));
app.use(express.urlencoded({ extended:true }));

// ── SSE ──────────────────────────────────────────────────────
const clients = new Set();
function broadcast(evt, data) {
  const msg = `event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => { try{ res.write(msg); }catch(_){ clients.delete(res); } });
}
app.locals.broadcast = broadcast;

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive' });
  res.flushHeaders();
  res.write('data: connected\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// ── Static pages ─────────────────────────────────────────────
app.get('/',          (_, res) => res.redirect('/report'));
app.get('/report',    (_, res) => res.sendFile(path.join(__dirname,'report.html')));
app.get('/admin',     (_, res) => res.sendFile(path.join(__dirname,'admin.html')));
app.get('/engineer',  (_, res) => res.sendFile(path.join(__dirname,'engineer.html')));

// ── Auth ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.json({ ok:false, error:'กรุณากรอก username และ password' });
    const user = getUserByUsername(username);
    if (!user) return res.json({ ok:false, error:'ไม่พบผู้ใช้งาน' });
    if (user.password !== hashPwd(password)) return res.json({ ok:false, error:'รหัสผ่านไม่ถูกต้อง' });
    const token = createSession(user);
    addLog({ user, action:'login', detail:`เข้าสู่ระบบ (${user.role})` });
    res.json({ ok:true, token, user:{ id:user.id, name:user.name, username:user.username, role:user.role, brand:user.brand } });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.post('/api/auth/logout', requireAuth(), (req, res) => {
  addLog({ user:req.user, action:'logout' });
  deleteSession(req.token);
  res.json({ ok:true });
});

app.get('/api/auth/me', requireAuth(), (req, res) => {
  res.json({ ok:true, user:req.user });
});

// ── Tickets ───────────────────────────────────────────────────
app.get('/api/tickets', async (req, res) => {
  try {
    let tickets = await listTickets();
    // filter by brand for engineer
    const s = getSession((req.headers.authorization||'').slice(7));
    if (s && s.user.role==='engineer' && s.user.brand !== 'ALL') {
      tickets = tickets.filter(t => t.brand === s.user.brand);
    }
    res.json({ ok:true, tickets });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.get('/api/tickets/:rid', async (req, res) => {
  try {
    const t = await getTicket(req.params.rid);
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const { reporter, phone, brand, branchCode, type, detail, location } = req.body || {};
    if (!reporter||!phone||!brand||!type||!detail)
      return res.json({ ok:false, error:'กรุณากรอกข้อมูลให้ครบ' });
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t = await createTicket({
      reporter, phone, brand, branchCode:branchCode||'', type, detail,
      location:location||'',
      // ไม่ส่ง status ตอน create — ให้ Lark ใช้ default option แรก
      // sentDate ส่งเป็น Unix ms ผ่าน toUnixMs() ใน larkService
    });
    const log = addLog({ action:'create_ticket', ticketId:t._recordId, ticketLabel:t.id, detail:`สร้างโดย ${reporter}` });
    broadcast('ticket_created', { ticket:t });
    res.json({ ok:true, ticket:t, log });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/status', requireAuth(), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.json({ ok:false, error:'Missing status' });
    const t = await updateTicket(req.params.rid, { status });
    const log = addLog({ user:req.user, action:'update_status', ticketId:req.params.rid, detail:`เปลี่ยนสถานะเป็น ${status}` });
    broadcast('ticket_updated', { recordId:req.params.rid, status, ts:new Date().toISOString(), log });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/assign', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const { engineerName, assignedTo } = req.body || {};
    // 1. บันทึกชื่อช่าง
    const t = await updateTicket(req.params.rid, { engineerName:engineerName||'', assignedTo:assignedTo||engineerName||'' });
    // 2. Trigger ปุ่ม Lark "ปุ่มเปลี่ยนช่าง" เพื่อให้ Automation ทำงาน
    await clickButton(req.params.rid, LARK_BUTTONS.changeEngineer);
    const log = addLog({ user:req.user, action:'assign', ticketId:req.params.rid, detail:`มอบหมายให้ ${engineerName}` });
    broadcast('ticket_updated', { recordId:req.params.rid, engineerName, status:'อยู่ระหว่างดำเนินการ ⚙️', ts:new Date().toISOString(), log });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/engineer-submit', requireAuth(['engineer','admin','superadmin','manager']), async (req, res) => {
  try {
    const { workDetail, partsUsed, workHours } = req.body || {};
    if (!workDetail) return res.json({ ok:false, error:'กรุณากรอกรายละเอียดงาน' });
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    // 1. บันทึกข้อมูลงาน
    const t = await updateTicket(req.params.rid, {
      workDetail, partsUsed:partsUsed||'', workHours:workHours||'',
      engineerName:req.user.name, completedAt:now
    });
    // 2. Trigger ปุ่ม Lark "ปุ่มส่งงานช่าง" เพื่อให้ Automation ทำงาน
    await clickButton(req.params.rid, LARK_BUTTONS.sendToAdmin);
    const log = addLog({ user:req.user, action:'engineer_submit', ticketId:req.params.rid, detail:`ช่างส่งงาน: ${workDetail.slice(0,50)}` });
    broadcast('ticket_updated', { recordId:req.params.rid, status:'ตรวจงาน', ts:new Date().toISOString(), log });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/close', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const { adminNote } = req.body || {};
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    // 1. บันทึก admin note + closedBy
    await updateTicket(req.params.rid, { adminNote:adminNote||'', closedAt:now, closedBy:req.user.name });
    // 2. Trigger ปุ่ม Lark "ปุ่มเสร็จงาน" เพื่อให้ Automation เปลี่ยนสถานะ
    await clickButton(req.params.rid, LARK_BUTTONS.done);
    // 3. update status ใน local ด้วย (เผื่อ automation ช้า)
    const t = await updateTicket(req.params.rid, { status:'เสร็จสิ้น ✅' });
    const log = addLog({ user:req.user, action:'close', ticketId:req.params.rid, detail:'ปิดงาน' });
    broadcast('ticket_updated', { recordId:req.params.rid, status:'เสร็จสิ้น ✅', closedBy:req.user.name, ts:new Date().toISOString(), log });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const t = await updateTicket(req.params.rid, req.body);
    const log = addLog({ user:req.user, action:'update', ticketId:req.params.rid, detail:'อัพเดทข้อมูล' });
    broadcast('ticket_updated', { recordId:req.params.rid, ts:new Date().toISOString(), log });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

// ── Logs ──────────────────────────────────────────────────────
app.get('/api/logs', requireAuth(['superadmin','admin','manager']), (req, res) => {
  const limit = parseInt(req.query.limit)||100;
  const ticketId = req.query.ticketId||null;
  res.json({ ok:true, logs:getLogs(limit, ticketId) });
});

// ── Users ─────────────────────────────────────────────────────
app.get('/api/users', requireAuth(['superadmin','admin','manager']), (req, res) => {
  res.json({ ok:true, users:getAllUsers() });
});
app.post('/api/users', requireAuth(['superadmin','admin']), (req, res) => {
  try {
    const user = createUser(req.body);
    addLog({ user:req.user, action:'create_user', detail:`สร้างผู้ใช้ ${user.username}` });
    res.json({ ok:true, user });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});
app.patch('/api/users/:id', requireAuth(['superadmin','admin']), (req, res) => {
  try {
    const user = updateUser(req.params.id, req.body);
    addLog({ user:req.user, action:'update_user', detail:`แก้ไขผู้ใช้ ${user.username}` });
    res.json({ ok:true, user });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});
app.delete('/api/users/:id', requireAuth(['superadmin']), (req, res) => {
  try {
    deleteUser(req.params.id);
    addLog({ user:req.user, action:'delete_user', detail:`ลบผู้ใช้ ${req.params.id}` });
    res.json({ ok:true });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

// ── Debug ─────────────────────────────────────────────────────
app.get('/debug/env', (_, res) => {
  res.json({
    hasLarkAppId:     !!process.env.LARK_APP_ID,
    hasLarkSecret:    !!process.env.LARK_APP_SECRET,
    hasLarkAppToken:  !!process.env.LARK_APP_TOKEN,
    hasLarkTableId:   !!process.env.LARK_TABLE_ID,
    hasLineToken:     !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    hasLineSecret:    !!process.env.LINE_CHANNEL_SECRET,
    nodeEnv:          process.env.NODE_ENV||'development',
  });
});
app.get('/debug/lark-fields', async (_, res) => {
  try { const d = await debugSchema(); res.json({ ok:true, ...d }); }
  catch(e) { res.json({ ok:false, error:e.message }); }
});

// ── Webhooks ──────────────────────────────────────────────────
app.use('/lark', larkRouter);
app.use('/line', lineRouter);

// ── Pre-load fieldMap on startup ──────────────────────────────
setTimeout(async () => {
  try { await ensureFieldMap(); console.log('[App] fieldMap ready'); }
  catch(e) { console.warn('[App] fieldMap preload failed:', e.message); }
}, 5000);

module.exports = app;
