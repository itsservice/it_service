const { LINE_TOKEN } = require('./env');

const lineHeaders = {
  Authorization: `Bearer ${LINE_TOKEN}`,
  'Content-Type': 'application/json'
};

module.exports = { lineHeaders };
