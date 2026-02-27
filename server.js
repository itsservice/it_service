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
app.get('/', (req, res) => {
  res.send('SERVER OK');
});


// ======================================================
// 🌐 PORTAL PAGE (Animation + Sidebar)
// ======================================================
app.get('/portal', (req, res) => {

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GD Portal</title>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f9;
  overflow-x: hidden;
}

.fade-up {
  opacity: 0;
  transform: translateY(40px);
  animation: fadeUp 0.8s ease forwards;
}

@keyframes fadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.brand {
  font-size: 32px;
  margin-bottom: 30px;
}

button {
  width: 260px;
  padding: 15px;
  margin: 10px;
  border-radius: 10px;
  border: none;
  font-size: 16px;
  cursor: pointer;
  transition: 0.3s;
}

button:hover {
  transform: scale(1.05);
}

.menu-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  font-size: 24px;
  cursor: pointer;
}

.sidebar {
  position: fixed;
  left: -260px;
  top: 0;
  width: 260px;
  height: 100%;
  background: #222;
  color: white;
  padding: 20px;
  transition: 0.3s;
}

.sidebar.open {
  left: 0;
}

.sidebar button {
  width: 100%;
  margin: 5px 0;
}

.time {
  position: fixed;
  top: 20px;
  right: 40px;
  font-size: 14px;
}
</style>
</head>

<body>

<div class="menu-btn" onclick="toggleMenu()">☰</div>
<div class="time" id="time"></div>

<div class="sidebar" id="sidebar">
  <h3>Preset</h3>

  <strong>Size</strong>
  <button onclick="setSize('small')">Small</button>
  <button onclick="setSize('medium')">Medium</button>
  <button onclick="setSize('large')">Large</button>

  <hr>

  <strong>Color</strong>
  <button onclick="setColor('#007bff')">Blue</button>
  <button onclick="setColor('#28a745')">Green</button>
  <button onclick="setColor('#dc3545')">Red</button>
</div>

<div class="container fade-up">
  <div class="brand fade-up" style="animation-delay:0.2s">GD</div>

  <button id="btn1" class="fade-up"
    style="animation-delay:0.4s;background:#007bff;color:white"
    onclick="window.location.href='https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf'">
    แจ้งปัญหา
  </button>

  <button id="btn2" class="fade-up"
    style="animation-delay:0.6s;background:#6c757d;color:white"
    onclick="window.location.href='https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc'">
    ติดตาม Ticket
  </button>
</div>

<script>
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function setSize(size) {
  var fontSize, padding;

  if (size === 'small') {
    fontSize = "14px";
    padding = "10px";
  }
  if (size === 'medium') {
    fontSize = "16px";
    padding = "15px";
  }
  if (size === 'large') {
    fontSize = "20px";
    padding = "20px";
  }

  document.querySelectorAll("button").forEach(function(btn){
    btn.style.fontSize = fontSize;
    btn.style.padding = padding;
  });
}

function setColor(color) {
  document.getElementById('btn1').style.background = color;
  document.getElementById('btn2').style.background = color;
}

function updateTime() {
  var now = new Date();
  document.getElementById('time').innerText =
    now.toLocaleString('th-TH');
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
