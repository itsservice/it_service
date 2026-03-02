const express = require('express');

const larkWebhookRouter = require('./routes/larkWebhook');
const lineWebhookRouter = require('./routes/lineWebhook');

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

// LINE (ใหม่)
app.use('/line', lineWebhookRouter);

module.exports = app;
