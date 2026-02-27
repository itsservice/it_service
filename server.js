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
  Authorization: 'Bearer ' + LINE_TOKEN,
  'Content-Type': 'application/json'
};

// ================= LINE PUSH FLEX =================
async function linePushFlex(to, flexMessage) {
  return axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to: to, messages: [flexMessage] },
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

  const pad = decrypted[decrypted.length - 1];
  decrypted = decrypted.slice(0, decrypted.length - pad);

  return JSON.parse(decrypted.toString('utf8'));
}

// ================= HEALTH =================
app.get('/', (_, res) => res.send('SERVER OK'));


// ======================================================
// 🌐 WEB PORTAL PAGE
// ======================================================
app.get('/portal', (req, res) => {

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GD Service Portal</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f4f6f9;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
      }
      .container {
        text-align: center;
        width: 100%;
        max-width: 400px;
      }
      .brand {
        font-size: 28px;
        font-weight: bold;
        margin-bottom: 30px;
      }
      .time {
        position: absolute;
        top: 20px;
        right: 40px;
        font-size: 14px;
        color: #555;
      }
      button {
        width: 100%;
        padding: 15px;
        margin: 10px 0;
        font-size: 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .primary {
        background-color: #007bff;
        color: white;
      }
      .secondary {
        background-color: #6c757d;
        color: white;
      }
      @media (max-width: 768px) {
        body { background: #ffffff; }
        .brand { font-size: 24px; }
      }
    </style>
  </head>
  <body>

    <div class="time" id="time"></div>

    <div class="container">
      <div class="brand">GD</div>

      <button class="primary"
        onclick="window.location.href='https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf'">
        แจ้งปัญหา
      </button>

      <button class="secondary"
        onclick="window.location.href='https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc'">
        ติดตาม Ticket
      </button>
    </div>

    <script>
      function updateTime() {
        var now = new Date();
        var options = {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        };
        document.getElementById('time').innerText =
          now.toLocaleString('th-TH', options);
      }
      updateTime();
      setInterval(updateTime, 1000);
    </script>

  </body>
  </html>
  `);
});


// ======================================================
// LARK WEBHOOK
// ======================================================
app.post('/lark/webhook', async (req, res) => {

  try {

    let body = req.body;

    console.log('📥 LARK RAW');
    console.log(JSON.stringify(body, null, 2));

    if (body.encrypt && process.env.LARK_ENCRYPT_KEY) {
      body = decryptLark(process.env.LARK_ENCRYPT_KEY, body.encrypt);
      console.log('🔓 LARK DECRYPTED');
    }

    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    res.json({ ok: true });

    const data = body.event || body;

    const recordUrl =
      data.recordUrl && data.recordUrl.trim() !== ''
        ? data.recordUrl
        : null;

    if (data.line_user_id || data.line_group_id) {

      const target = data.line_user_id || data.line_group_id;

      const bubble = {
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
              text: "สถานะ: " + (data.status || "-"),
              size: "sm",
              wrap: true
            }
          ]
        }
      };

      // เพิ่ม footer เฉพาะกรณีมีลิงก์
      if (recordUrl) {
        bubble.footer = {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              style: "primary",
              action: {
                type: "uri",
                label: "เปิดรายการ",
                uri: recordUrl
              }
            }
          ]
        };
      }

      const flexMessage = {
        type: "flex",
        altText: "Ticket " + (data.ticket_id || ""),
        contents: bubble
      };

      await linePushFlex(target, flexMessage);
      console.log("✅ PUSH SUCCESS");
    }

  } catch (err) {
    console.error('❌ LARK ERROR:', err);
    res.status(500).json({ error: 'server error' });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED : PORT " + PORT);
});
