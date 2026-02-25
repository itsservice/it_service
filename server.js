require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// ================= CONFIG =================
const PORT = process.env.PORT || 3000;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ================= LINE HEADER =================
const lineHeaders = {
  Authorization: `Bearer ${LINE_TOKEN}`,
  'Content-Type': 'application/json'
};

// ================= LINE API =================
const lineReply = (replyToken, text) =>
  axios.post('https://api.line.me/v2/bot/message/reply',
    { replyToken, messages: [{ type: 'text', text }] },
    { headers: lineHeaders }
  );

const linePush = (to, text) =>
  axios.post('https://api.line.me/v2/bot/message/push',
    { to, messages: [{ type: 'text', text }] },
    { headers: lineHeaders }
  );

// ================= LINE PROFILE =================
const getUserProfile = async (userId) => {
  const res = await axios.get(
    `https://api.line.me/v2/bot/profile/${userId}`,
    { headers: lineHeaders }
  );
  return res.data.displayName;
};

const getGroupName = async (groupId) => {
  try {
    const res = await axios.get(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      { headers: lineHeaders }
    );
    return res.data.groupName;
  } catch {
    return 'ไม่ได้อยู่ในกลุ่ม';
  }
};

const formatTime = () =>
  new Date().toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

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
// LINE WEBHOOK
// ======================================================
app.post('/line/webhook', async (req, res) => {

  res.json({ ok: true });

  const events = req.body.events || [];

  for (const event of events) {

    if (event.type !== 'message') continue;
    if (event.message.type !== 'text') continue;

    const userId = event.source.userId;
    const groupId = event.source.groupId || null;

    const userName = await getUserProfile(userId);
    const groupName = groupId
      ? await getGroupName(groupId)
      : 'ไม่ได้อยู่ในกลุ่ม';

    const text =
`👤 ชื่อผู้ใช้: ${userName}

🆔 User ID: 
${userId}

👥 ชื่อกลุ่ม: 
${groupName}

🆔 Group ID: 
${groupId || 'ไม่ได้อยู่ในกลุ่ม'}

⏰ เวลา: ${formatTime()}`;

    console.log('\n📥 LINE MESSAGE');
    console.log(text);

    //await lineReply(event.replyToken, text);
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

    // decrypt when enable encryption
    if (body.encrypt && process.env.LARK_ENCRYPT_KEY) {
      body = decryptLark(process.env.LARK_ENCRYPT_KEY, body.encrypt);

      console.log('🔓 LARK DECRYPTED');
      console.log(JSON.stringify(body));
    }

    // URL verification
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    res.json({ ok: true });

    const data = body.event || body;

    console.log('📦 LARK DATA:', data);

    // ================= SEND TO LINE =================
    if (data.line_user_id || data.line_group_id) {

      const target = data.line_user_id || data.line_group_id;

      console.log('🎯 SEND TO:', target);

      const msg =
`
 ${data.type || '-'}
 
Ticket ID: ${data.ticket_id || '-'}
📅 วันที่: ${data.ticketDate || '-'}

ประเภท/อุปกรณ์: ${data.title || '-'}
รายละเอียด/อาการ: ${data.symptom || '-'}

สาขา: ${data.branch || '-'}
รหัสสาขา: ${data.branch_code || '-'}

เบอร์โทร: ${data.phone || '-'}
สถานะ: ${data.status || '-'}`;

      await linePush(target, msg);

      console.log('✅ PUSH SUCCESS');
    }

  } catch (err) {

    console.error('❌ LARK ERROR', err.message);
    res.status(500).json({ error: 'server error' });

  }
});


// ================= START =================
app.listen(PORT, () =>
  console.log(`🚀 SERVER STARTED : PORT ${PORT}`)
);
