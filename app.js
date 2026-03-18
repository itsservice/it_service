// app.js — IT Ticket System v2
const express = require('express');
const path    = require('path');

const { hashPwd, createSession, getSession, deleteSession, requireAuth, addLog, getLogs } = require('./auth');
const { getAllUsers, getUserByUsername, createUser, updateUser, deleteUser } = require('./users');
const { listTickets, getTicket, updateTicket, createTicket, debugSchema, ensureFieldMap, invalidateCache } = require('./larkService');
const larkRouter   = require('./larkWebhook');
const lineRouter   = require('./lineWebhook');
const lineNotify   = require('./lineNotify');
const lineConfig   = require('./lineConfig');

const app = express();
app.use(express.json({ limit:'10mb', verify:(req,_,buf)=>{ req.rawBody=buf; } }));
app.use(express.urlencoded({ extended:true }));

// ── Request timeout ─────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/api/events') return next();
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      console.warn(`[Timeout] ${req.method} ${req.path} — 25s`);
      res.status(503).json({ ok:false, error:'Request timeout' });
    }
  }, 25_000);
  res.on('finish', () => clearTimeout(timer));
  res.on('close',  () => clearTimeout(timer));
  next();
});

// ── SSE ─────────────────────────────────────────────────────
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

// ── Health ──────────────────────────────────────────────────
app.get('/health', (_, res) => {
  const mb = process.memoryUsage().heapUsed / 1024 / 1024;
  res.json({ ok:true, ts:Date.now(), uptime:Math.floor(process.uptime()), memory:`${mb.toFixed(0)}MB` });
});

// ── Static ──────────────────────────────────────────────────
app.get('/', (_, res) => res.redirect('/Itsupportlanding'));

const noCacheHtml = (file) => (_, res) => {
  res.set({ 'Cache-Control':'no-store,no-cache,must-revalidate','Pragma':'no-cache','Expires':'0' });
  res.sendFile(path.join(__dirname, file));
};

app.get('/Itsupportlanding', noCacheHtml('itsupport-landing.html'));
app.get('/landing',          noCacheHtml('itsupport-landing.html'));
app.get('/report',           noCacheHtml('report.html'));
app.get('/report/:brand',    noCacheHtml('report.html'));
app.get('/admin',            noCacheHtml('admin.html'));
app.get('/engineer',         noCacheHtml('engineer.html'));

// ── Auth ────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.json({ ok:false, error:'กรุณากรอก username และ password' });
    const user = getUserByUsername(username);
    if (!user) return res.json({ ok:false, error:`ไม่พบ username "${username}"` });
    if (!user.active) return res.json({ ok:false, error:'บัญชีนี้ถูกระงับ' });
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

// ═══════════════════════════════════════════════════════════
// LINE SETTINGS API
// ═══════════════════════════════════════════════════════════
app.get('/api/line-config', requireAuth(['superadmin','admin']), (req, res) => {
  res.json({
    ok: true,
    config: lineConfig.getConfig(),
    hasToken: lineConfig.hasToken(),
    tokenPreview: lineConfig.getTokenPreview(),
  });
});

app.patch('/api/line-config', requireAuth(['superadmin','admin']), (req, res) => {
  try {
    const updated = lineConfig.updateConfig(req.body);
    addLog({ user:req.user, action:'update_line_config', detail:'อัปเดตค่า LINE Settings' });
    res.json({ ok:true, config:updated });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.post('/api/line-config/test', requireAuth(['superadmin','admin']), async (req, res) => {
  try {
    const { to } = req.body || {};
    if (!to) return res.json({ ok:false, error:'กรุณาระบุ LINE ID ที่ต้องการทดสอบ' });
    const result = await lineNotify.push(to, [{ type:'text', text:'Test from IT Support Hub — LINE connection OK' }]);
    addLog({ user:req.user, action:'test_line', detail:`ทดสอบ LINE -> ${to.slice(0,12)}... result=${result.ok}` });
    res.json(result);
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

// ═══════════════════════════════════════════════════════════
// BRANCHES
// ═══════════════════════════════════════════════════════════
const BRANCH_TABLES = [
  { brand: "Dunkin'",           tableId: process.env.LARK_BRANCH_DUNKIN },
  { brand: "Greyhound Cafe",    tableId: process.env.LARK_BRANCH_GREYHOUND_CAFE },
  { brand: "Greyhound Original",tableId: null },
  { brand: "Au Bon Pain",       tableId: process.env.LARK_BRANCH_AU_BON_PAIN },
  { brand: "Funky Fries",       tableId: process.env.LARK_BRANCH_FUNKY_FRIES },
];

let _branchCache = null, _branchCacheExp = 0;

app.get('/api/branches', async (req, res) => {
  try {
    if (_branchCache && Date.now() < _branchCacheExp) return res.json({ ok:true, branches:_branchCache });
    const { getToken } = require('./larkService');
    const axios = require('axios');
    const BASE = 'https://open.larksuite.com/open-apis';
    const APP = process.env.LARK_APP_TOKEN;
    const token = await getToken();
    const result = {};

    async function fetchAll(tableId) {
      let all=[], pt;
      do {
        const r = await axios.get(`${BASE}/bitable/v1/apps/${APP}/tables/${tableId}/records`,
          { headers:{Authorization:`Bearer ${token}`}, params:{page_size:100,...(pt?{page_token:pt}:{})}, timeout:12000 });
        all = all.concat(r.data.data?.items||[]);
        pt = r.data.data?.has_more ? r.data.data.page_token : null;
      } while(pt);
      return all;
    }

    function parseBranch(fields) {
      return {
        code: String(fields['รหัสสาขา']||fields['Shop Code']||'').trim(),
        nameTh: String(fields['ชื่อสาขา (Thai)']||fields['ชื่อสาขา']||'').replace(/^'+|'+$/g,'').trim(),
        nameEn: String(fields['ชื่อสาขา (English)']||fields['Shop Name (English)']||'').replace(/^'+|'+$/g,'').trim()
      };
    }

    const masterTableId = process.env.LARK_BRANCH_TABLE;
    if (masterTableId) {
      const items = await fetchAll(masterTableId);
      items.forEach(rec => {
        const f = rec.fields||{};
        const rv = f['แบรนด์']||f['Brand']||'';
        const bv = typeof rv==='object'&&'text' in rv ? rv.text : String(rv);
        const b = parseBranch(f);
        if (b.code && bv) { if(!result[bv])result[bv]=[]; result[bv].push(b); }
      });
    }

    await Promise.allSettled(
      BRANCH_TABLES.filter(b=>b.tableId&&!result[b.brand]?.length).map(async({brand,tableId})=>{
        const items = await fetchAll(tableId);
        result[brand] = items.map(r=>parseBranch(r.fields||{})).filter(b=>b.code);
      })
    );

    _branchCache = result;
    _branchCacheExp = Date.now()+10*60*1000;
    res.json({ ok:true, branches:result });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

// ═══════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════
const _ticketBrandCache = new Map();

app.get('/api/tickets', async (req, res) => {
  try {
    let tickets = await Promise.race([
      listTickets(),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),15000))
    ]).catch(async()=>{ try{return await require('./larkService').listTickets({noCache:false})||[];}catch(_){return[];} });
    const s = getSession((req.headers.authorization||'').slice(7));
    if (s&&s.user.role==='engineer'&&s.user.brand!=='ALL') tickets=tickets.filter(t=>t.brand===s.user.brand);
    tickets.forEach(t=>{ if(t._recordId&&t.brand) _ticketBrandCache.set(t._recordId,t.brand); });
    global._debugTickets = tickets;
    res.json({ ok:true, tickets });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.get('/api/tickets/:rid', async (req, res) => {
  try { res.json({ ok:true, ticket: await getTicket(req.params.rid) }); }
  catch(e) { res.json({ ok:false, error:e.message }); }
});

function getBrand(rid, body) { return body?.brand || _ticketBrandCache.get(rid) || null; }

app.post('/api/tickets', async (req, res) => {
  try {
    const { reporter, phone, brand, branchCode, type, detail, location } = req.body || {};
    if (!reporter||!phone||!brand||!type||!detail) return res.json({ ok:false, error:'กรุณากรอกข้อมูลให้ครบ' });
    const _n = new Date();
    const sentDateISO = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`;
    const t = await createTicket({ reporter,phone,brand,branchCode:branchCode||'',type,detail,location:location||'',status:'รอดำเนินการ ⏱️',sentDate:sentDateISO });
    const log = addLog({ action:'create_ticket', ticketId:t._recordId, ticketLabel:t.id, detail:`สร้างโดย ${reporter} | ${brand}` });
    broadcast('ticket_created', { ticket:t });
    lineNotify.notifyNewTicket(t).catch(e=>console.error('[LINE]',e.message));
    res.json({ ok:true, ticket:t, log });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/status', requireAuth(), async (req, res) => {
  try {
    const { status, started_at, completed_lat, completed_lng } = req.body || {};
    if (!status) return res.json({ ok:false, error:'Missing status' });
    const brand = getBrand(req.params.rid, req.body);
    const updates = { status, brand };
    if (started_at) updates.started_at = started_at;
    if (completed_lat) updates.completed_lat = completed_lat;
    if (completed_lng) updates.completed_lng = completed_lng;
    const t = await updateTicket(req.params.rid, updates);
    addLog({ user:req.user, action:'update_status', ticketId:req.params.rid, detail:`สถานะ -> ${status}` });
    broadcast('ticket_updated', { recordId:req.params.rid, status, ts:new Date().toISOString() });
    if (status.includes('แก้ไข')||status.includes('revision')) {
      const eng = getAllUsers().find(u=>u.name===t.engineerName);
      lineNotify.notifyRevision(t, eng?.line_user_id).catch(e=>console.error('[LINE]',e.message));
    }
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/assign', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const { engineerName, assignedTo } = req.body || {};
    if (!engineerName) return res.json({ ok:false, error:'กรุณาระบุชื่อช่าง' });
    const brand = getBrand(req.params.rid, req.body);
    const t = await updateTicket(req.params.rid, { engineerName, assignedTo:assignedTo||engineerName, status:'อยู่ระหว่างดำเนินการ ⚙️', brand });
    addLog({ user:req.user, action:'assign', ticketId:req.params.rid, detail:`มอบหมาย -> ${engineerName}` });
    broadcast('ticket_updated', { recordId:req.params.rid, engineerName, status:'อยู่ระหว่างดำเนินการ ⚙️', ts:new Date().toISOString() });
    const eng = getAllUsers().find(u=>u.name===engineerName);
    lineNotify.notifyAssigned(t, eng?.line_user_id).catch(e=>console.error('[LINE]',e.message));
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/reassign', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const { newEngineerName } = req.body || {};
    if (!newEngineerName) return res.json({ ok:false, error:'กรุณาระบุชื่อช่างใหม่' });
    const old = await getTicket(req.params.rid);
    const brand = getBrand(req.params.rid, req.body);
    const t = await updateTicket(req.params.rid, { engineerName:newEngineerName, assignedTo:newEngineerName, status:'อยู่ระหว่างดำเนินการ ⚙️', brand });
    addLog({ user:req.user, action:'reassign', ticketId:req.params.rid, detail:`เปลี่ยนช่าง ${old?.engineerName||'-'} -> ${newEngineerName}` });
    broadcast('ticket_updated', { recordId:req.params.rid, engineerName:newEngineerName, ts:new Date().toISOString() });
    const users = getAllUsers();
    lineNotify.notifyReassigned(t, users.find(u=>u.name===old?.engineerName)?.line_user_id, users.find(u=>u.name===newEngineerName)?.line_user_id).catch(e=>console.error('[LINE]',e.message));
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/engineer-submit', requireAuth(['engineer','lead_engineer','admin','superadmin','manager']), async (req, res) => {
  try {
    const { workDetail, partsUsed, workHours, completed_lat, completed_lng } = req.body || {};
    if (!workDetail) return res.json({ ok:false, error:'กรุณากรอกรายละเอียดงาน' });
    const brand = getBrand(req.params.rid, req.body);
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const updates = { workDetail, partsUsed:partsUsed||'', workHours:workHours||'', engineerName:req.user.name, completedAt:now, status:'ตรวจงาน', brand };
    if (completed_lat) updates.completed_lat = completed_lat;
    if (completed_lng) updates.completed_lng = completed_lng;
    const t = await updateTicket(req.params.rid, updates);
    addLog({ user:req.user, action:'engineer_submit', ticketId:req.params.rid, detail:`ส่งงาน: ${workDetail.slice(0,50)}` });
    broadcast('ticket_updated', { recordId:req.params.rid, status:'ตรวจงาน', ts:new Date().toISOString() });
    lineNotify.notifyWorkSubmitted(t).catch(e=>console.error('[LINE]',e.message));
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/engineer', requireAuth(['engineer','lead_engineer','admin','superadmin','manager']), async (req, res) => {
  try {
    const { workDetail, status, engineerName } = req.body || {};
    if (!workDetail) return res.json({ ok:false, error:'กรุณากรอกรายละเอียดงาน' });
    const brand = getBrand(req.params.rid, req.body);
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t = await updateTicket(req.params.rid, { workDetail, engineerName:engineerName||req.user.name, completedAt:now, status:status||'ตรวจงาน', brand });
    addLog({ user:req.user, action:'engineer_submit', ticketId:req.params.rid, detail:`ส่งงาน: ${workDetail.slice(0,50)}` });
    broadcast('ticket_updated', { recordId:req.params.rid, status:status||'ตรวจงาน', ts:new Date().toISOString() });
    lineNotify.notifyWorkSubmitted(t).catch(e=>console.error('[LINE]',e.message));
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/close', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const { adminNote } = req.body || {};
    const brand = getBrand(req.params.rid, req.body);
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t = await updateTicket(req.params.rid, { status:'เสร็จสิ้น ✅', adminNote:adminNote||'', closedAt:now, closedBy:req.user.name, brand });
    addLog({ user:req.user, action:'close', ticketId:req.params.rid, detail:'ปิดงาน' });
    broadcast('ticket_updated', { recordId:req.params.rid, status:'เสร็จสิ้น ✅', ts:new Date().toISOString() });
    lineNotify.notifyTicketClosed(t).catch(e=>console.error('[LINE]',e.message));
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const brand = getBrand(req.params.rid, req.body);
    const t = await updateTicket(req.params.rid, { ...req.body, brand });
    addLog({ user:req.user, action:'update', ticketId:req.params.rid, detail:'อัปเดต' });
    broadcast('ticket_updated', { recordId:req.params.rid, ts:new Date().toISOString() });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

// ═══════════════════════════════════════════════════════════
// LOGS / USERS
// ═══════════════════════════════════════════════════════════
app.get('/api/logs', requireAuth(['superadmin','admin','manager']), (req, res) => {
  res.json({ ok:true, logs:getLogs(parseInt(req.query.limit)||100, req.query.ticketId||null) });
});

app.get('/api/users', requireAuth(['superadmin','admin','manager']), (_, res) => res.json({ ok:true, users:getAllUsers() }));
app.post('/api/users', requireAuth(['superadmin','admin']), (req, res) => {
  try { const u=createUser(req.body); addLog({user:req.user,action:'create_user',detail:`สร้าง ${u.username}`}); res.json({ok:true,user:u}); }
  catch(e) { res.json({ok:false,error:e.message}); }
});
app.patch('/api/users/:id', requireAuth(['superadmin','admin']), (req, res) => {
  try { const u=updateUser(req.params.id,req.body); addLog({user:req.user,action:'update_user',detail:`แก้ไข ${u.username}`}); res.json({ok:true,user:u}); }
  catch(e) { res.json({ok:false,error:e.message}); }
});
app.delete('/api/users/:id', requireAuth(['superadmin']), (req, res) => {
  try { deleteUser(req.params.id); addLog({user:req.user,action:'delete_user',detail:`ลบ ${req.params.id}`}); res.json({ok:true}); }
  catch(e) { res.json({ok:false,error:e.message}); }
});

// ═══════════════════════════════════════════════════════════
// GPS — ผ่าน FastAPI (repair.mobile1234.site)
// ═══════════════════════════════════════════════════════════
const FASTAPI_URL = 'https://repair.mobile1234.site';
const FASTAPI_KEY = 'repair123';

app.post('/api/gps', requireAuth(), async (req, res) => {
  try {
    const { latitude, longitude, accuracy, ticket_id } = req.body || {};
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) return res.json({ ok:false, error:'Missing coordinates' });
    const axios = require('axios');
    await axios.post(`${FASTAPI_URL}/api/gps`, {
      user_id: String(req.user.id),
      engineer_name: req.user.name,
      brand: req.user.brand || null,
      latitude: lat,
      longitude: lng,
      accuracy: accuracy ? parseFloat(accuracy) : null,
      ticket_id: ticket_id || null
    }, { headers: { 'X-API-Key': FASTAPI_KEY }, timeout: 8000 });
    broadcast('gps_updated', { user_id:req.user.id, engineer_name:req.user.name, latitude:lat, longitude:lng });
    res.json({ ok:true });
  } catch(e) {
    console.error('[GPS POST]', e.message);
    res.json({ ok:false, error:e.message });
  }
});

app.get('/api/gps', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const axios = require('axios');
    const r = await axios.get(`${FASTAPI_URL}/api/gps`, {
      headers: { 'X-API-Key': FASTAPI_KEY }, timeout: 8000
    });
    res.json(r.data);
  } catch(e) {
    console.error('[GPS GET]', e.message);
    res.json({ ok:true, locations:[] });
  }
});

// ═══════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════
app.get('/debug/gps', async (_, res) => {
  try {
    const axios = require('axios');
    const r = await axios.get(`${FASTAPI_URL}/api/gps`, {
      headers: { 'X-API-Key': FASTAPI_KEY }, timeout: 8000
    });
    res.json({ ok:true, count:r.data.locations?.length||0, rows:r.data.locations });
  } catch(e) {
    res.json({ ok:false, error:e.message });
  }
});

app.get('/debug/env', (_, res) => {
  res.json({
    hasLarkAppId:!!process.env.LARK_APP_ID, hasLarkSecret:!!process.env.LARK_APP_SECRET,
    hasLarkAppToken:!!process.env.LARK_APP_TOKEN, hasLarkTableId:!!process.env.LARK_TABLE_ID,
    hasLineToken:!!process.env.LINE_CHANNEL_ACCESS_TOKEN, hasLineSecret:!!process.env.LINE_CHANNEL_SECRET,
    hasLineAdminGroup:!!lineConfig.getAdminGroupId(),
    lineAdminGroup: lineConfig.getAdminGroupId() ? lineConfig.getAdminGroupId().slice(0,10)+'...' : '(not set)',
    nodeEnv: process.env.NODE_ENV||'development',
    appUrl: process.env.APP_URL||'(not set)',
  });
});

app.get('/debug/rebuild-fieldmap', async (_,res) => {
  try { await ensureFieldMap(true); const d=await debugSchema(); res.json({ok:true,...d}); }
  catch(e) { res.json({ok:false,error:e.message}); }
});

app.get('/debug/tables', async (_,res) => {
  const { getToken } = require('./larkService');
  const axios = require('axios');
  const BASE='https://open.larksuite.com/open-apis', APP=process.env.LARK_APP_TOKEN;
  const tables=[
    {brand:"Dunkin'",tableId:process.env.LARK_TABLE_DUNKIN||process.env.LARK_TABLE_ID},
    {brand:"Greyhound Cafe",tableId:process.env.LARK_TABLE_GREYHOUND_CAFE},
    {brand:"Greyhound Original",tableId:process.env.LARK_TABLE_GREYHOUND_ORIGINAL||process.env.LARK_TABLE_GREYHOUND_ORI},
    {brand:"Au Bon Pain",tableId:process.env.LARK_TABLE_AU_BON_PAIN},
    {brand:"Funky Fries",tableId:process.env.LARK_TABLE_FUNKY_FRIES},
  ];
  try {
    const token=await getToken();
    const results=await Promise.allSettled(tables.map(async({brand,tableId})=>{
      if(!tableId)return{brand,status:'NO_ENV',count:0};
      const r=await axios.get(`${BASE}/bitable/v1/apps/${APP}/tables/${tableId}/records`,{headers:{Authorization:`Bearer ${token}`},params:{page_size:10},timeout:10000});
      return{brand,tableId,status:r.data.code===0?'OK':'ERROR',count:r.data.data?.total||0};
    }));
    res.json({ok:true,tables:results.map((r,i)=>r.status==='fulfilled'?r.value:{brand:tables[i].brand,error:r.reason?.message})});
  } catch(e){res.json({ok:false,error:e.message});}
});

app.get('/debug/test-line', async (_,res) => {
  const to = lineConfig.getAdminGroupId();
  if (!to) return res.json({ ok:false, error:'No Admin Group ID set — go to Admin > LINE Settings' });
  const result = await lineNotify.push(to, [{ type:'text', text:'Test from IT Support Hub' }]);
  res.json(result);
});

app.get('/debug/lark-fields', async (_,res) => {
  try { res.json({ok:true,...await debugSchema()}); } catch(e){res.json({ok:false,error:e.message});}
});

app.get('/debug/branches', (_,res) => {
  const tickets=global._debugTickets||[];
  const byBrand={};
  tickets.forEach(t=>{ if(!byBrand[t.brand||'?'])byBrand[t.brand||'?']=new Set(); if(t.branchCode)byBrand[t.brand||'?'].add(t.branchCode); });
  const result={};
  Object.entries(byBrand).forEach(([b,s])=>{result[b]=[...s].sort();});
  res.json({ok:true,total:tickets.length,branchCodes:result});
});

// ── Webhooks ────────────────────────────────────────────────
app.use('/lark', larkRouter);
app.use('/line', lineRouter);

// ── Startup ─────────────────────────────────────────────────
setTimeout(async () => {
  try { await ensureFieldMap(); console.log('[App] fieldMap ready'); } catch(e) { console.warn('[App]',e.message); }
}, 3000);

module.exports = app;
