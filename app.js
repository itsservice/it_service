// แก้ไขแล้ว 17.02
const express = require('express');
const path = require('path');

const larkWebhookRouter = require('./larkWebhook');
const lineWebhookRouter = require('./lineWebhook');

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.get('/', (_, res) => res.send('SERVER OK'));

app.get('/debug/env', (_req, res) => {
  res.json({
    hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
    lineSecretLen: (process.env.LINE_CHANNEL_SECRET || '').length,
    hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
  });
});

const PORTAL_DIR = __dirname;

app.get(['/portal', '/portal/:brand'], (req, res) => {
  res.sendFile(path.join(PORTAL_DIR, 'portal.html'));
});

app.get('/assets/portal.css', (req, res) => {
  res.type('text/css');
  res.sendFile(path.join(PORTAL_DIR, 'portal.css'));
});

app.get('/assets/portal.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(PORTAL_DIR, 'portal.js'));
});

app.get('/ticket-system', (req, res) => {
  res.sendFile(path.join(PORTAL_DIR, 'ticket-system.html'));
});

app.use('/lark', larkWebhookRouter);
app.use('/line', lineWebhookRouter);

module.exports = app;
