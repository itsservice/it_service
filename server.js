const app = require('./app');
const { PORT } = require('./config/env');

// ================= START =================
app.listen(PORT, () =>
  console.log(`🚀 SERVER STARTED : PORT ${PORT}`)
);
