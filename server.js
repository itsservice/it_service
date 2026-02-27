require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =====================================================
   BRAND CONFIG (แก้ลิงก์เฉพาะตรงนี้)
===================================================== */

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

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get('/', (_, res) => {
  res.send("SERVER OK");
});

/* =====================================================
   ROUTES (ไม่ใช้ :brand? อีกต่อไป)
===================================================== */

// Default → GD
app.get('/portal', (req, res) => {
  renderPortal("GD", res);
});

// Specific brand
app.get('/portal/:brand', (req, res) => {
  const brandKey = req.params.brand.toUpperCase();
  renderPortal(brandKey, res);
});

/* =====================================================
   RENDER FUNCTION
===================================================== */

function renderPortal(brandKey, res) {

  const brand = brands[brandKey];
  if (!brand) return res.status(404).send("Brand not found");

  const brandMenu = Object.keys(brands).map(key => `
    <div class="brand-item ${key === brandKey ? 'active' : ''}"
         onclick="goBrand('${key}')">
      ${brands[key].brandName}
    </div>
  `).join("");

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${brand.brandName} Portal</title>

<style>
* { box-sizing:border-box; }

body {
  margin:0;
  font-family:Arial, sans-serif;
  display:flex;
  height:100vh;
  background:#f3f4f6;
  overflow:hidden;
  transition:0.3s;
}

/* DARK MODE */
.dark {
  background:#0f172a;
  color:white;
}
.dark .main { background:#111827; }
.dark .time { color:#cbd5e1; }

/* SIDEBAR */
.sidebar {
  width:240px;
  background:#0f172a;
  color:white;
  padding:20px;
  display:flex;
  flex-direction:column;
  align-items:center;
}

.sidebar h2 { margin-bottom:25px; }

.brand-item {
  width:100%;
  padding:12px;
  margin:6px 0;
  text-align:center;
  background:#1e293b;
  border-radius:8px;
  cursor:pointer;
  transition:0.2s;
}

.brand-item:hover {
  background:${brand.primaryColor};
}

.brand-item.active {
  background:${brand.primaryColor};
}

/* DIVIDER */
.divider {
  width:4px;
  background:#1e293b;
}

/* MAIN */
.main {
  flex:1;
  position:relative;
  display:flex;
  justify-content:center;
  align-items:center;
  background:white;
  transition:0.3s;
}

/* HEADER ITEMS */
.settings {
  position:absolute;
  top:20px;
  right:40px;
  font-size:20px;
  cursor:pointer;
}

.time {
  position:absolute;
  top:20px;
  right:90px;
  font-size:14px;
  color:#555;
}

/* CENTER */
.center {
  text-align:center;
}

.center h1 {
  margin-bottom:30px;
}

/* BUTTONS */
button {
  width:260px;
  padding:14px;
  margin:10px;
  border:none;
  border-radius:10px;
  font-size:16px;
  cursor:pointer;
  transition:0.2s;
}

.primary {
  background:${brand.primaryColor};
  color:white;
}

.secondary {
  background:#4b5563;
  color:white;
}

/* FADE */
.fade-up {
  opacity:0;
  transform:translateY(30px);
  animation:fadeUp 0.7s ease forwards;
}

.fade-up:nth-child(1){animation-delay:0.2s;}
.fade-up:nth-child(2){animation-delay:0.4s;}
.fade-up:nth-child(3){animation-delay:0.6s;}

@keyframes fadeUp {
  to { opacity:1; transform:translateY(0); }
}

/* RESPONSIVE */
@media(max-width:900px){
  .sidebar { width:180px; }
  button { width:200px; }
}

@media(max-width:600px){
  body { flex-direction:column; }
  .sidebar {
    width:100%;
    flex-direction:row;
    overflow-x:auto;
  }
  .divider { display:none; }
  .brand-item { margin:5px; }
}

</style>
</head>

<body>

<div class="sidebar">
  <h2>Brand</h2>
  ${brandMenu}
</div>

<div class="divider"></div>

<div class="main">

  <div class="settings" onclick="toggleDark()">⚙</div>
  <div class="time" id="time"></div>

  <div class="center">
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

</div>

<script>

function goBrand(b){
  window.location.href = "/portal/" + b;
}

function toggleDark(){
  document.body.classList.toggle("dark");
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
}

/* =====================================================
   START
===================================================== */

app.listen(PORT, () => {
  console.log("🚀 SERVER STARTED ON PORT " + PORT);
});
