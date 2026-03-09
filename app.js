// app.js — IT Ticket System v2
const express = require('express');
const path    = require('path');

const { hashPwd, createSession, getSession, deleteSession, requireAuth, addLog, getLogs } = require('./auth');
const { getAllUsers, getUserByUsername, createUser, updateUser, deleteUser } = require('./users');
const { listTickets, getTicket, updateTicket, createTicket, debugSchema, ensureFieldMap, invalidateCache } = require('./larkService');
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
// Health check - lightweight, used by keep-alive
app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.get('/', (_, res) => res.redirect('/report'));

// No-cache headers สำหรับ HTML ทุกหน้า — บังคับ browser โหลดใหม่ทุกครั้ง
const noCacheHtml = (file) => (_, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.sendFile(path.join(__dirname, file));
};
app.get('/report',         noCacheHtml('report.html'));
// Brand-specific report URLs
app.get('/report/:brand',  noCacheHtml('report.html'));
app.get('/admin',    noCacheHtml('admin.html'));
app.get('/engineer', noCacheHtml('engineer.html'));

// ── Auth ──────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
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
// ── Branch list API ─────────────────────────────────────────
// ดึงรายการสาขาจาก Lark Branch tables
const BRANCH_TABLES = [
  { brand: "Dunkin'",          tableId: process.env.LARK_BRANCH_DUNKIN },
  { brand: "Greyhound Cafe",   tableId: process.env.LARK_BRANCH_GREYHOUND_CAFE },
  { brand: "Greyhound Original",tableId: null },
  { brand: "Au Bon Pain",      tableId: process.env.LARK_BRANCH_AU_BON_PAIN },
  { brand: "Funky Fries",      tableId: process.env.LARK_BRANCH_FUNKY_FRIES },
];

let _branchCache = null, _branchCacheExp = 0;
// cache cleared on restart

app.get('/api/branches', async (req, res) => {
  try {
    // cache 10 นาที
    if (_branchCache && Date.now() < _branchCacheExp) {
      return res.json({ ok:true, branches: _branchCache });
    }
    const { getToken } = require('./larkService');
    const axios = require('axios');
    const BASE  = 'https://open.larksuite.com/open-apis';
    const APP   = process.env.LARK_APP_TOKEN;
    const token = await getToken();

    const result = {};
    await Promise.allSettled(
      BRANCH_TABLES.filter(b => b.tableId).map(async ({ brand, tableId }) => {
        let all = [], pt;
        do {
          const r = await axios.get(
            `${BASE}/bitable/v1/apps/${APP}/tables/${tableId}/records`,
            { headers: { Authorization: `Bearer ${token}` }, params: { page_size: 100, ...(pt?{page_token:pt}:{}) }, timeout: 12000 }
          );
          const items = r.data.data?.items || [];
          items.forEach(rec => {
            const fields = rec.fields || {};
            // ใช้ "รหัสสาขา" เป็นหลัก — ไม่ใช้ "สาขา" (เป็น tag/option)
            const code   = fields['รหัสสาขา'] || fields['Shop Code'] || fields['shop_code'] || '';
            const nameTh = fields['ชื่อสาขา (Thai)'] || fields['Shop Name (Thai)'] || fields['ชื่อสาขา'] || '';
            const nameEn = fields['ชื่อสาขา (English)'] || fields['Shop Name (English)'] || fields['Shop Name (Eng)'] || '';
            const codeStr = String(code).trim();
            // กรองออก: ว่าง, มีช่องว่าง, หรือขึ้นต้นด้วย ' (single quote จาก Lark)
            const isClean = codeStr.length > 0;
            if (isClean) all.push({ code: codeStr, nameTh: String(nameTh).replace(/^'+|'+$/g,'').trim(), nameEn: String(nameEn).replace(/^'+|'+$/g,'').trim() });
          });
          pt = r.data.data?.has_more ? r.data.data.page_token : null;
        } while (pt);
        result[brand] = all;
        console.log(`[Branches] ${brand}: ${all.length} branches`);
      })
    );

    _branchCache = result;
    _branchCacheExp = Date.now() + 10 * 60 * 1000;
    res.json({ ok:true, branches: result });
  } catch(e) {
    console.error('[Branches] error:', e.message);
    res.json({ ok:false, error: e.message });
  }
});

app.get('/api/tickets', async (req, res) => {
  try {
    // timeout รวม 20s — ถ้า Lark ช้าเกินให้ return ของที่มีก่อน
    let tickets = await Promise.race([
      listTickets(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20_000))
    ]).catch(async (e) => {
      console.warn('[API] listTickets timeout/error:', e.message, '— returning cache or []');
      return require('./larkService').listTickets({ noCache: false }).catch(() => []);
    });
    const s = getSession((req.headers.authorization||'').slice(7));
    if (s && s.user.role==='engineer' && s.user.brand !== 'ALL') {
      tickets = tickets.filter(t => t.brand === s.user.brand);
    }
    global._debugTickets = tickets;
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
    const t = await createTicket({ reporter, phone, brand, branchCode:branchCode||'', type, detail, location:location||'' });
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
    // Update ชื่อช่าง + สถานะ อยู่ระหว่างดำเนินการ
    const t = await updateTicket(req.params.rid, {
      engineerName: engineerName||'',
      assignedTo:   assignedTo||engineerName||'',
      status:       'อยู่ระหว่างดำเนินการ ⚙️'
    });
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
    const t = await updateTicket(req.params.rid, {
      workDetail, partsUsed:partsUsed||'', workHours:workHours||'',
      engineerName:req.user.name, completedAt:now, status:'ตรวจงาน'
    });
    const log = addLog({ user:req.user, action:'engineer_submit', ticketId:req.params.rid, detail:`ช่างส่งงาน: ${workDetail.slice(0,50)}` });
    broadcast('ticket_updated', { recordId:req.params.rid, status:'ตรวจงาน', ts:new Date().toISOString(), log });
    res.json({ ok:true, ticket:t });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

app.patch('/api/tickets/:rid/close', requireAuth(['superadmin','admin','manager']), async (req, res) => {
  try {
    const { adminNote } = req.body || {};
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t = await updateTicket(req.params.rid, {
      status:'เสร็จสิ้น ✅', adminNote:adminNote||'', closedAt:now, closedBy:req.user.name
    });
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
  res.json({ ok:true, logs:getLogs(parseInt(req.query.limit)||100, req.query.ticketId||null) });
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
    hasLarkAppId:    !!process.env.LARK_APP_ID,
    hasLarkSecret:   !!process.env.LARK_APP_SECRET,
    hasLarkAppToken: !!process.env.LARK_APP_TOKEN,
    hasLarkTableId:  !!process.env.LARK_TABLE_ID,
    hasLineToken:    !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    hasLineSecret:   !!process.env.LINE_CHANNEL_SECRET,
    nodeEnv:         process.env.NODE_ENV||'development',
  });
});
// ── DEBUG: ทดสอบดึงข้อมูลจากทุก table ──────────────────────────
// DEBUG: ดู branchCode จาก cache เท่านั้น — ไม่ fetch Lark
// DEBUG: ดู raw fields จาก branch table
app.get('/debug/branch-raw', async (req, res) => {
  try {
    const { getToken } = require('./larkService');
    const axios = require('axios');
    const BASE  = 'https://open.larksuite.com/open-apis';
    const APP   = process.env.LARK_APP_TOKEN;
    const token = await getToken();

    // ลอง Dunkin branch table ก่อน
    const tableId = process.env.LARK_BRANCH_DUNKIN;
    if(!tableId) return res.json({ ok:false, error:'LARK_BRANCH_DUNKIN not set', env: Object.keys(process.env).filter(k=>k.startsWith('LARK')) });

    const r = await axios.get(
      `${BASE}/bitable/v1/apps/${APP}/tables/${tableId}/records`,
      { headers: { Authorization: `Bearer ${token}` }, params: { page_size: 3 }, timeout: 12000 }
    );
    const items = r.data.data?.items || [];
    // แสดง field names ของ record แรก
    const firstFields = items[0]?.fields || {};
    res.json({
      ok: true,
      larkCode: r.data.code,
      tableId,
      totalReturned: items.length,
      fieldNames: Object.keys(firstFields),
      firstRecord: firstFields,
      envKeys: Object.keys(process.env).filter(k=>k.startsWith('LARK'))
    });
  } catch(e) {
    res.json({ ok:false, error: e.message });
  }
});

app.get('/debug/branches', (_, res) => {
  try {
    // อ่าน _ticketCache โดยตรง ไม่รอ API
    const svc = require('./larkService');
    // ใช้ tickets ที่ cache ไว้แล้วใน memory
    const tickets = global._debugTickets || [];
    const byBrand = {};
    tickets.forEach(t => {
      const b = t.brand || 'unknown';
      if(!byBrand[b]) byBrand[b] = new Set();
      if(t.branchCode) byBrand[b].add(t.branchCode);
    });
    const result = {};
    Object.entries(byBrand).forEach(([brand, set]) => {
      result[brand] = [...set].sort();
    });
    res.json({ ok:true, total: tickets.length, cached: !!global._debugTickets, branchCodes: result });
  } catch(e) {
    res.json({ ok:false, error: e.message });
  }
});

app.get('/debug/tables', async (_, res) => {
  const { getToken } = require('./larkService');
  const axios = require('axios');
  const BASE = 'https://open.larksuite.com/open-apis';
  const APP = process.env.LARK_APP_TOKEN;
  const tables = [
    { brand: "Dunkin'",            tableId: process.env.LARK_TABLE_DUNKIN || process.env.LARK_TABLE_ID },
    { brand: "Greyhound Cafe",     tableId: process.env.LARK_TABLE_GREYHOUND_CAFE },
    { brand: "Greyhound Original", tableId: process.env.LARK_TABLE_GREYHOUND_ORI },
    { brand: "Au Bon Pain",        tableId: process.env.LARK_TABLE_AU_BON_PAIN },
    { brand: "Funky Fries",        tableId: process.env.LARK_TABLE_FUNKY_FRIES },
  ];
  try {
    const token = await getToken();
    const results = await Promise.allSettled(tables.map(async ({ brand, tableId }) => {
      if (!tableId) return { brand, tableId: null, status: 'NO_ENV_VAR', count: 0 };
      const r = await axios.get(
        `${BASE}/bitable/v1/apps/${APP}/tables/${tableId}/records`,
        { headers: { Authorization: `Bearer ${token}` }, params: { page_size: 10 }, timeout: 10000 }
      );
      const count = r.data.data?.total || r.data.data?.items?.length || 0;
      return { brand, tableId, status: 'OK', larkCode: r.data.code, count };
    }));
    res.json({
      ok: true,
      appToken: APP,
      tables: results.map((r, i) => r.status === 'fulfilled' ? r.value : { brand: tables[i].brand, error: r.reason?.message })
    });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/debug/lark-fields', async (_, res) => {
  try { const d = await debugSchema(); res.json({ ok:true, ...d }); }
  catch(e) { res.json({ ok:false, error:e.message }); }
});

// ── Test LINE push ───────────────────────────────────────────
app.get('/debug/test-line', async (_, res) => {
  const axios = require('axios');
  const AT = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const group = process.env.LINE_ADMIN_GROUP_ID;
  if (!AT) return res.json({ ok:false, error:'LINE_CHANNEL_ACCESS_TOKEN not set' });
  if (!group) return res.json({ ok:false, error:'LINE_ADMIN_GROUP_ID not set' });
  try {
    await axios.post('https://api.line.me/v2/bot/message/push',
      { to: group, messages:[{ type:'text', text:'✅ Test จาก IT Ticket System' }] },
      { headers:{ Authorization:'Bearer '+AT }, timeout:8000 }
    );
    res.json({ ok:true, msg:'LINE sent to group: '+group.slice(0,8)+'...' });
  } catch(e) {
    res.json({ ok:false, error: e.response?.data || e.message });
  }
});

// ── Test webhook manually ────────────────────────────────────
app.post('/debug/test-webhook', async (req, res) => {
  const { record_id } = req.body || {};
  if (!record_id) return res.json({ ok:false, error:'send { "record_id": "recXXX" }' });
  try {
    const { getTicket, invalidateCache } = require('./larkService');
    invalidateCache();
    const t = await getTicket(record_id);
    res.json({ ok:true, ticket:t, env:{
      hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      hasAdminGroup: !!process.env.LINE_ADMIN_GROUP_ID,
      adminGroup: (process.env.LINE_ADMIN_GROUP_ID||'').slice(0,8)+'...',
    }});
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

// ── Webhooks ──────────────────────────────────────────────────
app.use('/lark', larkRouter);
app.use('/line', lineRouter);

// ── Pre-load fieldMap on startup ──────────────────────────────
setTimeout(async () => {
  try { await ensureFieldMap(); console.log('[App] fieldMap ready'); }
  catch(e) { console.warn('[App] fieldMap preload failed:', e.message); }
}, 3000);

module.exports = app;
