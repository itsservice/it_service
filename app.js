// app.js — IT Ticket System v2 — Express server
const express  = require('express');
const path     = require('path');
const { hashPwd, createSession, getSession, deleteSession, requireAuth, addLog, getLogs } = require('./auth');
const { getAllUsers, getUserByUsername, createUser, updateUser, deleteUser } = require('./users');
const { listTickets, getTicket, updateTicket, createTicket, debugSchema } = require('./larkService');
const larkWebhookRouter = require('./larkWebhook');
const lineWebhookRouter = require('./lineWebhook');

const app = express();
app.use(express.json({ limit: '10mb', verify: (req,_,buf) => { req.rawBody = buf; } }));

// ── SSE ───────────────────────────────────────────────────────
const sseClients = new Set();
function broadcast(evt, data) {
  const msg = `event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => { try { res.write(msg); } catch(_) { sseClients.delete(res); } });
}
app.locals.broadcast = broadcast;

// ── Static pages ──────────────────────────────────────────────
const D = __dirname;
app.get('/',          (_, r) => r.redirect('/report'));
app.get('/report',    (_, r) => r.sendFile(path.join(D, 'report.html')));
app.get('/admin',     (_, r) => r.sendFile(path.join(D, 'admin.html')));
app.get('/engineer',  (_, r) => r.sendFile(path.join(D, 'engineer.html')));
// legacy compatibility
app.get('/ticket-system', (_, r) => r.redirect('/admin'));
app.get('/portal',    (_, r) => r.redirect('/report'));

// ── SSE endpoint ──────────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch(_){} }, 25_000);
  sseClients.add(res);
  req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
});

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'กรุณากรอก username และ password' });
  const user = getUserByUsername(username);
  if (!user || !user.active) return res.status(401).json({ ok: false, error: 'ชื่อผู้ใช้ไม่ถูกต้อง' });
  if (user.password !== hashPwd(password)) return res.status(401).json({ ok: false, error: 'รหัสผ่านไม่ถูกต้อง' });
  const token = createSession(user);
  addLog({ user, action: 'login', detail: `เข้าสู่ระบบ (${user.role})` });
  res.json({ ok: true, token, user: { id: user.id, name: user.name, username: user.username, role: user.role, brand: user.brand } });
});

app.post('/api/auth/logout', requireAuth(), (req, res) => {
  addLog({ user: req.user, action: 'logout', detail: 'ออกจากระบบ' });
  deleteSession(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth(), (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ════════════════════════════════════════════════════════════════
// TICKETS
// ════════════════════════════════════════════════════════════════

// GET list (public for tracking, filtered for auth users)
app.get('/api/tickets', async (req, res) => {
  try {
    // Check if authenticated to filter by brand
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const session = token ? getSession(token) : null;
    const user = session?.user;

    let tickets = await listTickets();

    // Brand filtering for non-admin roles
    if (user && !['superadmin','admin','manager'].includes(user.role)) {
      if (user.brand && user.brand !== 'ALL') {
        tickets = tickets.filter(t => t.brand === user.brand);
      }
    }

    // Engineer: also filter by assigned
    if (user?.role === 'engineer') {
      const myBrand = user.brand;
      tickets = tickets.filter(t => t.brand === myBrand || t.assignedTo === user.name || t.engineerName === user.name);
    }

    res.json({ ok: true, tickets, total: tickets.length });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// GET single ticket (public for tracking by phone/id)
app.get('/api/tickets/:rid', async (req, res) => {
  try {
    const t = await getTicket(req.params.rid);
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// POST create ticket (public)
app.post('/api/tickets', async (req, res) => {
  try {
    const { reporter, phone, brand, branchCode, type, detail, location, sentDate } = req.body;
    if (!reporter || !phone || !brand || !type || !detail) {
      return res.status(400).json({ ok: false, error: 'กรุณากรอกข้อมูลที่จำเป็น' });
    }
    const now = new Date().toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
    const t = await createTicket({
      reporter, phone, brand, branchCode: branchCode || '', type, detail,
      location: location || '', status: 'รอตรวจงาน',
      sentDate: sentDate || now,
    });
    addLog({ action: 'create_ticket', ticketId: t._recordId, ticketLabel: t.id, detail: `สร้าง Ticket โดย ${reporter}` });
    broadcast('ticket_created', { ticket: t, ts: new Date().toISOString() });
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// PATCH update status
app.patch('/api/tickets/:rid/status', requireAuth(['superadmin','admin','manager','engineer']), async (req, res) => {
  const { rid } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ ok: false, error: 'status required' });
  try {
    const t = await updateTicket(rid, { status });
    const log = addLog({ user: req.user, action: 'update_status', ticketId: rid, ticketLabel: t.id, detail: `เปลี่ยนสถานะเป็น "${status}"` });
    broadcast('ticket_updated', { recordId: rid, status, updatedBy: req.user.name, ts: new Date().toISOString(), log });
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// PATCH assign engineer
app.patch('/api/tickets/:rid/assign', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  const { rid } = req.params;
  const { engineerName, assignedTo } = req.body;
  try {
    const t = await updateTicket(rid, { engineerName: engineerName || '', assignedTo: assignedTo || '', status: 'อยู่ระหว่างดำเนินการ' });
    const log = addLog({ user: req.user, action: 'assign', ticketId: rid, ticketLabel: t.id, detail: `มอบหมายให้ ${engineerName || assignedTo}` });
    broadcast('ticket_updated', { recordId: rid, engineerName, status: 'อยู่ระหว่างดำเนินการ', ts: new Date().toISOString(), log });
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// PATCH engineer submit work
app.patch('/api/tickets/:rid/engineer-submit', requireAuth(['superadmin','admin','manager','engineer']), async (req, res) => {
  const { rid } = req.params;
  const { workDetail, partsUsed, workHours } = req.body;
  if (!workDetail) return res.status(400).json({ ok: false, error: 'กรุณากรอกรายละเอียดงาน' });
  try {
    const now = new Date().toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
    const t = await updateTicket(rid, {
      workDetail, partsUsed: partsUsed || '', workHours: workHours || '',
      engineerName: req.user.name, completedAt: now, status: 'รอตรวจงาน',
    });
    const log = addLog({ user: req.user, action: 'engineer_submit', ticketId: rid, ticketLabel: t.id, detail: `ช่างส่งงาน: ${workDetail.slice(0,50)}` });
    broadcast('ticket_updated', { recordId: rid, status: 'รอตรวจงาน', engineerSubmit: true, engineer: req.user.name, ts: new Date().toISOString(), log });
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// PATCH admin close
app.patch('/api/tickets/:rid/close', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  const { rid } = req.params;
  const { adminNote } = req.body;
  try {
    const now = new Date().toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
    const t = await updateTicket(rid, {
      status: 'เสร็จสิ้น', adminNote: adminNote || '',
      closedAt: now, closedBy: req.user.name,
    });
    const log = addLog({ user: req.user, action: 'close', ticketId: rid, ticketLabel: t.id, detail: `ปิดงานโดย ${req.user.name}` });
    broadcast('ticket_updated', { recordId: rid, status: 'เสร็จสิ้น', closedBy: req.user.name, ts: new Date().toISOString(), log });
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// PATCH generic update (admin)
app.patch('/api/tickets/:rid', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  const { rid } = req.params;
  try {
    const t = await updateTicket(rid, req.body);
    const log = addLog({ user: req.user, action: 'update', ticketId: rid, ticketLabel: t.id, detail: `อัพเดทข้อมูล: ${Object.keys(req.body).join(', ')}` });
    broadcast('ticket_updated', { recordId: rid, fields: req.body, ts: new Date().toISOString(), log });
    res.json({ ok: true, ticket: t });
  } catch(e) { res.status(502).json({ ok: false, error: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ════════════════════════════════════════════════════════════════
app.get('/api/logs', requireAuth(['superadmin','admin','manager']), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const tid   = req.query.ticketId || null;
  res.json({ ok: true, logs: getLogs(limit, tid) });
});

// ════════════════════════════════════════════════════════════════
// USERS (admin only)
// ════════════════════════════════════════════════════════════════
app.get('/api/users', requireAuth(['superadmin','admin']), (_, res) => {
  res.json({ ok: true, users: getAllUsers() });
});

app.post('/api/users', requireAuth(['superadmin']), (req, res) => {
  try {
    const user = createUser(req.body);
    addLog({ user: req.user, action: 'create_user', detail: `สร้างผู้ใช้ ${user.name} (${user.role})` });
    res.json({ ok: true, user });
  } catch(e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.patch('/api/users/:id', requireAuth(['superadmin','admin']), (req, res) => {
  try {
    const user = updateUser(req.params.id, req.body);
    addLog({ user: req.user, action: 'update_user', detail: `แก้ไขผู้ใช้ ${user.name}` });
    res.json({ ok: true, user });
  } catch(e) { res.status(400).json({ ok: false, error: e.message }); }
});

app.delete('/api/users/:id', requireAuth(['superadmin']), (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ ok: false, error: 'ลบบัญชีตัวเองไม่ได้' });
    deleteUser(req.params.id);
    addLog({ user: req.user, action: 'delete_user', detail: `ลบผู้ใช้ id:${req.params.id}` });
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ ok: false, error: e.message }); }
});

// ── Debug ─────────────────────────────────────────────────────
app.get('/debug/env', (_, r) => r.json({
  LARK_APP_ID:    !!process.env.LARK_APP_ID,
  LARK_APP_SECRET:!!process.env.LARK_APP_SECRET,
  LARK_APP_TOKEN: !!process.env.LARK_APP_TOKEN,
  LARK_TABLE_ID:  !!process.env.LARK_TABLE_ID,
}));
app.get('/debug/lark-fields', async (_, r) => {
  try { r.json({ ok: true, ...(await debugSchema()) }); }
  catch(e) { r.status(502).json({ ok: false, error: e.message }); }
});

// ── Webhooks ──────────────────────────────────────────────────
app.use('/lark', larkWebhookRouter);
app.use('/line', lineWebhookRouter);

module.exports = app;
