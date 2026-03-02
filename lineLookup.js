const axios = require('axios');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./env');

const headers = {
  Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
};
