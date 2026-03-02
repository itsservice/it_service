const { LINE_TOKEN } = require('./env');

module.exports = {
  lineHeaders: {
    Authorization: `Bearer ${LINE_TOKEN}`,
    'Content-Type': 'application/json'
  }
};
