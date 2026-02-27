require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

/* ========= BRAND ========= */

const brands = {
  GD:{brandName:"GD"},
  ABP:{brandName:"ABP"},
  GH:{brandName:"GH"},
  BR4:{brandName:"BR4"},
  BR5:{brandName:"BR5"},
  BR6:{brandName:"BR6"},
  BR7:{brandName:"BR7"},
  BR8:{brandName:"BR8"},
  BR9:{brandName:"BR9"}
};

app.get('/',(_,res)=>res.send("SERVER OK"));
app.get('/portal',(req,res)=>render("GD",res));
app.get('/portal/:brand',(req,res)=>render(req.params.brand.toUpperCase(),res));

function render(key,res){

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
margin:0;
font-family:Arial;
height:100vh;
overflow:hidden;
transition:color .5s ease;
}

/* BACKGROUND */
.bg{
position:fixed;
inset:0;
background:linear-gradient(135deg,#ffffff,#e5e7eb);
transition:1.5s ease;
z-index:-1;
}

/* HEADER */
.header{
position:fixed;
top:0;
left:0;
right:0;
height:70px;
display:flex;
align-items:center;
justify-content:space-between;
padding:0 20px;
z-index:1100;
}

/* MENU BUTTON */
.menu-btn{
width:45px;
height:45px;
border-radius:50%;
background:#4b5563;
color:white;
display:flex;
align-items:center;
justify-content:center;
cursor:pointer;
}

/* TIME + MODE */
.time{
font-size:14px;
}
.mode-label{
font-size:12px;
}

/* SIDEBAR */
.sidebar{
position:fixed;
left:-260px;
top:0;
width:240px;
height:100%;
background:#111827;
color:white;
padding:90px 20px 20px 20px;
transition:.4s ease;
z-index:1000;
}
.sidebar.active{left:0}

.sidebar-header{
position:absolute;
top:20px;
left:20px;
right:20px;
display:flex;
justify-content:space-between;
align-items:center;
}

.brand-item{
padding:12px;
margin:6px 0;
background:#1f2937;
border-radius:8px;
cursor:pointer;
}
.brand-item.active{background:#374151}

.overlay{
position:fixed;
inset:0;
background:rgba(0,0,0,.4);
display:none;
z-index:900;
}
.overlay.active{display:block}

/* MAIN */
.main{
height:100%;
display:flex;
flex-direction:column;
justify-content:center;
align-items:center;
text-align:center;
}

/* BUTTONS */
button{
width:260px;
padding:14px;
margin:10px;
border:none;
border-radius:10px;
font-size:16px;
cursor:pointer;
background:#6b7280;
color:white;
}

/* THEME BUTTON */
.theme-btn{
width:45px;
height:45px;
border-radius:50%;
background:#6b7280;
color:white;
display:flex;
align-items:center;
justify-content:center;
cursor:pointer;
}

/* THEME PANEL */
.theme-panel{
position:absolute;
top:70px;
right:20px;
background:white;
padding:10px;
border-radius:12px;
display:none;
flex-direction:column;
gap:8px;
z-index:1200;
}
.theme-panel.active{display:flex}

/* SLIDER */
.slider-panel{
position:fixed;
bottom:-150px;
left:0;
width:100%;
background:white;
padding:20px;
transition:.5s ease;
z-index:1500;
text-align:center;
}
.slider-panel.active{bottom:0}

.slider-header{
display:flex;
justify-content:space-between;
align-items:center;
}

.light-text{color:white}
.dark-text{color:black}

</style>
</head>

<body>

<div class="bg" id="bg"></div>

<!-- HEADER -->
<div class="header">

<div style="display:flex;align-items:center;gap:10px">
<div class="menu-btn" onclick="toggleMenu()">☰</div>
</div>

<div style="text-align:right">
<div class="time" id="time"></div>
<div class="mode-label" id="modeLabel"></div>
</div>

<div class="theme-btn" onclick="toggleTheme()">⚙</div>

</div>

<!-- SIDEBAR -->
<div class="sidebar" id="sidebar">
<div class="sidebar-header">
<h3>Brand</h3>
<div onclick="closeMenu()" style="cursor:pointer">✕</div>
</div>
${menu}
</div>

<div class="overlay" id="overlay" onclick="closeMenu()"></div>

<!-- THEME -->
<div class="theme-panel" id="themePanel">
<div onclick="setLight()">🌞 Light</div>
<div onclick="setDark()">🌙 Dark</div>
<div onclick="setAuto()">🕒 Auto</div>
<div onclick="openSlider()">🎛 Custom</div>
</div>

<div class="slider-panel" id="sliderPanel">
<div class="slider-header">
<div>Custom Brightness</div>
<div onclick="closeSlider()" style="cursor:pointer">✕</div>
</div>
<input type="range" min="50" max="150" value="100"
oninput="adjustBrightness(this.value)">
</div>

<!-- MAIN -->
<div class="main" id="mainText">
<h1>${brand.brandName}</h1>
<button>แจ้งปัญหา</button>
<button>ติดตาม Ticket</button>
</div>

<script>

let sliderTimeout;

/* MENU */
function toggleMenu(){
sidebar.classList.toggle("active");
overlay.classList.toggle("active");
}
function closeMenu(){
sidebar.classList.remove("active");
overlay.classList.remove("active");
}
function goBrand(b){
closeMenu();
window.location="/portal/"+b;
}

/* TIME */
function updateTime(){
const now=new Date();
time.innerText=now.toLocaleString('th-TH');
}
setInterval(updateTime,1000);
updateTime();

/* THEME */
function toggleTheme(){
themePanel.classList.toggle("active");
}

function updateContrast(isDark){
mainText.className=isDark?"main light-text":"main dark-text";
themePanel.style.background=isDark?"#222":"#fff";
themePanel.style.color=isDark?"white":"black";
}

function setLight(){
closeSlider();
bg.style.background="linear-gradient(135deg,#ffffff,#e5e7eb)";
bg.style.filter="brightness(100%)";
updateContrast(false);
modeLabel.innerText="Light Mode";
}

function setDark(){
closeSlider();
bg.style.background="linear-gradient(135deg,#0f172a,#111827)";
bg.style.filter="brightness(100%)";
updateContrast(true);
modeLabel.innerText="Dark Mode";
}

function setAuto(){
closeSlider();
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
modeLabel.innerText="Custom Mode";
sliderPanel.classList.add("active");
sliderTimeout=setTimeout(closeSlider,3000);
}

function adjustBrightness(val){
clearTimeout(sliderTimeout);
bg.style.filter="brightness("+val+"%)";
sliderTimeout=setTimeout(closeSlider,3000);
}

function closeSlider(){
sliderPanel.classList.remove("active");
}

/* INIT */
setAuto();

</script>

</body>
</html>
`);
}

app.listen(PORT,()=>console.log("SERVER RUNNING"));
