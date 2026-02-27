require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

/* ================= BRAND CONFIG ================= */

const brands = {
  GD:{brandName:"GD",reportUrl:"#",trackUrl:"#",primaryColor:"#2563eb"},
  ABP:{brandName:"ABP",reportUrl:"#",trackUrl:"#",primaryColor:"#16a34a"},
  GH:{brandName:"GH",reportUrl:"#",trackUrl:"#",primaryColor:"#dc2626"},
  BR4:{brandName:"BR4",reportUrl:"#",trackUrl:"#",primaryColor:"#9333ea"},
  BR5:{brandName:"BR5",reportUrl:"#",trackUrl:"#",primaryColor:"#ea580c"},
  BR6:{brandName:"BR6",reportUrl:"#",trackUrl:"#",primaryColor:"#0ea5e9"},
  BR7:{brandName:"BR7",reportUrl:"#",trackUrl:"#",primaryColor:"#14b8a6"},
  BR8:{brandName:"BR8",reportUrl:"#",trackUrl:"#",primaryColor:"#f43f5e"},
  BR9:{brandName:"BR9",reportUrl:"#",trackUrl:"#",primaryColor:"#6366f1"}
};

app.get('/',(_,res)=>res.send("SERVER OK"));
app.get('/portal',(req,res)=>renderPortal("GD",res));
app.get('/portal/:brand',(req,res)=>renderPortal(req.params.brand.toUpperCase(),res));

function renderPortal(key,res){

if(!brands[key]) return res.send("Brand not found");
const brand=brands[key];

const menu=Object.keys(brands).map(k=>`
<div class="brand-item ${k===key?'active':''}" onclick="goBrand('${k}')">
${brands[k].brandName}
</div>`).join("");

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${brand.brandName}</title>

<style>
*{box-sizing:border-box}
body{
margin:0;font-family:Arial;height:100vh;overflow:hidden;
background:linear-gradient(135deg,#f3f4f6,#e5e7eb);
transition:background 1.5s ease;
}

/* BACKGROUND LAYER */
.bg{
position:fixed;inset:0;
background:linear-gradient(135deg,#f3f4f6,#e5e7eb);
transition:1.5s ease;
z-index:-1;
}

/* SIDEBAR */
.sidebar{
position:fixed;left:-260px;top:0;width:240px;height:100%;
background:#0f172a;color:white;padding:20px;
transition:.4s ease;z-index:1000;
}
.sidebar.active{left:0}
.brand-item{
padding:12px;margin:6px 0;background:#1e293b;
border-radius:8px;cursor:pointer;
}
.brand-item.active{background:${brand.primaryColor}}

.overlay{
position:fixed;inset:0;background:rgba(0,0,0,.4);
backdrop-filter:blur(4px);display:none;z-index:900;
}
.overlay.active{display:block}

.menu-btn{
position:absolute;top:20px;left:20px;
width:50px;height:50px;border-radius:50%;
background:${brand.primaryColor};color:white;
display:flex;align-items:center;justify-content:center;
cursor:pointer;z-index:1100;
}

/* MAIN */
.main{
height:100%;display:flex;
flex-direction:column;justify-content:center;
align-items:center;text-align:center;
}

/* BUTTONS */
button{
width:260px;padding:14px;margin:10px;
border:none;border-radius:10px;font-size:16px;
cursor:pointer;
}
.primary{background:${brand.primaryColor};color:white}
.secondary{background:#4b5563;color:white}

/* THEME */
.theme-btn{
position:absolute;top:20px;right:20px;
width:50px;height:50px;border-radius:50%;
background:white;display:flex;align-items:center;
justify-content:center;cursor:pointer;
z-index:1100;
}

.theme-panel{
position:absolute;top:80px;right:20px;
background:white;padding:10px;border-radius:12px;
display:none;flex-direction:column;gap:8px;
z-index:1200;
}
.theme-panel.active{display:flex}
.theme-panel div{cursor:pointer;padding:6px}

.time{
position:absolute;top:20px;right:90px;
font-size:14px;color:#444;
}

.mode-label{
position:absolute;top:60px;right:90px;
font-size:12px;color:#666;
}

/* SLIDER */
.slider-panel{
position:fixed;bottom:-120px;left:0;width:100%;
background:white;padding:20px;text-align:center;
transition:.4s ease;z-index:1500;
}
.slider-panel.active{bottom:0}

</style>
</head>

<body>

<div class="bg" id="bg"></div>

<div class="menu-btn" onclick="openMenu()">☰</div>
<div class="sidebar" id="sidebar">
<h3>Brand</h3>
${menu}
<button onclick="closeMenu()">❌ ปิด</button>
</div>
<div class="overlay" id="overlay" onclick="closeMenu()"></div>

<div class="theme-btn" onclick="toggleTheme()">⚙</div>
<div class="theme-panel" id="themePanel">
<div onclick="setLight()">🌞 Light</div>
<div onclick="setDark()">🌙 Dark</div>
<div onclick="setAuto()">🕒 Auto</div>
<div onclick="openSlider()">🎛 Custom</div>
</div>

<div class="slider-panel" id="sliderPanel">
<input type="range" min="50" max="150" value="100"
oninput="adjustBrightness(this.value)">
</div>

<div class="time" id="time"></div>
<div class="mode-label" id="modeLabel"></div>

<div class="main">
<h1>${brand.brandName}</h1>
<button class="primary">แจ้งปัญหา</button>
<button class="secondary">ติดตาม Ticket</button>
</div>

<script>

function openMenu(){
sidebar.classList.add("active");
overlay.classList.add("active");
}
function closeMenu(){
sidebar.classList.remove("active");
overlay.classList.remove("active");
}

function goBrand(b){
closeMenu();
window.location="/portal/"+b;
}

/* ===== TIME ===== */
function updateTime(){
const now=new Date();
time.innerText=now.toLocaleString('th-TH');
}
setInterval(updateTime,1000);
updateTime();

/* ===== THEME ===== */
function toggleTheme(){
themePanel.classList.toggle("active");
}

function setLight(){
bg.style.background="linear-gradient(135deg,#f3f4f6,#e5e7eb)";
modeLabel.innerText="Light Mode";
localStorage.setItem("theme","light");
}

function setDark(){
bg.style.background="linear-gradient(135deg,#0f172a,#111827)";
modeLabel.innerText="Dark Mode";
localStorage.setItem("theme","dark");
}

function setAuto(){
localStorage.setItem("theme","auto");
applyAuto();
}

function applyAuto(){
const h=new Date().getHours();
if(h>=8 && h<18){
setLight();
modeLabel.innerText="Auto Mode (Light)";
}else{
setDark();
modeLabel.innerText="Auto Mode (Dark)";
}
}

function openSlider(){
sliderPanel.classList.add("active");
modeLabel.innerText="Custom Mode";
localStorage.setItem("theme","custom");
}

function adjustBrightness(val){
bg.style.filter="brightness("+val+"%)";
}

(function init(){
const saved=localStorage.getItem("theme");
if(saved==="dark") setDark();
else if(saved==="light") setLight();
else if(saved==="custom") openSlider();
else applyAuto();
})();

</script>

</body>
</html>
`);
}

app.listen(PORT,()=>console.log("SERVER STARTED"));
