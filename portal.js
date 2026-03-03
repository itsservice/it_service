// ======================
// CONFIG (แก้ที่นี่ที่เดียว)
// ======================
const BRAND_CONFIG = {
  "Animal House"     : { report: 'https://example.com', track: 'https://example.com' },
  "Another Hound Café"          : { report: 'https://example.com', track: 'https://example.com' },
  "Au Bon Pain"      : { report: 'https://example.com', track: 'https://example.com' },
  "Dunkin'"   : { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Café": { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Coffee": { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Original"      : { report: 'https://example.com', track: 'https://example.com' },
  "Kin+Hey (กินเฮ)"  : { report: 'https://example.com', track: 'https://example.com' },
  "Le Grand Véfour": { report: 'https://example.com', track: 'https://example.com' },
  "M-Kitchen (ครัวเอ็ม)"  : { report: 'https://example.com', track: 'https://example.com' },
  "Smileyhound" : { report: 'https://example.com', track: 'https://example.com' },
  
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
// RIPPLE HELPER
// สร้างวงหยดน้ำบนปุ่มที่มี overflow:hidden + position:relative
// ======================
function addRipple(el, e) {
  const rect = el.getBoundingClientRect();
  // ใช้ตำแหน่งที่คลิก หรือกลางปุ่มถ้าไม่มี event
  const x = e ? e.clientX - rect.left : rect.width / 2;
  const y = e ? e.clientY - rect.top  : rect.height / 2;
  const size = Math.max(rect.width, rect.height);

  const ripple = document.createElement('span');
  ripple.className = 'btn-ripple';
  ripple.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${x - size / 2}px;
    top: ${y - size / 2}px;
  `;
  el.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// ======================
// Helpers
// ======================
function getBrandFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'portal') return 'GD';
  return (parts[1] || 'GD').toUpperCase();
}
function setActiveBrandUI(brand) {
  brandTitle.textContent = brand;
  [...brandList.querySelectorAll('.brandItem')].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.brand === brand);
  });
  const cfg = BRAND_CONFIG[brand];
  const invalid =
    !cfg || !cfg.report || !cfg.track || (cfg.report === cfg.track);
  if (invalid) {
    notReady.hidden = false;
    btnReport.onclick = () => {};
    btnTrack.onclick  = () => {};
    return;
  }
  notReady.hidden = true;
  btnReport.onclick = (e) => { addRipple(btnReport, e); setTimeout(() => window.location.href = cfg.report, 200); };
  btnTrack.onclick  = (e) => { addRipple(btnTrack, e);  setTimeout(() => window.location.href = cfg.track,  200); };
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
  menuBtn.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menuOpen');
}
function closeMenu(){
  isOpen = false;
  sidebar.classList.remove('open');
  sidebar.setAttribute('aria-hidden','true');
  scrim.hidden = true;
  menuBtn.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menuOpen');
}
function toggleMenu(){
  isOpen ? closeMenu() : openMenu();
}

// ปุ่มเมนู: ripple แล้วเปิด
menuBtn.addEventListener('click', (e) => {
  addRipple(menuBtn, e);
  toggleMenu();
});
closeBtn.addEventListener('click', (e) => {
  addRipple(closeBtn, e);
  closeMenu();
});
scrim.addEventListener('click', closeMenu);

// swipe close (left)
let touchX0 = null;
let touchY0 = null;
sidebar.addEventListener('touchstart', (e) => {
  const t = e.touches?.[0];
  if (!t) return;
  touchX0 = t.clientX;
  touchY0 = t.clientY;
}, { passive: true });
sidebar.addEventListener('touchmove', (e) => {
  if (!isOpen || touchX0 == null) return;
  const t = e.touches?.[0];
  if (!t) return;
  const dx = t.clientX - touchX0;
  const dy = t.clientY - touchY0;
  if (Math.abs(dy) > Math.abs(dx)) return;
  if (dx < -55) {
    closeMenu();
    touchX0 = null;
    touchY0 = null;
  }
}, { passive: true });
sidebar.addEventListener('touchend', () => {
  touchX0 = null;
  touchY0 = null;
}, { passive: true });

// ======================
// Brand list render
// ======================
function renderBrandList() {
  const brands = Object.keys(BRAND_CONFIG);
  brandList.innerHTML = '';
  brands.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = 'brandItem';
    btn.textContent = b;
    btn.dataset.brand = b;
    btn.addEventListener('click', (e) => {
      addRipple(btn, e);
      setTimeout(() => {
        history.replaceState({}, '', `/portal/${b}`);
        setActiveBrandUI(b);
        closeMenu();
      }, 180);
    });
    brandList.appendChild(btn);
  });
}

// ======================
// Theme
// ======================
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function setTextForBg(rgb){
  const [r,g,b] = rgb.map(v => v/255);
  const lum = 0.2126*r + 0.7152*g + 0.0722*b;
  const fg = lum > 0.55 ? '#0b1220' : '#f1f5ff';
  const muted = lum > 0.55 ? 'rgba(11,18,32,.70)' : 'rgba(241,245,255,.70)';
  document.documentElement.style.setProperty('--fg', fg);
  document.documentElement.style.setProperty('--muted', muted);
  if (lum > 0.55) {
    document.documentElement.style.setProperty('--panel', 'rgba(0,0,0,0.06)');
    document.documentElement.style.setProperty('--panel2', 'rgba(255,255,255,0.78)');
  } else {
    document.documentElement.style.setProperty('--panel', 'rgba(255,255,255,0.08)');
    document.documentElement.style.setProperty('--panel2', 'rgba(10,14,26,0.92)');
  }
}
function applyTheme(mode){
  localStorage.setItem('themeMode', mode);
  if (mode === 'auto') {
    sliderWrap.hidden = false;
    applyMix(parseInt(localStorage.getItem('mix') || '0', 10));
    return;
  }
  sliderWrap.hidden = true;
  if (mode === 'light') {
    document.documentElement.style.setProperty('--bg1', '#eaf2ff');
    document.documentElement.style.setProperty('--bg2', '#ffffff');
    document.body.style.background =
      'radial-gradient(800px 500px at 20% 20%, rgba(255,255,255,.9), transparent 60%),' +
      'radial-gradient(900px 500px at 70% 30%, rgba(255,255,255,.7), transparent 65%),' +
      'linear-gradient(135deg, var(--bg1), var(--bg2))';
    setTextForBg([245, 248, 255]);
  }
  if (mode === 'dark') {
    document.documentElement.style.setProperty('--bg1', '#0b1220');
    document.documentElement.style.setProperty('--bg2', '#0a1630');
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
  const mid = mixColor(bg1, bg2, .5);
  setTextForBg(mid);
}

// theme popup toggle — ripple บนปุ่ม gear
themeBtn.addEventListener('click', (e) => {
  addRipple(themeBtn, e);
  themePopup.classList.toggle('open');
  const opened = themePopup.classList.contains('open');
  themePopup.setAttribute('aria-hidden', String(!opened));
});

// choose theme — ripple บน popItem
themePopup.querySelectorAll('.popItem').forEach(btn => {
  btn.addEventListener('click', (e) => {
    addRipple(btn, e);
    const mode = btn.dataset.theme;
    applyTheme(mode);
  });
});

mixSlider.addEventListener('input', (e) => {
  applyMix(parseInt(e.target.value, 10));
});

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

async function loadTemp(){
  try{
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m';
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    const t = Math.round(j?.current?.temperature_2m);
    if (Number.isFinite(t)) tempText.textContent = `${t}°C`;
  }catch(_e){}
}
loadTemp();

// ======================
// Init
// ======================
renderBrandList();
const brand = getBrandFromPath();
setActiveBrandUI(brand);
const savedMode = localStorage.getItem('themeMode') || 'dark';
const savedMix  = parseInt(localStorage.getItem('mix') || '0', 10);
mixSlider.value = String(savedMix);
applyTheme(savedMode);
if (savedMode === 'auto') applyMix(savedMix);
