LINE_CHANNEL_ACCESS_TOKEN=YOUR_LINE_TOKEN
LINE_CHANNEL_SECRET=YOUR_LINE_SECRET

require('dotenv').config();

const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LARK_ENCRYPT_KEY = process.env.LARK_ENCRYPT_KEY || '';

module.exports = {
  PORT,
  LINE_TOKEN,
  LINE_SECRET,
  LARK_ENCRYPT_KEY
};
