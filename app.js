const express = require('express');

const larkWebhookRouter = require('./larkWebhook');
const lineWebhookRouter = require('./lineWebhook');

const app = express();

// เก็บ rawBody สำหรับตรวจ LINE signature
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf; // Buffer
    }
  })
);

// HEALTH
app.get('/', (_, res) => res.send('SERVER OK'));

// DEBUG ENV (ชั่วคราว)
app.get('/debug/env', (_req, res) => {
  res.json({
    hasLineSecret: !!process.env.LINE_CHANNEL_SECRET,
    lineSecretLen: (process.env.LINE_CHANNEL_SECRET || '').length,
    hasLineToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
  });
});

// LARK
app.use('/lark', larkWebhookRouter);

// LINE
app.use('/line', lineWebhookRouter);

module.exports = app;
