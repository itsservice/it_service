const express = require('express');
const larkWebhook = require('./larkWebhook');

const app = express();
app.use(express.json());

// ================= HEALTH =================
app.get('/', (_, res) => res.send('SERVER OK'));

// Lark routes
app.use('/lark', larkWebhook);

module.exports = app;
