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

// =======================================================
// ================= BRAND CONFIG ========================
// =======================================================

const brands = {
  GD: {
    brandName: "GD",
    reportUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf",
    trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc",
    primaryColor: "#2563eb"
  },
  ABP: { brandName: "ABP", reportUrl: "#", trackUrl: "#", primaryColor: "#16a34a" },
  GH: { brandName: "GH", reportUrl: "#", trackUrl: "#", primaryColor: "#dc2626" },
  BR4: { brandName: "BR4", reportUrl: "#", trackUrl: "#", primaryColor: "#9333ea" },
  BR5: { brandName: "BR5", reportUrl: "#", trackUrl: "#", primaryColor: "#ea580c" },
  BR6: { brandName: "BR6", reportUrl: "#", trackUrl: "#", primaryColor: "#0ea5e9" },
  BR7: { brandName: "BR7", reportUrl: "#", trackUrl: "#", primaryColor: "#14b8a6" },
  BR8: { brandName: "BR8", reportUrl: "#", trackUrl: "#", primaryColor: "#f43f5e" },
  BR9: { brandName: "BR9", reportUrl: "#", trackUrl: "#", primaryColor: "#6366f1" }
};

// =======================================================
// ================= HEALTH ==============================
// =======================================================

app.get('/', (_, res) => res.send('SERVER OK'));

// =======================================================
// ================= MAIN BRAND SELECT PAGE ==============
// =======================================================

app.get('/portal', (req, res) => {

  const brandButtons = Object.keys(brands).map(key => `
    <button onclick="goBrand('${key}')">${brands[key].brandName}</button>
  `).join("");

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Service Portal</title>
<style>
body {
  margin:0;
  font-family: Arial;
  background:#f3f4f6;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
  flex-direction:column;
}
h1 { margin-bottom:30px; }
button {
  padding:12px 20px;
  margin:6px;
  border:none;
  border-radius:8px;
  background:#111827;
  color:white;
  cursor:pointer;
}
</style>
</head>
<body>
<h1>Select Brand</h1>
${brandButtons}
<script>
function goBrand(brand){
  window.location.href = "/portal/" + brand;
}
</script>
</body>
</html>
`);
});

// =======================================================
// ================= BRAND PAGE ==========================
// =======================================================

app.get('/portal/:brand', (req, res) => {

  const brandKey = req.params.brand.toUpperCase();
  const brand = brands[brandKey];

  if (!brand) return res.status(404).send("Brand not found");

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${brand.brandName} Portal</title>

<style>

body {
  margin:0;
  font-family: Arial;
  background:#f3f4f6;
  transition:0.3s;
}

.dark {
  background:#111827;
  color:white;
}

.sidebar {
  position:fixed;
  left:-220px;
  top:0;
  width:220px;
  height:100%;
  background:#1f2937;
  color:white;
  padding:20px;
  transition:0.3s;
}

.sidebar.active { left:0; }

.menu-btn {
  position:absolute;
  top:20px;
  left:20px;
  cursor:pointer;
  font-size:24px;
}

.time {
  position:absolute;
  top:20px;
  right:40px;
  font-size:14px;
}

.container {
  text-align:center;
  margin-top:150px;
}

.fade-up {
  opacity:0;
  transform:translateY(40px);
  animation:fadeUp 0.8s ease forwards;
}

.fade-up:nth-child(1){animation-delay:0.2s;}
.fade-up:nth-child(2){animation-delay:0.4s;}
.fade-up:nth-child(3){animation-delay:0.6s;}

@keyframes fadeUp {
  to { opacity:1; transform:translateY(0); }
}

button {
  width:260px;
  padding:14px;
  margin:10px;
  border:none;
  border-radius:8px;
  cursor:pointer;
  font-size:16px;
}

.primary {
  background:${brand.primaryColor};
  color:white;
}

.secondary {
  background:#4b5563;
  color:white;
}

.small button { width:200px; padding:10px; font-size:14px; }
.medium button { width:260px; padding:14px; font-size:16px; }
.large button { width:320px; padding:18px; font-size:18px; }

</style>
</head>

<body class="medium">

<div class="menu-btn" onclick="toggleMenu()">☰</div>
<div class="time" id="time"></div>

<div class="sidebar" id="sidebar">
  <h3>Settings</h3>
  <p onclick="setSize('small')" style="cursor:pointer;">Small</p>
  <p onclick="setSize('medium')" style="cursor:pointer;">Medium</p>
  <p onclick="setSize('large')" style="cursor:pointer;">Large</p>
  <hr>
  <p onclick="toggleDark()" style="cursor:pointer;">Dark Mode</p>
  <hr>
  <p onclick="goHome()" style="cursor:pointer;">Back</p>
</div>

<div class="container">
  <h1 class="fade-up">${brand.brandName}</h1>

  <button class="primary fade-up"
    onclick="window.location.href='${brand.reportUrl}'">
    แจ้งปัญหา
  </button>

  <br>

  <button class="secondary fade-up"
    onclick="window.location.href='${brand.trackUrl}'">
    ติดตาม Ticket
  </button>
</div>

<script>

function toggleMenu(){
  document.getElementById('sidebar').classList.toggle('active');
}

function setSize(size){
  document.body.className = size;
  toggleMenu();
}

function toggleDark(){
  document.body.classList.toggle('dark');
}

function goHome(){
  window.location.href = "/portal";
}

function updateTime(){
  const now = new Date();
  const options = {
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  };
  document.getElementById('time').innerText =
    now.toLocaleString('th-TH', options);
}

updateTime();
setInterval(updateTime,1000);

</script>

</body>
</html>
`);
});

// =======================================================
// ================= START ===============================
// =======================================================

app.listen(PORT, () =>
  console.log("🚀 SERVER STARTED : PORT " + PORT)
);
