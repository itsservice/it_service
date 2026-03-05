// env.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,

  // LINE
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  LINE_CHANNEL_SECRET:       process.env.LINE_CHANNEL_SECRET       || '',

  // LARK Webhook
  LARK_ENCRYPT_KEY: process.env.LARK_ENCRYPT_KEY || '',

  // LARK Base API (ตั้งค่าใน Render Environment Variables)
  LARK_APP_ID:     process.env.LARK_APP_ID     || '',
  LARK_APP_SECRET: process.env.LARK_APP_SECRET || '',
  LARK_APP_TOKEN:  process.env.LARK_APP_TOKEN  || '',
  LARK_TABLE_ID:   process.env.LARK_TABLE_ID   || '',
};
