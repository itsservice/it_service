// ======================
// CONFIG (แก้ที่นี่ที่เดียว)
// ======================
const BRAND_CONFIG = {
  "Animal House"      : { report: 'https://example.com', track: 'https://example.com' },
  "Another Hound Café": { report: 'https://example.com', track: 'https://example.com' },
  "Au Bon Pain"       : { report: 'https://example.com', track: 'https://example.com' },
  "Dunkin'"           : { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Café"    : { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Coffee"  : { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Original": { report: 'https://example.com', track: 'https://example.com' },
  "Kin+Hey (กินเฮ)"   : { report: 'https://example.com', track: 'https://example.com' },
  "Le Grand Véfour"   : { report: 'https://example.com', track: 'https://example.com' },
  "M-Kitchen (ครัวเอ็ม)": { report: 'https://example.com', track: 'https://example.com' },
  "Smileyhound"       : { report: 'https://example.com', track: 'https://example.com' },
};

// ======================
// DOM
// ======================
const menuBtn    = document.getElementById('menuBtn');
const sidebar    = document.getElementById('sidebar');
const scrim      = document.getElementById('scrim');
const closeBtn   = document.getElementById('closeBtn');
const brandList  = document.getElementById('brandList');
const brandTitle = document.getElementById('brandTitle');
const btnReport  = document.getElementById('btnReport');
const btnTrack   = document.getElementById('btnTrack');
const notReady   = document.getElementById('notReady');
const themeBtn   = document.getElementById('themeBtn');
const themePopup = document.getElementById('themePopup');
const sliderWrap = document.getElementById('sliderWrap');
const mixSlider  = document.getElementById('mixSlider');
const clockText  = document.getElementById('clockText');
const tempText   = document.getElementById('tempText');

// ======================
// RIPPLE
// ======================
function addRipple(el, e) {
  const rect = el.getBoundingClientRect();
  const x = e ? e.clientX - rect.left : rect.width / 2;
  const y = e ? e.clientY - rect.top  : rect.height / 2;
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement('span');
  r.className = 'btn-ripple';
  r.style.cssText = `width:${size}px;height:${size}px;left:${x-size/2}px;top:${y-size/2}px;`;
  el.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ======================
// Brand routing  ← FIX: decodeURIComponent ป้องกัน %20
// ======================
function getBrandFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'portal') return Object.keys(BRAND_CONFIG)[0];
  const slug = decodeURIComponent(parts[1] || '');
  // หา key ที่ตรงตัว หรือ case-insensitive
  const exact = BRAND_CONFIG[slug];
  if (exact) return slug;
  const found = Object.keys(BRAND_CONFIG).find(
    k => k.toLowerCase() === slug.toLowerCase()
  );
  return found || Object.keys(BRAND_CONFIG)[0];
}

let currentBrand = null;

function setActiveBrandUI(brand, animate = false) {
  if (animate && currentBrand !== brand) {
    brandTitle.classList.add('switching');
    setTimeout(() => {
      brandTitle.textContent = brand;
      brandTitle.classList.remove('switching');
    }, 180);
  } else {
    brandTitle.textContent = brand;
  }
  currentBrand = brand;

  [...brandList.querySelectorAll('.brandItem')].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.brand === brand);
  });

  const cfg = BRAND_CONFIG[brand];
  const invalid = !cfg || !cfg.report || !cfg.track || cfg.report === cfg.track;

  if (invalid) {
    notReady.hidden = false;
    btnReport.onclick = null;
    btnTrack.onclick  = null;
    return;
  }
  notReady.hidden = true;
  btnReport.onclick = (e) => { addRipple(btnReport, e); setTimeout(() => window.location.href = cfg.report, 220); };
  btnTrack.onclick  = (e) => { addRipple(btnTrack, e);  setTimeout(() => window.location.href = cfg.track,  220); };
}

// ======================
// Sidebar
// ======================
let isOpen = false;

function openMenu() {
  isOpen = true;
  sidebar.classList.add('open');
  sidebar.setAttribute('aria-hidden', 'false');
  scrim.hidden = false;
  document.body.classList.add('menuOpen');
  sidebar.querySelectorAll('.brandItem').forEach((el, i) => {
    el.classList.remove('visible');
    el.style.animationDelay = `${i * 35 + 60}ms`;
    void el.offsetWidth;
    el.classList.add('visible');
  });
}
function closeMenu() {
  isOpen = false;
  sidebar.classList.remove('open');
  sidebar.setAttribute('aria-hidden', 'true');
  scrim.hidden = true;
  document.body.classList.remove('menuOpen');
}
function toggleMenu() { isOpen ? closeMenu() : openMenu(); }

menuBtn.addEventListener('click', (e) => { addRipple(menuBtn, e); toggleMenu(); });
closeBtn.addEventListener('click', (e) => { addRipple(closeBtn, e); closeMenu(); });
scrim.addEventListener('click', closeMenu);

let tx0 = null, ty0 = null;
sidebar.addEventListener('touchstart', e => { const t = e.touches?.[0]; if(t){tx0=t.clientX;ty0=t.clientY;} }, {passive:true});
sidebar.addEventListener('touchmove',  e => {
  if(!isOpen||tx0==null) return;
  const t=e.touches?.[0]; if(!t) return;
  const dx=t.clientX-tx0, dy=t.clientY-ty0;
  if(Math.abs(dy)>Math.abs(dx)) return;
  if(dx<-55){closeMenu();tx0=ty0=null;}
}, {passive:true});
sidebar.addEventListener('touchend', ()=>{tx0=ty0=null;}, {passive:true});

// ======================
// Brand list — A-Z
// ======================
function renderBrandList() {
  const brands = Object.keys(BRAND_CONFIG).sort((a, b) =>
    a.localeCompare(b, ['en','th'], { sensitivity: 'base', numeric: true })
  );
  brandList.innerHTML = '';
  brands.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'brandItem';
    btn.textContent = b;
    btn.dataset.brand = b;
    btn.addEventListener('click', (e) => {
      addRipple(btn, e);
      setTimeout(() => {
        history.replaceState({}, '', `/portal/${encodeURIComponent(b)}`);
        setActiveBrandUI(b, true);
        closeMenu();
      }, 180);
    });
    brandList.appendChild(btn);
  });
}

// ======================
// Theme
// ======================
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

function applyTheme(mode) {
  localStorage.setItem('themeMode', mode);
  sliderWrap.hidden = mode !== 'auto';
  if (mode === 'auto') { applyMix(parseInt(localStorage.getItem('mix')||'100',10)); return; }
  document.body.classList.toggle('theme-light', mode === 'light');
}

function applyMix(v) {
  v = clamp(v, 0, 100);
  localStorage.setItem('mix', String(v));
  mixSlider.value = String(v);
  document.body.classList.toggle('theme-light', v < 50);
}

themeBtn.addEventListener('click', (e) => {
  addRipple(themeBtn, e);
  const open = themePopup.classList.toggle('open');
  themePopup.setAttribute('aria-hidden', String(!open));
});
themePopup.querySelectorAll('.popItem').forEach(btn => {
  btn.addEventListener('click', (e) => { addRipple(btn, e); applyTheme(btn.dataset.theme); });
});
mixSlider.addEventListener('input', e => applyMix(parseInt(e.target.value,10)));
document.addEventListener('click', e => {
  if (!themePopup.contains(e.target) && !themeBtn.contains(e.target))
    themePopup.classList.remove('open');
});

// ======================
// Particle / Canvas background
// ======================
(function initCanvas() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const COUNT = 55;
  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * 1000,
      y: Math.random() * 800,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      o: Math.random() * 0.5 + 0.15,
    });
  }

  let mouse = { x: -999, y: -999 };
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const isLight = document.body.classList.contains('theme-light');
    const dotColor = isLight ? '30,50,120' : '150,190,255';

    particles.forEach(p => {
      // subtle mouse repel
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 120) {
        p.vx += dx / dist * 0.04;
        p.vy += dy / dist * 0.04;
      }
      // speed limit
      const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
      if (spd > 0.6) { p.vx *= 0.6/spd; p.vy *= 0.6/spd; }

      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(${dotColor},${p.o})`;
      ctx.fill();
    });

    // connect nearby dots
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(${dotColor},${0.12*(1 - d/110)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ======================
// Clock + Temp
// ======================
function updateClock() {
  const now = new Date();
  clockText.textContent = now.toLocaleString('th-TH', {
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  });
}
setInterval(updateClock, 1000);
updateClock();

async function loadTemp() {
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m', { cache: 'no-store' });
    const j = await r.json();
    const t = Math.round(j?.current?.temperature_2m);
    if (Number.isFinite(t)) tempText.textContent = t + '°C';
  } catch(_) {}
}
loadTemp();

// ======================
// Init
// ======================
renderBrandList();
const initBrand = getBrandFromPath();
setActiveBrandUI(initBrand);

const savedMode = localStorage.getItem('themeMode') || 'dark';
const savedMix  = parseInt(localStorage.getItem('mix') || '100', 10);
mixSlider.value = String(savedMix);
applyTheme(savedMode);
if (savedMode === 'auto') applyMix(savedMix);
