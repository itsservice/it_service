const { LINE_CHANNEL_ACCESS_TOKEN } = require('./env');

module.exports = {
  lineHeaders: {
    Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
};
