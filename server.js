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
<title>${brand.brandName}</title>

<style>
*{box-sizing:border-box;}
body{
  margin:0;
  font-family:Arial;
  height:100vh;
  overflow:hidden;
  background:linear-gradient(135deg,#f3f4f6,#e5e7eb);
  transition:background 1.5s ease, color 1s ease;
}

/* ========= SIDEBAR ========= */
.menu-btn{
  position:absolute;
  top:20px;
  left:20px;
  width:55px;
  height:55px;
  border-radius:50%;
  background:${brand.primaryColor};
  color:white;
  display:flex;
  justify-content:center;
  align-items:center;
  font-size:22px;
  cursor:pointer;
  overflow:hidden;
}

.sidebar{
  position:fixed;
  left:-260px;
  top:0;
  width:240px;
  height:100%;
  background:#0f172a;
  color:white;
  padding:20px;
  transition:0.5s cubic-bezier(.68,-0.55,.27,1.55);
  backdrop-filter:blur(10px);
}

.sidebar.active{
  left:0;
}

.brand-item{
  padding:12px;
  margin:6px 0;
  background:#1e293b;
  border-radius:8px;
  cursor:pointer;
}
.brand-item.active{
  background:${brand.primaryColor};
}

/* ========= MAIN ========= */
.main{
  height:100%;
  display:flex;
  justify-content:center;
  align-items:center;
  flex-direction:column;
  text-align:center;
}

button{
  width:260px;
  padding:14px;
  margin:10px;
  border:none;
  border-radius:10px;
  font-size:16px;
  cursor:pointer;
  position:relative;
  overflow:hidden;
}

.primary{
  background:${brand.primaryColor};
  color:white;
}
.secondary{
  background:#4b5563;
  color:white;
}

/* ========= RIPPLE ========= */
button span{
  position:absolute;
  background:rgba(255,255,255,0.5);
  transform:scale(0);
  border-radius:50%;
  animation:ripple 0.6s linear;
}
@keyframes ripple{
  to{
    transform:scale(4);
    opacity:0;
  }
}

/* ========= THEME BUTTON ========= */
.theme-btn{
  position:absolute;
  top:20px;
  right:20px;
  width:55px;
  height:55px;
  border-radius:50%;
  background:white;
  display:flex;
  justify-content:center;
  align-items:center;
  cursor:pointer;
  box-shadow:0 4px 15px rgba(0,0,0,0.2);
}

.theme-options{
  position:absolute;
  top:90px;
  right:20px;
  display:none;
  flex-direction:column;
  gap:10px;
}
.theme-options.active{
  display:flex;
}
.theme-options div{
  width:45px;
  height:45px;
  border-radius:50%;
  display:flex;
  justify-content:center;
  align-items:center;
  background:white;
  cursor:pointer;
  box-shadow:0 3px 10px rgba(0,0,0,0.2);
}

/* DARK */
.dark{
  background:linear-gradient(135deg,#0f172a,#111827);
  color:white;
}

/* FADE */
.fade{
  animation:fadeIn 0.7s ease;
}
@keyframes fadeIn{
  from{opacity:0;}
  to{opacity:1;}
}

</style>
</head>

<body>

<div class="menu-btn" onclick="toggleSidebar()">☰</div>

<div class="sidebar" id="sidebar">
  <h2>Brand</h2>
  ${brandMenu}
</div>

<div class="theme-btn" onclick="toggleThemeMenu()">⚙</div>

<div class="theme-options" id="themeOptions">
  <div onclick="setLight()">🌞</div>
  <div onclick="setDark()">🌙</div>
  <div onclick="setAuto()">🕒</div>
  <div onclick="setCustom()">🎛</div>
</div>

<div class="main fade">
  <h1>${brand.brandName}</h1>

  <button class="primary" onclick="navigate(event,'${brand.reportUrl}')">
    แจ้งปัญหา
  </button>

  <button class="secondary" onclick="navigate(event,'${brand.trackUrl}')">
    ติดตาม Ticket
  </button>
</div>

<script>

/* ===== SIDEBAR ===== */
function toggleSidebar(){
  document.getElementById("sidebar").classList.toggle("active");
}

/* ===== RIPPLE ===== */
function navigate(e,url){
  const btn=e.currentTarget;
  const circle=document.createElement("span");
  circle.style.width=circle.style.height=
    Math.max(btn.clientWidth,btn.clientHeight)+"px";
  circle.style.left=e.offsetX-circle.offsetX+"px";
  circle.style.top=e.offsetY-circle.offsetY+"px";
  btn.appendChild(circle);
  setTimeout(()=>window.location.href=url,300);
}

/* ===== THEME MENU ===== */
function toggleThemeMenu(){
  document.getElementById("themeOptions").classList.toggle("active");
}

function setLight(){
  document.body.classList.remove("dark");
  localStorage.setItem("theme","light");
}

function setDark(){
  document.body.classList.add("dark");
  localStorage.setItem("theme","dark");
}

function setAuto(){
  localStorage.setItem("theme","auto");
  applyAutoTheme();
}

function setCustom(){
  const val=prompt("ใส่ค่าความเข้ม 0-100");
  document.body.style.filter="brightness("+(val/100)+")";
}

/* ===== AUTO THEME ===== */
function applyAutoTheme(){
  const hour=new Date().getHours();
  if(hour>=8 && hour<18){
    setLight();
  }else{
    setDark();
  }
}

(function(){
  const saved=localStorage.getItem("theme");
  if(saved==="dark") setDark();
  else if(saved==="light") setLight();
  else applyAutoTheme();
})();

/* ===== NAV ===== */
function goBrand(b){
  window.location.href="/portal/"+b;
}

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
