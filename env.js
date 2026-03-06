// env.js — ไม่ใช้ dotenv เพราะ Render inject env vars โดยตรง
// ไฟล์นี้มีไว้ compatibility กับโค้ดเก่าเท่านั้น
module.exports = {
  LARK_APP_ID:               process.env.LARK_APP_ID,
  LARK_APP_SECRET:           process.env.LARK_APP_SECRET,
  LARK_APP_TOKEN:            process.env.LARK_APP_TOKEN,
  LARK_TABLE_ID:             process.env.LARK_TABLE_ID,
  LARK_ENCRYPT_KEY:          process.env.LARK_ENCRYPT_KEY,
  LARK_VERIFY_TOKEN:         process.env.LARK_VERIFY_TOKEN,
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET:       process.env.LINE_CHANNEL_SECRET,
  LINE_ADMIN_GROUP_ID:       process.env.LINE_ADMIN_GROUP_ID,
  APP_URL:  process.env.APP_URL  || 'https://it-service-56im.onrender.com',
  PWD_SALT: process.env.PWD_SALT || 'it-ticket-salt-2025',
  PORT:     process.env.PORT     || 3000,
};
