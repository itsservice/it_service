const { PORT } = require('./env');
const app = require('./app');

app.listen(PORT, () => console.log(`🚀 SERVER STARTED : PORT ${PORT}`));
