const express = require('express');
const path = require('path'); // ✅ เพิ่ม

const larkWebhookRouter = require('./larkWebhook');
const lineWebhookRouter = require('./lineWebhook');

const app = express();

// ✅ เพิ่ม: เสิร์ฟไฟล์ static จากโฟลเดอร์เดียวกัน
// เพื่อให้ /portal.css และ /portal.js โหลดได้
app.use(express.static(__dirname));

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

// ✅ เพิ่ม: หน้าเว็บ portal (HTML แยกไฟล์)
app.get('/portal', (_req, res) => {
  res.sendFile(path.join(__dirname, 'portal.html'));
});

// ======= PORTAL WEB (serve html/css/js as separate files) =======
const path = require('path');

app.get('/portal/:brand?', (_req, res) => {
  res.sendFile(path.join(__dirname, 'portal.html'));
});

app.get('/assets/portal.css', (_req, res) => {
  res.type('text/css').sendFile(path.join(__dirname, 'portal.css'));
});

app.get('/assets/portal.js', (_req, res) => {
  res.type('application/javascript').sendFile(path.join(__dirname, 'portal.js'));
});

// 🔐 แนะนำ: ลบหรือคอมเมนต์ทิ้งหลังตรวจแล้ว
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
