// server.js — Entry point
const app  = require('./app');
const http = require('http');
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`\n🚀 IT Ticket System v2 running on port ${PORT}`);
  console.log(`   📋 Report:   ${APP_URL}/report`);
  console.log(`   🔧 Engineer: ${APP_URL}/engineer`);
  console.log(`   ⚙️  Admin:    ${APP_URL}/admin\n`);

  // ── Keep-alive ping ทุก 14 นาที (ป้องกัน Render free tier sleep) ──
  setInterval(() => {
    const url = new URL(APP_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/api/events',
      method: 'GET',
    };
    const req = (url.protocol === 'https:' ? require('https') : http).request(options, r => {
      r.destroy(); // ปิดทันที ไม่ต้องรอ
    });
    req.on('error', () => {}); // ไม่ต้อง log
    req.end();
    console.log('[Keep-alive] ping', new Date().toLocaleTimeString('th-TH'));
  }, 14 * 60 * 1000); // 14 นาที
});
