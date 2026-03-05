// app.js
const express = require('express');
const path    = require('path');

const larkWebhookRouter = require('./larkWebhook');
const lineWebhookRouter = require('./lineWebhook');
const { listTickets, updateTicketField, createTicket } = require('./larkService');

const app = express();

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

// ─────────────────────────────────────────
// SSE broadcast
// ─────────────────────────────────────────
const sseClients = new Set();

function broadcast(eventName, data) {
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (_) { sseClients.delete(res); }
  }
}
app.locals.broadcast = broadcast;

// ─────────────────────────────────────────
// STATIC / HTML
// ─────────────────────────────────────────
app.get('/', (_, res) => res.send('SERVER OK'));

app.get('/debug/env', (_req, res) => {
  res.json({
    hasLineSecret:  !!process.env.LINE_CHANNEL_SECRET,
    lineSecretLen:  (process.env.LINE_CHANNEL_SECRET || '').length,
    hasLineToken:   !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    hasLarkAppId:   !!process.env.LARK_APP_ID,
    hasLarkSecret:  !!process.env.LARK_APP_SECRET,
    hasLarkToken:   !!process.env.LARK_APP_TOKEN,
    hasLarkTable:   !!process.env.LARK_TABLE_ID,
  });
});

const PORTAL_DIR = __dirname;

// Portal
app.get(['/portal', '/portal/:brand'], (_req, res) =>
  res.sendFile(path.join(PORTAL_DIR, 'portal.html')));

app.get('/assets/portal.css', (_req, res) => {
  res.type('text/css');
  res.sendFile(path.join(PORTAL_DIR, 'portal.css'));
});

app.get('/assets/portal.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(PORTAL_DIR, 'portal.js'));
});

// Ticket system — รองรับทั้ง /ticket-system และ /ticket-system/:brand
app.get(['/ticket-system', '/ticket-system/:brand'], (_req, res) =>
  res.sendFile(path.join(PORTAL_DIR, 'ticket-system.html')));

// Report — รองรับทั้ง /report และ /report/:brand
app.get(['/report', '/report/:brand'], (_req, res) =>
  res.sendFile(path.join(PORTAL_DIR, 'report.html')));

// ─────────────────────────────────────────
// SSE endpoint
// ─────────────────────────────────────────
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const hb = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) {}
  }, 25_000);

  sseClients.add(res);
  console.log(`SSE client connected (total: ${sseClients.size})`);

  req.on('close', () => {
    clearInterval(hb);
    sseClients.delete(res);
    console.log(`SSE client disconnected (total: ${sseClients.size})`);
  });
});

// ─────────────────────────────────────────
// REST — Tickets
// ─────────────────────────────────────────
app.get('/api/tickets', async (_req, res) => {
  try {
    const tickets = await listTickets();
    res.json({ ok: true, tickets });
  } catch (err) {
    console.error('GET /api/tickets:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.patch('/api/tickets/:recordId/status', async (req, res) => {
  const { recordId } = req.params;
  const { status, updatedBy } = req.body;
  if (!status) return res.status(400).json({ ok: false, error: 'status required' });
  try {
    const updated = await updateTicketField(recordId, { status });
    broadcast('ticket_updated', { recordId, status, updatedBy: updatedBy || 'unknown', updatedAt: new Date().toISOString() });
    res.json({ ok: true, ticket: updated });
  } catch (err) {
    console.error('PATCH status:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.patch('/api/tickets/:recordId', async (req, res) => {
  const { recordId } = req.params;
  try {
    const updated = await updateTicketField(recordId, req.body);
    broadcast('ticket_updated', { recordId, fields: req.body, updatedAt: new Date().toISOString() });
    res.json({ ok: true, ticket: updated });
  } catch (err) {
    console.error('PATCH ticket:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const created = await createTicket(req.body);
    broadcast('ticket_created', { ticket: created, createdAt: new Date().toISOString() });
    res.json({ ok: true, ticket: created });
  } catch (err) {
    console.error('POST /api/tickets:', err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

// ─────────────────────────────────────────
// WEBHOOKS
// ─────────────────────────────────────────
app.use('/lark', larkWebhookRouter);
app.use('/line', lineWebhookRouter);

module.exports = app;
