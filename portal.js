// ======================
// CONFIG (แก้ที่นี่ที่เดียว)
// ======================
const BRAND_CONFIG = {
  GD:  { report: 'https://example.com', track: 'https://example.com' },
  ABP: { report: 'https://example.com', track: 'https://example.com' },
  GH:  { report: 'https://example.com', track: 'https://example.com' },
  BR4: { report: 'https://example.com', track: 'https://example.com' },
  BR5: { report: 'https://example.com', track: 'https://example.com' },
  BR6: { report: 'https://example.com', track: 'https://example.com' },
  BR7: { report: 'https://example.com', track: 'https://example.com' },
  BR8: { report: 'https://example.com', track: 'https://example.com' },
  BR9: { report: 'https://example.com', track: 'https://example.com' },
};

// ======================
// DOM
// ======================
const menuBtn   = document.getElementById('menuBtn');
const sidebar   = document.getElementById('sidebar');
const scrim     = document.getElementById('scrim');
const closeBtn  = document.getElementById('closeBtn');
const brandList = document.getElementById('brandList');

const brandTitle = document.getElementById('brandTitle');
const btnReport  = document.getElementById('btnReport');
const btnTrack   = document.getElementById('btnTrack');
const notReady   = document.getElementById('notReady');

const themeBtn   = document.getElementById('themeBtn');
const themePopup = document.getElementById('themePopup');
const sliderWrap = document.getElementById('sliderWrap');
const mixSlider  = document.getElementById('mixSlider');

const clockText = document.getElementById('clockText');
const tempText  = document.getElementById('tempText');

// ======================
// Helpers
// ======================
function getBrandFromPath() {
  const parts = location.pathname.split('/').filter(Boolean); // ["portal","ABP"]
  if (parts[0] !== 'portal') return null;
  return (parts[1] || 'GD').toUpperCase();
}

function setActiveBrandUI(brand) {
  brandTitle.textContent = brand;

  // active highlight in list
  [...brandList.querySelectorAll('.brandItem')].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.brand === brand);
  });

  // URLs
  const cfg = BRAND_CONFIG[brand];
  if (!cfg || !cfg.report || !cfg.track || cfg.report === cfg.track) {
    // ตามที่ขอ: ยังไม่ต้องใส่ครบ ให้แสดง not ready (หรือถ้าอยากให้เข้า 1 link ก็ปรับตรงนี้)
    notReady.hidden = false;
    btnReport.onclick = () => {};
    btnTrack.onclick  = () => {};
    return;
  }

  notReady.hidden = true;
  btnReport.onclick = () => window.location.href = cfg.report;
  btnTrack.onclick  = () => window.location.href = cfg.track;
}

// ======================
// Menu open/close
// ======================
let isOpen = false;

function openMenu(){
  isOpen = true;
  sidebar.classList.add('open');
  sidebar.setAttribute('aria-hidden','false');
  scrim.hidden = false;
}

function closeMenu(){
  isOpen = false;
  sidebar.classList.remove('open');
  sidebar.setAttribute('aria-hidden','true');
  scrim.hidden = true;
}

function toggleMenu(){
  isOpen ? closeMenu() : openMenu();
}

menuBtn.addEventListener('click', toggleMenu);
closeBtn.addEventListener('click', closeMenu);
scrim.addEventListener('click', closeMenu); // ปิดด้วยการกดพื้นที่ว่าง

// ปิดแบบ “เลื่อน/ดันให้มันเก็บ” (swipe left)
let touchX0 = null;
sidebar.addEventListener('touchstart', (e) => {
  touchX0 = e.touches?.[0]?.clientX ?? null;
}, { passive: true });

sidebar.addEventListener('touchmove', (e) => {
  if (!isOpen || touchX0 == null) return;
  const x = e.touches?.[0]?.clientX;
  if (typeof x !== 'number') return;

  const dx = x - touchX0;
  // ถ้าปัดไปทางซ้ายเกิน threshold -> ปิด
  if (dx < -50) {
    closeMenu();
    touchX0 = null;
  }
}, { passive: true });

sidebar.addEventListener('touchend', () => {
  touchX0 = null;
}, { passive: true });

// ======================
// Brand list render (รองรับเพิ่มแบรนด์/scroll)
// ======================
function renderBrandList() {
  const brands = Object.keys(BRAND_CONFIG);
  brandList.innerHTML = '';
  brands.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'brandItem';
    btn.textContent = b;
    btn.dataset.brand = b;
    btn.addEventListener('click', () => {
      history.replaceState({}, '', `/portal/${b}`);
      setActiveBrandUI(b);
      closeMenu(); // เลือกแล้วปิดเมนูให้
    });
    brandList.appendChild(btn);
  });
}

// ======================
// Theme (Light/Dark/Auto + Slider)
// ======================
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

// คำนวณ luminance คร่าว ๆ เพื่อสลับสีตัวอักษรให้ “ตรงข้ามพื้นหลัง”
function setTextForBg(rgb){
  const [r,g,b] = rgb.map(v => v/255);
  const lum = 0.2126*r + 0.7152*g + 0.0722*b;
  const fg = lum > 0.55 ? '#0b1220' : '#f1f5ff';
  const muted = lum > 0.55 ? 'rgba(11,18,32,.70)' : 'rgba(241,245,255,.70)';
  document.documentElement.style.setProperty('--fg', fg);
  document.documentElement.style.setProperty('--muted', muted);

  // ปรับสีตัวหนังสือบนปุ่มให้ชัด
  btnReport.style.color = fg;
  btnTrack.style.color  = fg;
}

function applyTheme(mode){
  // mode: light | dark | auto
  localStorage.setItem('themeMode', mode);

  if (mode === 'auto') {
    sliderWrap.hidden = false; // ตามที่ขอ: Auto มี slider
    applyMix(parseInt(localStorage.getItem('mix') || '0', 10));
    return;
  }

  sliderWrap.hidden = true;

  if (mode === 'light') {
    document.documentElement.style.setProperty('--bg1', '#eaf2ff');
    document.documentElement.style.setProperty('--bg2', '#ffffff');
    // เมฆจาง ๆ
    document.body.style.background =
      'radial-gradient(800px 500px at 20% 20%, rgba(255,255,255,.9), transparent 60%),' +
      'radial-gradient(900px 500px at 70% 30%, rgba(255,255,255,.7), transparent 65%),' +
      'linear-gradient(135deg, var(--bg1), var(--bg2))';
    setTextForBg([245, 248, 255]);
  }

  if (mode === 'dark') {
    document.documentElement.style.setProperty('--bg1', '#0b1220');
    document.documentElement.style.setProperty('--bg2', '#0a1630');
    // ดาวจาง ๆ
    document.body.style.background =
      'radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,.35), transparent 60%),' +
      'radial-gradient(2px 2px at 70% 40%, rgba(255,255,255,.25), transparent 60%),' +
      'radial-gradient(2px 2px at 50% 20%, rgba(255,255,255,.20), transparent 60%),' +
      'linear-gradient(135deg, var(--bg1), var(--bg2))';
    setTextForBg([11, 18, 32]);
  }
}

function mixColor(a,b,t){
  return [
    Math.round(a[0] + (b[0]-a[0])*t),
    Math.round(a[1] + (b[1]-a[1])*t),
    Math.round(a[2] + (b[2]-a[2])*t),
  ];
}

function applyMix(value){
  // 0..100 : sun -> night
  const v = clamp(value,0,100);
  localStorage.setItem('mix', String(v));
  const t = v/100;

  const day1 = [234, 242, 255];
  const day2 = [255, 255, 255];
  const night1 = [11, 18, 32];
  const night2 = [10, 22, 48];

  const bg1 = mixColor(day1, night1, t);
  const bg2 = mixColor(day2, night2, t);

  document.documentElement.style.setProperty('--bg1', `rgb(${bg1.join(',')})`);
  document.documentElement.style.setProperty('--bg2', `rgb(${bg2.join(',')})`);

  document.body.style.background =
    'radial-gradient(900px 650px at 25% 20%, rgba(255,255,255,' + (0.22*(1-t)).toFixed(3) + '), transparent 60%),' +
    'radial-gradient(2px 2px at 70% 40%, rgba(255,255,255,' + (0.25*t).toFixed(3) + '), transparent 60%),' +
    'linear-gradient(135deg, var(--bg1), var(--bg2))';

  // ตั้งสีตัวอักษรให้ตรงข้าม “ตามพื้นหลังที่ผสม”
  const mid = mixColor(bg1, bg2, .5);
  setTextForBg(mid);
}

// เปิด popup
themeBtn.addEventListener('click', () => {
  themePopup.classList.toggle('open');
  const isOpen = themePopup.classList.contains('open');
  themePopup.setAttribute('aria-hidden', String(!isOpen));
});

// คลิกเลือก theme
themePopup.querySelectorAll('.popItem').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.theme;
    applyTheme(mode);
  });
});

// slider สำหรับ auto
mixSlider.addEventListener('input', (e) => {
  applyMix(parseInt(e.target.value, 10));
});

// คลิกที่อื่นปิด popup
document.addEventListener('click', (e) => {
  const within = themePopup.contains(e.target) || themeBtn.contains(e.target);
  if (!within) themePopup.classList.remove('open');
});

// ======================
// Clock + Temperature
// ======================
function updateClock(){
  const now = new Date();
  clockText.textContent = now.toLocaleString('th-TH');
}
setInterval(updateClock, 1000);
updateClock();

// อุณหภูมิ: ถ้าไม่อยากเรียก API ก็ปล่อย “--°C” ได้
// (ตอนนี้คงใช้ค่าเดิมของเต้แล้วก็โอเค)
async function loadTemp(){
  try{
    // Bangkok (คร่าว ๆ) - ถ้าจะเปลี่ยนใช้ geolocation ได้
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m';
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    const t = Math.round(j?.current?.temperature_2m);
    if (Number.isFinite(t)) tempText.textContent = `${t}°C`;
  }catch(_e){
    // เงียบไว้
  }
}
loadTemp();

// ======================
// Init
// ======================
renderBrandList();

const brand = getBrandFromPath();
setActiveBrandUI(brand);

// theme init
const savedMode = localStorage.getItem('themeMode') || 'dark';
const savedMix  = parseInt(localStorage.getItem('mix') || '0', 10);
mixSlider.value = String(savedMix);
applyTheme(savedMode);
if (savedMode === 'auto') applyMix(savedMix);
