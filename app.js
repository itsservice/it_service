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

// LARK
app.use('/lark', larkWebhookRouter);

// LINE
app.use('/line', lineWebhookRouter);

module.exports = app;
