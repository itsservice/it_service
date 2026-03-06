// server.js — Entry point
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 IT Ticket System v2 running on port ${PORT}`);
  console.log(`   📋 Report:   http://localhost:${PORT}/report`);
  console.log(`   🔧 Engineer: http://localhost:${PORT}/engineer`);
  console.log(`   ⚙️  Admin:    http://localhost:${PORT}/admin\n`);
});
