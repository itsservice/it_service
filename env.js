require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  LINE_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  LARK_ENCRYPT_KEY: process.env.LARK_ENCRYPT_KEY || ''
};
