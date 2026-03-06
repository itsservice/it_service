// server.js — Entry point
const app  = require('./app');
const http = require('http');
const https = require('https');
const PORT    = process.env.PORT    || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

app.listen(PORT, () => {
  console.log(`\n🚀 IT Ticket System v2 running on port ${PORT}`);
  console.log(`   📋 Report:   ${APP_URL}/report`);
  console.log(`   🔧 Engineer: ${APP_URL}/engineer`);
  console.log(`   ⚙️  Admin:    ${APP_URL}/admin\n`);

  // ── Keep-alive ping ทุก 14 นาที ──────────────────────────────
  // ใช้งานเฉพาะ 05:00 - 22:00 (เวลาไทย UTC+7)
  // กลางคืน 22:00 - 05:00 หยุด ping ประหยัด Render quota
  setInterval(() => {
    const hourTH = (new Date().getUTCHours() + 7) % 24; // แปลงเป็น TH time
    if (hourTH >= 22 || hourTH < 5) {
      console.log(`[Keep-alive] หยุด ping กลางคืน (${hourTH}:xx น.)`);
      return;
    }
    const url = new URL(APP_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/debug/env',
      method: 'GET',
    }, r => { r.destroy(); });
    req.on('error', () => {});
    req.end();
    console.log(`[Keep-alive] ping ${hourTH}:xx น. — OK`);
  }, 14 * 60 * 1000); // ทุก 14 นาที
});
