require('dotenv').config();
const express = require('express');
const axios = require('axios');

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
  return axios.post(
    LINE_REPLY_URL,
    {
      replyToken,
      messages: [{ type: 'text', text }]
    },
    { headers: lineHeaders }
  );
}

async function linePush(to, text) {
  return axios.post(
    LINE_PUSH_URL,
    {
      to,
      messages: [{ type: 'text', text }]
    },
    { headers: lineHeaders }
  );
}

// ================= HEALTH =================
app.get('/', (_, res) => {
  res.status(200).send('SERVER OK');
});


// ======================================================
// 1) LINE WEBHOOK (User ส่งข้อความเข้า LINE)
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

    console.log('💬 LINE MESSAGE RECEIVED');
    console.log(`👤 User ID  : ${userId}`);
    console.log(`👥 Group ID : ${groupId}`);
    console.log(`✉️ Message  : ${text}`);

    const replyText = 
`📨 ข้อความของคุณคือ:
${text}

👤 User ID : ${userId}
${groupId !== '-' ? `👥 Group ID : ${groupId}` : ''}`;

    try {
      await lineReply(replyToken, replyText);
      console.log('✅ LINE REPLY SENT');
    } catch (err) {
      console.error('❌ LINE REPLY ERROR', err.response?.data || err.message);
    }
  }
});


// ======================================================
// 2) LARK WEBHOOK (Ticket + Daily Report)
// ======================================================
app.post('/lark/webhook', async (req, res) => {
  res.status(200).json({ ok: true });

  const body = req.body || {};

  console.log('\n📥 LARK WEBHOOK RECEIVED');
  console.log(JSON.stringify(body, null, 2));

  // ==================================================
  // DAILY REPORT
  // ==================================================
  if (body.type === 'daily_report') {
    const {
      time,
      pending_count,
      inprogress_count,
      line_user_id,
      line_group_id
    } = body;

    const target = line_user_id || line_group_id;
    if (!target) {
      console.error('❌ DAILY REPORT: no LINE target');
      return;
    }

    console.log('\n📊 DAILY REPORT');
    console.log(`⏰ Time        : ${time}`);
    console.log(`🟡 Pending    : ${pending_count}`);
    console.log(`🔵 InProgress : ${inprogress_count}`);
    console.log(`🎯 Send to    : ${target}`);

    const msg =
`📋 รายงานงานคงเหลือ
⏰ รอบเวลา : ${time}

🟡 รอดำเนินการ : ${pending_count}
🔵 อยู่ระหว่างดำเนินการ : ${inprogress_count}`;

    try {
      await linePush(target, msg);
      console.log('✅ DAILY REPORT SENT');
    } catch (err) {
      console.error('❌ DAILY REPORT ERROR', err.response?.data || err.message);
    }
    return;
  }

  // ==================================================
  // TICKET (รองรับ Ticket-xxx)
  // ==================================================
  if (typeof body.type === 'string' && body.type.startsWith('Ticket-')) {
    const {
      ticket_id,
      ticketDate,
      title,
      symptom,
      branch,
      branch_code,
      phone,
      status,
      line_user_id,
      line_group_id
    } = body;

    const target = line_user_id || line_group_id;
    if (!target) {
      console.error('❌ TICKET: no LINE target');
      return;
    }

    console.log('\n🎫 NEW TICKET');
    console.log(`🆔 ${ticket_id}`);
    console.log(`📅 ${ticketDate}`);
    console.log(`📌 ${title}`);
    console.log(`⚙️ ${symptom}`);
    console.log(`🏬 ${branch}`);
    console.log(`🏷️ ${branch_code}`);
    console.log(`📞 ${phone}`);
    console.log(`📊 ${status}`);
    console.log(`🎯 Send to ${target}`);

    const msg =
`🆔 Ticket ID : ${ticket_id}
📅 วันที่ : ${ticketDate}

📌 หัวข้อ : ${title}
⚙️ อาการ : ${symptom}

🏬 สาขา : ${branch}
🏷️ รหัสสาขา : ${branch_code}

📞 Phone : ${phone}
📊 Status : ${status}`;

    try {
      await linePush(target, msg);
      console.log('✅ TICKET SENT');
    } catch (err) {
      console.error('❌ TICKET ERROR', err.response?.data || err.message);
    }
    return;
  }

  console.warn('⚠️ UNKNOWN LARK PAYLOAD TYPE');
});

// ================= START =================
app.listen(PORT, () => {
  console.log(`🚀 SERVER STARTED : PORT ${PORT}`);
});
