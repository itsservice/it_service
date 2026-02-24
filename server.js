require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const LINE_PUSH_URL  = 'https://api.line.me/v2/bot/message/push';
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

// ================= LINE HELPERS =================
const lineHeaders = {
  Authorization: `Bearer ${LINE_TOKEN}`,
  'Content-Type': 'application/json'
};

async function lineReply(replyToken, text) {
  return axios.post(LINE_REPLY_URL, {
    replyToken,
    messages: [{ type: 'text', text }]
  }, { headers: lineHeaders });
}

async function linePush(to, text) {
  return axios.post(LINE_PUSH_URL, {
    to,
    messages: [{ type: 'text', text }]
  }, { headers: lineHeaders });
}

// ================= LARK DECRYPT =================
function decryptLark(encryptKey, encrypt) {
  const key = crypto.createHash('sha256').update(encryptKey).digest();

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    key.slice(0, 16)
  );

  let decrypted = decipher.update(encrypt, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

// ================= HEALTH =================
app.get('/', (_, res) => {
  res.status(200).send('SERVER OK');
});

// ======================================================
// 1) LINE WEBHOOK
// ======================================================
app.post('/line/webhook', async (req, res) => {
  res.status(200).json({ ok: true });

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type !== 'message') continue;
    if (event.message.type !== 'text') continue;

    const userId     = event.source.userId;
    const groupId    = event.source.groupId || '-';
    const text       = event.message.text;
    const replyToken = event.replyToken;

    const replyText = 
`📨 ข้อความของคุณคือ:
${text}

👤 User ID : ${userId}
${groupId !== '-' ? `👥 Group ID : ${groupId}` : ''}`;

    try {
      await lineReply(replyToken, replyText);
    } catch (err) {
      console.error('❌ LINE REPLY ERROR', err.response?.data || err.message);
    }
  }
});

// ======================================================
// 2) LARK WEBHOOK
// ======================================================
app.post('/lark/webhook', async (req, res) => {

  let body = req.body || {};

  console.log('\n📥 LARK RAW');
  console.log(JSON.stringify(body, null, 2));

  // 🔓 decrypt เมื่อเปิด Encrypt Key
  if (body.encrypt) {
    body = decryptLark(process.env.LARK_ENCRYPT_KEY, body.encrypt);
    console.log('\n🔓 LARK DECRYPTED');
    console.log(JSON.stringify(body, null, 2));
  }

  // 🔐 verify token
  if (body.token !== process.env.LARK_VERIFICATION_TOKEN) {
    console.error('❌ INVALID TOKEN');
    return res.status(403).send('Invalid token');
  }

  // ✅ URL VERIFICATION
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }

  // ตอบทันที กัน timeout
  res.status(200).json({ ok: true });

  const data = body.event || body;

  // ================= DAILY REPORT =================
  if (data.type === 'daily_report') {

    const target = data.line_user_id || data.line_group_id;
    if (!target) return;

    const msg =
`📋 รายงานงานคงเหลือ
⏰ รอบเวลา : ${data.time}

🟡 รอดำเนินการ : ${data.pending_count}
🔵 อยู่ระหว่างดำเนินการ : ${data.inprogress_count}`;

    await linePush(target, msg);
    console.log('✅ DAILY REPORT SENT');
    return;
  }

  // ================= TICKET =================
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
    console.log('✅ TICKET SENT');
    return;
  }

  console.warn('⚠️ UNKNOWN LARK PAYLOAD TYPE');
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 SERVER STARTED : PORT ${PORT}`);
});
