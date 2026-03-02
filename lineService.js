const axios = require('axios');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./env');
const { lineHeaders } = require('./line');

const linePushFlex = (to, flexMessage) => {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing env: LINE_CHANNEL_ACCESS_TOKEN');
  }

  return axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to, messages: [flexMessage] },
    { headers: lineHeaders, timeout: 15000 }
  );
};

module.exports = { linePushFlex };
