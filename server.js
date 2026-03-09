// server.js — Entry point (optimized for Render free tier)
const app   = require('./app');
const http  = require('http');
const https = require('https');

const PORT    = process.env.PORT    || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 IT Ticket System v2 running on port ${PORT}`);
  console.log(`   📋 Report:   ${APP_URL}/report`);
  console.log(`   🔧 Engineer: ${APP_URL}/engineer`);
  console.log(`   ⚙️  Admin:    ${APP_URL}/admin\n`);
  startKeepAlive();
});

// ── Keep-alive: ping ทุก 10 นาที (ลดจาก 14 → 10 กัน Render หลับ) ──
function startKeepAlive() {
  setInterval(() => {
    const hourTH = (new Date().getUTCHours() + 7) % 24;
    // ทำงาน 06:00–23:00 เวลาไทย เท่านั้น
    if (hourTH < 6 || hourTH >= 23) return;

    try {
      const url = new URL(APP_URL);
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request({
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     '/health',
        method:   'GET',
        headers:  { Connection: 'close' },
      }, res => {
        res.resume(); // drain response กัน socket hang
      });
      req.setTimeout(8000, () => req.destroy());
      req.on('error', () => {});
      req.end();
      console.log(`[Keep-alive] ping ${String(hourTH).padStart(2,'0')}:xx น.`);
    } catch(e) {
      console.warn('[Keep-alive] error:', e.message);
    }
  }, 10 * 60 * 1000); // ทุก 10 นาที
}

// ── ตั้ง timeout ให้ server กัน request ค้าง ─────────────────────
server.timeout          = 30_000; // request timeout 30s
server.keepAliveTimeout = 65_000; // ต้องมากกว่า load balancer Render (60s)
server.headersTimeout   = 66_000; // ต้องมากกว่า keepAliveTimeout

// ── Memory watchdog: exit ถ้า heap เกิน 400MB ────────────────────
// Render free tier มี RAM ~512MB — exit แล้ว Render จะ restart เอง
setInterval(() => {
  const mb = process.memoryUsage().heapUsed / 1024 / 1024;
  if (mb > 400) {
    console.error(`[Memory] Heap ${mb.toFixed(0)}MB — exiting for auto-restart`);
    process.exit(1);
  }
}, 60_000);

// ── Graceful shutdown ─────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n[Server] ${signal} — shutting down gracefully`);
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000); // force exit ใน 10s
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Error handlers กัน crash ─────────────────────────────────────
process.on('uncaughtException',  (err)    => console.error('[uncaughtException]',  err.message));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
