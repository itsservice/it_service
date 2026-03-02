const express = require('express');

const larkWebhookRouter = require('./larkWebhook'); // ✅ เดิม ./routes/larkWebhook
const lineWebhookRouter = require('./lineWebhook'); // ✅ เดิม ./routes/lineWebhook

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.get('/', (_, res) => res.send('SERVER OK'));

app.use('/lark', larkWebhookRouter);
app.use('/line', lineWebhookRouter);

module.exports = app;
