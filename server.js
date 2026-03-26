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

// ── Memory watchdog (ทุก 30 วินาที) ─────────────────────────────
// Render free tier = 512MB RAM
// ลดจาก 400MB → 250MB เพื่อให้ graceful restart ก่อน Render OOM kill
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = mem.heapUsed / 1024 / 1024;
  const rssMB  = mem.rss / 1024 / 1024;

  // Log memory ทุก 5 นาที
  const sec = Math.floor(process.uptime());
  if (sec % 300 < 30) {
    console.log(`[Memory] heap=${heapMB.toFixed(0)}MB rss=${rssMB.toFixed(0)}MB uptime=${sec}s`);
  }

  // GC hint ถ้า heap เกิน 150MB
  if (heapMB > 150 && global.gc) {
    try { global.gc(); } catch(_) {}
  }

  // Graceful exit ถ้า heap เกิน 250MB
  if (heapMB > 250) {
    console.error(`[Memory] Heap ${heapMB.toFixed(0)}MB > 250MB — exiting for auto-restart`);
    process.exit(1);
  }

  // Safety net: exit ถ้า RSS (physical memory) เกิน 450MB
  if (rssMB > 450) {
    console.error(`[Memory] RSS ${rssMB.toFixed(0)}MB > 450MB — emergency exit`);
    process.exit(1);
  }
}, 30_000);

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
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
  if (err.message?.includes('ENOMEM') || err.message?.includes('allocation')) {
    console.error('[FATAL] Memory allocation error — shutting down');
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
