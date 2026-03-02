const express = require('express');
const larkWebhookRouter = require('./routes/larkWebhook');

const app = express();
app.use(express.json());

// ================= HEALTH =================
app.get('/', (_, res) => res.send('SERVER OK'));

// Lark routes
app.use('/lark', larkWebhookRouter);

module.exports = app;
