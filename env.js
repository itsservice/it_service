require('dotenv').config();

const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LARK_ENCRYPT_KEY = process.env.LARK_ENCRYPT_KEY || '';

module.exports = {
  PORT,
  LINE_TOKEN,
  LARK_ENCRYPT_KEY
};
