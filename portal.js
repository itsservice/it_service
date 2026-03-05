// ======================
// CONFIG  <- แก้ URL ที่นี่
// ======================
const BRAND_CONFIG = {
  "Au Bon Pain"         : { report: 'https://example.com', track: 'https://example.com' },
  "Dunkin'"             : { report: 'https://example.com', track: 'https://example.com' },
  "Funky Fries"         : { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Coffee"    : { report: 'https://example.com', track: 'https://example.com' },
  "Greyhound Original"  : { report: 'https://example.com', track: 'https://example.com' },
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
const brandSub   = document.getElementById('brandSub');
const btnReport  = document.getElementById('btnReport');
const btnTrack   = document.getElementById('btnTrack');
const themeBtn   = document.getElementById('themeBtn');
const themePopup = document.getElementById('themePopup');
const sliderWrap = document.getElementById('sliderWrap');
const mixSlider  = document.getElementById('mixSlider');
const clockText  = document.getElementById('clockText');
const tempText   = document.getElementById('tempText');

// notReady element — create it if not in HTML
let notReady = document.getElementById('notReady');
if (!notReady) {
  notReady = document.createElement('div');
  notReady.id = 'notReady';
  notReady.hidden = true;
  notReady.style.cssText = 'color:rgba(255,255,255,.5);font-size:13px;margin-top:8px;text-align:center;';
  notReady.textContent = 'ยังไม่พร้อมใช้งาน';
  document.querySelector('.cards')?.after(notReady);
}

// ======================
// RIPPLE
// ======================
function addRipple(el, e) {
  const rect = el.getBoundingClientRect();
  const src = e?.touches?.[0] || e;
  const x = src ? src.clientX - rect.left : rect.width / 2;
  const y = src ? src.clientY - rect.top  : rect.height / 2;
  const size = Math.max(rect.width, rect.height);
  const r = document.createElement('span');
  r.className = 'btn-ripple';
  r.style.cssText = `width:${size}px;height:${size}px;left:${x-size/2}px;top:${y-size/2}px;`;
  el.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

// ======================
// Brand routing
// ======================
function getBrandFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'portal') return Object.keys(BRAND_CONFIG)[0];
  try {
    const slug = decodeURIComponent(parts[1] || '');
    if (BRAND_CONFIG[slug]) return slug;
    const ci = Object.keys(BRAND_CONFIG).find(
      k => k.toLowerCase() === slug.toLowerCase()
    );
    return ci || Object.keys(BRAND_CONFIG)[0];
  } catch {
    return Object.keys(BRAND_CONFIG)[0];
  }
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
  brandSub.textContent = '';

  [...brandList.querySelectorAll('.brandItem')].forEach(btn => {
    btn.classList.toggle('active', btn.dataset.brand === brand);
  });

  const cfg = BRAND_CONFIG[brand];
  const invalid = !cfg || !cfg.report || !cfg.track || cfg.report === cfg.track;
  if (invalid) {
    notReady.hidden = false;
    btnReport.onclick = btnTrack.onclick = null;
    btnReport.style.opacity = '0.45';
    btnTrack.style.opacity  = '0.45';
    return;
  }
  notReady.hidden = true;
  btnReport.style.opacity = '';
  btnTrack.style.opacity  = '';
  btnReport.onclick = (e) => { addRipple(btnReport, e); setTimeout(() => location.href = cfg.report, 220); };
  btnTrack.onclick  = (e) => { addRipple(btnTrack,  e); setTimeout(() => location.href = cfg.track,  220); };
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
  menuBtn.setAttribute('aria-expanded', 'true');
  sidebar.querySelectorAll('.brandItem').forEach((el, i) => {
    el.classList.remove('visible');
    el.style.animationDelay = `${i * 28 + 40}ms`;
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
  menuBtn.setAttribute('aria-expanded', 'false');
}

function toggleMenu() { isOpen ? closeMenu() : openMenu(); }

menuBtn.addEventListener('click', (e) => { addRipple(menuBtn, e); toggleMenu(); });
closeBtn.addEventListener('click', (e) => { addRipple(closeBtn, e); closeMenu(); });
scrim.addEventListener('click', closeMenu);

// Keyboard: Escape closes menu
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

// Swipe left to close
let tx0 = null, ty0 = null;
sidebar.addEventListener('touchstart', e => {
  const t = e.touches[0]; tx0 = t.clientX; ty0 = t.clientY;
}, { passive: true });
sidebar.addEventListener('touchmove', e => {
  if (!isOpen || tx0 == null) return;
  const t = e.touches[0];
  const dx = t.clientX - tx0, dy = t.clientY - ty0;
  if (Math.abs(dy) > Math.abs(dx)) return;
  if (dx < -55) { closeMenu(); tx0 = ty0 = null; }
}, { passive: true });
sidebar.addEventListener('touchend', () => { tx0 = ty0 = null; }, { passive: true });

// ======================
// Brand list — sorted A-Z
// ======================
function renderBrandList() {
  const brands = Object.keys(BRAND_CONFIG).sort((a, b) =>
    a.localeCompare(b, ['en', 'th'], { sensitivity: 'base', numeric: true })
  );
  brandList.innerHTML = '';
  brands.forEach(b => {
    const btn = document.createElement('button');
    btn.className = 'brandItem';
    btn.textContent = b;
    btn.dataset.brand = b;
    btn.title = b;
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
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function applyTheme(mode) {
  localStorage.setItem('themeMode', mode);
  sliderWrap.hidden = mode !== 'auto';
  if (mode === 'auto') { applyMix(parseInt(localStorage.getItem('mix') || '100', 10)); return; }
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
mixSlider.addEventListener('input', e => applyMix(parseInt(e.target.value, 10)));
document.addEventListener('click', e => {
  if (!themePopup.contains(e.target) && !themeBtn.contains(e.target))
    themePopup.classList.remove('open');
});

// ======================
// Particle canvas
// ======================
(function () {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const mobile = window.innerWidth < 600;
  const COUNT  = mobile ? 25 : 55;
  const CONNECT_DIST = mobile ? 70 : 110;

  const pts = Array.from({ length: COUNT }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.3 + 0.3,
    vx: (Math.random() - 0.5) * 0.16,
    vy: (Math.random() - 0.5) * 0.16,
    o: Math.random() * 0.45 + 0.12,
  }));

  let mx = -999, my = -999;
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const light = document.body.classList.contains('theme-light');
    const col = light ? '30,50,120' : '150,190,255';

    pts.forEach(p => {
      if (!mobile) {
        const dx = p.x - mx, dy = p.y - my;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 120) { p.vx += dx/d*0.035; p.vy += dy/d*0.035; }
        const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        if (spd > 0.55) { p.vx *= 0.55/spd; p.vy *= 0.55/spd; }
      }
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col},${p.o})`;
      ctx.fill();
    });

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < CONNECT_DIST) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(${col},${0.10 * (1 - d / CONNECT_DIST)})`;
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
  const mobile = window.innerWidth < 480;
  clockText.textContent = mobile
    ? now.toLocaleTimeString('th-TH')
    : now.toLocaleString('th-TH', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
}
setInterval(updateClock, 1000);
updateClock();

async function loadTemp() {
  try {
    const r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m',
      { cache: 'no-store' }
    );
    const j = await r.json();
    const t = Math.round(j?.current?.temperature_2m);
    if (Number.isFinite(t)) tempText.textContent = t + '\u00b0C';
  } catch (_) {}
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
