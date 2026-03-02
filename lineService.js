const axios = require('axios');
const { lineHeaders } = require('./line');

// ================= LINE PUSH FLEX =================
const linePushFlex = (to, flexMessage) =>
  axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to, messages: [flexMessage] },
    { headers: lineHeaders }
  );

module.exports = { linePushFlex };
