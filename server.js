require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const lineHeaders = {
  Authorization: `Bearer ${LINE_TOKEN}`,
  'Content-Type': 'application/json'
};

// ================= LINE PUSH FLEX =================
const linePushFlex = (to, flexMessage) =>
  axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to, messages: [flexMessage] },
    { headers: lineHeaders }
  );

// ================= LARK DECRYPT =================
function decryptLark(encryptKey, encrypt) {
  const key = crypto.createHash('sha256').update(encryptKey).digest();
  const iv = key.slice(0, 16);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);

  let decrypted = Buffer.concat([
    decipher.update(encrypt, 'base64'),
    decipher.final()
  ]);

  const pad = decrypted[decrypted.length - 1];
  decrypted = decrypted.slice(0, decrypted.length - pad);

  return JSON.parse(decrypted.toString('utf8'));
}

// ================= HEALTH =================
app.get('/', (_, res) => res.send('SERVER OK'));


// ======================================================
// LARK WEBHOOK
// ======================================================
app.post('/lark/webhook', async (req, res) => {

  try {

    let body = req.body;

    console.log('\n📥 LARK RAW');
    console.log(JSON.stringify(body, null, 2));

    // ================= DECRYPT =================
    if (body.encrypt && process.env.LARK_ENCRYPT_KEY) {
      body = decryptLark(process.env.LARK_ENCRYPT_KEY, body.encrypt);
      console.log('🔓 LARK DECRYPTED');
      console.log(JSON.stringify(body, null, 2));
    }

    // ================= URL VERIFICATION =================
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // ตอบทันที กัน timeout
    res.json({ ok: true });

    const data = body.event || body;

    console.log('📦 LARK DATA:', JSON.stringify(data, null, 2));

    // ================= ใช้ recordUrl ตรง ๆ =================
    const recordUrl = data.recordUrl && data.recordUrl.trim() !== ''
      ? data.recordUrl
      : null;

    console.log('🔗 RECORD URL:', recordUrl);

    // ================= SEND TO LINE =================
    if (data.line_user_id || data.line_group_id) {

      const target = data.line_user_id || data.line_group_id;

      // ถ้าไม่มี URL จะไม่ใส่ปุ่ม
      const footerContents = [];

      if (recordUrl) {
        footerContents.push({
          type: "button",
          style: "primary",
          action: {
            type: "uri",
            label: "Link งาน",
            uri: recordUrl
          }
        });
      }

      const flexMessage = {
        type: "flex",
        altText: `Ticket ${data.ticket_id || ''}`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: data.ticket_id || "Report Ticket",
                weight: "bold",
                size: "lg"
              },
              {
                type: "text",
                text: `วันที่: ${data.ticketDate || '-'}`,
                size: "sm"
              },
              {
                type: "text",
                text: `สถานะ: ${data.status || '-'}`,
                size: "sm"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: footerContents
          }
        }
      };

      await linePushFlex(target, flexMessage);

      console.log('✅ PUSH SUCCESS');
    }

  } catch (err) {

    console.error('❌ LARK ERROR:', err.message);
    res.status(500).json({ error: 'server error' });

  }
});

// ================= START =================
app.listen(PORT, () =>
  console.log(`🚀 SERVER STARTED : PORT ${PORT}`)
);
