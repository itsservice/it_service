// app.js — SSE + Lark REST + Engineer submit + Admin close
const express = require('express');
const path = require('path');
const larkWebhookRouter = require('./larkWebhook');
const lineWebhookRouter = require('./lineWebhook');
const { listTickets, updateTicketField, createTicket } = require('./larkService');
const app = express();

app.use(express.json({ verify: (req,_,buf) => { req.rawBody = buf; } }));

// SSE
const sseClients = new Set();
function broadcast(evt, data) {
  const msg = `event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) { try { res.write(msg); } catch(_){ sseClients.delete(res); } }
}
app.locals.broadcast = broadcast;

// Static pages
app.get('/', (_,res) => res.send('OK'));
app.get('/debug/env', (_,res) => res.json({
  hasLarkAppId: !!process.env.LARK_APP_ID,
  hasLarkSecret: !!process.env.LARK_APP_SECRET,
  hasLarkToken: !!process.env.LARK_APP_TOKEN,
  hasLarkTable: !!process.env.LARK_TABLE_ID,
}));
const DIR = __dirname;
app.get(['/portal','/portal/:brand'], (_,res) => res.sendFile(path.join(DIR,'portal.html')));
app.get('/assets/portal.css', (_,res) => res.type('text/css').sendFile(path.join(DIR,'portal.css')));
app.get('/assets/portal.js', (_,res) => res.type('application/javascript').sendFile(path.join(DIR,'portal.js')));
app.get('/ticket-system', (_,res) => res.sendFile(path.join(DIR,'ticket-system.html')));
app.get('/report', (_,res) => res.sendFile(path.join(DIR,'report.html')));

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.flushHeaders();
  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch(_){} }, 25_000);
  sseClients.add(res);
  req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
});

// GET tickets
app.get('/api/tickets', async (_,res) => {
  try { res.json({ ok:true, tickets: await listTickets() }); }
  catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});

// PATCH status (quick)
app.patch('/api/tickets/:rid/status', async (req,res) => {
  const { rid } = req.params;
  const { status, updatedBy } = req.body;
  if (!status) return res.status(400).json({ ok:false, error:'status required' });
  try {
    const t = await updateTicketField(rid, { status });
    broadcast('ticket_updated', { recordId:rid, status, updatedBy:updatedBy||'?', updatedAt:new Date().toISOString() });
    res.json({ ok:true, ticket:t });
  } catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});

// PATCH engineer submit
app.patch('/api/tickets/:rid/engineer-submit', async (req,res) => {
  const { rid } = req.params;
  const { workDetail, partsUsed, workHours, engineerName } = req.body;
  try {
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t = await updateTicketField(rid, {
      status:'ตรวจงาน', workDetail:workDetail||'', partsUsed:partsUsed||'',
      workHours:workHours||'', engineerName:engineerName||'', completedAt:now
    });
    broadcast('ticket_updated', { recordId:rid, status:'ตรวจงาน', engineerSubmit:true, updatedAt:new Date().toISOString() });
    res.json({ ok:true, ticket:t });
  } catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});

// PATCH admin close
app.patch('/api/tickets/:rid/admin-close', async (req,res) => {
  const { rid } = req.params;
  const { adminNote, closedBy, status } = req.body;
  try {
    const finalStatus = status || 'เสร็จสิ้น';
    const now = new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
    const t = await updateTicketField(rid, {
      status:finalStatus, adminNote:adminNote||'', closedAt:now, closedBy:closedBy||'Admin'
    });
    broadcast('ticket_updated', { recordId:rid, status:finalStatus, adminClose:true, updatedAt:new Date().toISOString() });
    res.json({ ok:true, ticket:t });
  } catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});

// PATCH generic fields
app.patch('/api/tickets/:rid', async (req,res) => {
  const { rid } = req.params;
  try {
    const t = await updateTicketField(rid, req.body);
    broadcast('ticket_updated', { recordId:rid, fields:req.body, updatedAt:new Date().toISOString() });
    res.json({ ok:true, ticket:t });
  } catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});

// POST create
app.post('/api/tickets', async (req,res) => {
  try {
    const t = await createTicket(req.body);
    broadcast('ticket_created', { ticket:t, createdAt:new Date().toISOString() });
    res.json({ ok:true, ticket:t });
  } catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});

// Webhooks
app.use('/lark', larkWebhookRouter);
app.use('/line', lineWebhookRouter);

module.exports = app;

// ─── DEBUG: ดูชื่อ field จริงจาก Lark (Super Admin only) ───
const axios = require('axios');
const { getTenantToken } = require('./larkService');

app.get('/api/debug/lark-fields', async (_,res) => {
  try {
    const token = await getTenantToken();
    // 1) List fields/columns
    const fieldsR = await axios.get(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/fields`,
      { headers:{ Authorization:`Bearer ${token}` }, timeout:10_000 }
    );
    // 2) Get 3 sample records to see raw data
    const recordsR = await axios.get(
      `https://open.larksuite.com/open-apis/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/records`,
      { headers:{ Authorization:`Bearer ${token}` }, params:{ page_size:3 }, timeout:10_000 }
    );
    const fieldList = fieldsR.data?.data?.items?.map(f => ({ name:f.field_name, type:f.type, id:f.field_id })) || [];
    const sampleRaw = recordsR.data?.data?.items?.[0]?.fields || {};
    res.json({ ok:true, columns: fieldList, sampleRecord: sampleRaw, totalRecords: recordsR.data?.data?.total });
  } catch(err) { res.status(502).json({ ok:false, error:err.message }); }
});
