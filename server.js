require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ================= LINE =================
const lineHeaders = {
  Authorization: `Bearer ${LINE_TOKEN}`,
  'Content-Type': 'application/json'
};

async function lineReply(replyToken, text) {
  return axios.post(
    'https://api.line.me/v2/bot/message/reply',
    { replyToken, messages: [{ type: 'text', text }] },
    { headers: lineHeaders }
  );
}

async function linePush(to, text) {
  return axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to, messages: [{ type: 'text', text }] },
    { headers: lineHeaders }
  );
}

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

  // remove padding
  const pad = decrypted[decrypted.length - 1];
  decrypted = decrypted.slice(0, decrypted.length - pad);

  return JSON.parse(decrypted.toString('utf8'));
}

// ================= HEALTH =================
app.get('/', (_, res) => res.send('SERVER OK'));

// ======================================================
// LINE WEBHOOK
// ======================================================
app.post('/line/webhook', async (req, res) => {

  res.json({ ok: true });

  const events = req.body.events || [];

  for (const event of events) {

    if (event.type !== 'message') continue;
    if (event.message.type !== 'text') continue;

    const userId = event.source.userId;
    const groupId = event.source.groupId || '-';

    const replyText =
`📨 ข้อความของคุณคือ:
${event.message.text}

👤 User ID : ${userId}
${groupId !== '-' ? `👥 Group ID : ${groupId}` : ''}`;

    await lineReply(event.replyToken, replyText);
  }
});

// ======================================================
// LARK WEBHOOK
// ======================================================
app.post('/lark/webhook', async (req, res) => {

  try {

    let body = req.body;

    console.log('\n📥 LARK RAW');
    console.log(JSON.stringify(body));

    // 🔓 decrypt
    if (body.encrypt) {
      body = decryptLark(process.env.LARK_ENCRYPT_KEY, body.encrypt);

      console.log('\n🔓 LARK DECRYPTED');
      console.log(JSON.stringify(body));
    }

    // 🔐 verify token
    if (body.token !== process.env.LARK_VERIFICATION_TOKEN) {
      return res.status(403).json({ msg: 'Invalid token' });
    }

    // ✅ URL VERIFICATION
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // ตอบทันที
    res.json({ ok: true });

    const data = body.event || body;

    // ===== DAILY REPORT =====
    if (data.type === 'daily_report') {

      const target = data.line_user_id || data.line_group_id;
      if (!target) return;

      const msg =
`📋 รายงานงานคงเหลือ
⏰ รอบเวลา : ${data.time}

🟡 รอดำเนินการ : ${data.pending_count}
🔵 อยู่ระหว่างดำเนินการ : ${data.inprogress_count}`;

      await linePush(target, msg);
      return;
    }

    // ===== TICKET =====
    if (typeof data.type === 'string' && data.type.startsWith('Ticket-')) {

      const target = data.line_user_id || data.line_group_id;
      if (!target) return;

      const msg =
`🆔 Ticket ID : ${data.ticket_id}
📅 วันที่ : ${data.ticketDate}

📌 หัวข้อ : ${data.title}
⚙️ อาการ : ${data.symptom}

🏬 สาขา : ${data.branch}
🏷️ รหัสสาขา : ${data.branch_code}

📞 Phone : ${data.phone}
📊 Status : ${data.status}`;

      await linePush(target, msg);
      return;
    }

    console.log('⚠️ UNKNOWN LARK PAYLOAD');

  } catch (err) {

    console.error('❌ LARK ERROR', err.message);
    res.status(500).json({ error: 'server error' });

  }
});

// ================= START =================
app.listen(PORT, () => console.log(`🚀 SERVER STARTED : PORT ${PORT}`));
