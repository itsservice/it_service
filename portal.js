// ================== CONFIG (แก้ลิงก์แบรนด์ที่นี่ที่เดียว) ==================
const BRAND_CONFIG = {
  GD: {
    report: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf",
    track:  "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc",
  },
  ABP: { report: "#", track: "#" },
  GH:  { report: "#", track: "#" },
  BR4: { report: "#", track: "#" },
  BR5: { report: "#", track: "#" },
  BR6: { report: "#", track: "#" },
  BR7: { report: "#", track: "#" },
  BR8: { report: "#", track: "#" },
  BR9: { report: "#", track: "#" },
};

const BRAND_ORDER = ["GD","ABP","GH","BR4","BR5","BR6","BR7","BR8","BR9"];

// ================== Helpers ==================
function getBrandFromPath() {
  // /portal/ABP  -> "ABP"
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("portal");
  const b = (idx >= 0 && parts[idx + 1]) ? parts[idx + 1].toUpperCase() : "GD";
  return BRAND_CONFIG[b] ? b : "GD";
}

function setActiveBrand(brand) {
  const title = document.getElementById("brandTitle");
  title.textContent = brand;

  document.querySelectorAll(".brand-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.brand === brand);
  });

  const cfg = BRAND_CONFIG[brand];
  document.getElementById("btnReport").onclick = () => window.location.href = cfg.report;
  document.getElementById("btnTrack").onclick  = () => window.location.href = cfg.track;
}

function buildBrandMenu(activeBrand) {
  const list = document.getElementById("brandList");
  list.innerHTML = "";

  BRAND_ORDER.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "brand-item";
    btn.textContent = b;
    btn.dataset.brand = b;
    btn.onclick = () => {
      // ไปหน้า brand นั้นๆ
      window.location.href = `/portal/${b}`;
    };
    if (b === activeBrand) btn.classList.add("active");
    list.appendChild(btn);
  });
}

// ================== Sidebar open/close (minimal slide/fade) ==================
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menuBtn");
const closeBtn = document.getElementById("closeBtn");

function openSidebar() {
  overlay.hidden = false;
  sidebar.classList.remove("closing");
  sidebar.classList.add("open");
  sidebar.setAttribute("aria-hidden", "false");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebar.classList.add("closing");
  sidebar.setAttribute("aria-hidden", "true");

  // wait animation then hide overlay
  setTimeout(() => {
    overlay.hidden = true;
    sidebar.classList.remove("closing");
  }, 280);
}

function toggleSidebar() {
  const isOpen = sidebar.classList.contains("open");
  if (isOpen) closeSidebar();
  else openSidebar();
}

menuBtn.addEventListener("click", toggleSidebar);
closeBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

// ================== Time (Thai locale) ==================
function updateTime() {
  const now = new Date();
  // แสดง วัน/เดือน/ปี เวลา:นาที:วินาที
  document.getElementById("timeText").textContent = now.toLocaleString("th-TH");
}
updateTime();
setInterval(updateTime, 1000);

// ================== Temperature (Bangkok) via Open-Meteo ==================
// Client-side fetch (no server key). Update every 10 minutes.
async function updateTemp() {
  try {
    // Bangkok approx lat/lon
    const lat = 13.7563;
    const lon = 100.5018;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("temp fetch failed");

    const data = await res.json();
    const t = data?.current?.temperature_2m;

    if (typeof t === "number") {
      document.getElementById("tempText").textContent = `${Math.round(t)}°C`;
    } else {
      document.getElementById("tempText").textContent = `--°C`;
    }
  } catch (_e) {
    document.getElementById("tempText").textContent = `--°C`;
  }
}
updateTemp();
setInterval(updateTemp, 10 * 60 * 1000);

// ================== Theme system ==================
const themeBtn = document.getElementById("themeBtn");
const themePop = document.getElementById("themePop");
const sliderWrap = document.getElementById("sliderWrap");
const themeSlider = document.getElementById("themeSlider");

function applyThemeMix(pctDark) {
  // pctDark: 0..100
  // เราจะค่อยๆเปลี่ยน sky/star opacity เพื่อให้เหมือน transition
  const d = pctDark / 100;

  // Dark => stars more, clouds less
  const star = 0.08 + (0.35 * d);
  const sky  = 0.42 - (0.28 * d);

  document.documentElement.style.setProperty("--starOpacity", String(star));
  document.documentElement.style.setProperty("--skyOpacity", String(sky));

  // background base colors shift (light -> dark)
  // ใช้ mix แบบง่ายด้วย HSL-ish approximation
  // light: #e9effa like, dark: #071223
  const bg1 = mixColor([233,239,250],[7,18,35], d);
  const bg2 = mixColor([214,228,248],[10,27,51], d);

  document.documentElement.style.setProperty("--bg1", rgbToHex(bg1));
  document.documentElement.style.setProperty("--bg2", rgbToHex(bg2));
}

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0]-a[0])*t),
    Math.round(a[1] + (b[1]-a[1])*t),
    Math.round(a[2] + (b[2]-a[2])*t),
  ];
}
function rgbToHex([r,g,b]) {
  return "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join("");
}

function setTheme(mode) {
  if (mode === "light") {
    sliderWrap.hidden = true;
    applyThemeMix(0);
    localStorage.setItem("themeMode", "light");
  } else if (mode === "dark") {
    sliderWrap.hidden = true;
    applyThemeMix(100);
    localStorage.setItem("themeMode", "dark");
  } else {
    // custom/auto via slider
    sliderWrap.hidden = false;
    localStorage.setItem("themeMode", "custom");
    const v = Number(themeSlider.value || 100);
    applyThemeMix(v);
  }
}

function toggleThemePop() {
  const open = themePop.classList.toggle("open");
  themePop.setAttribute("aria-hidden", open ? "false" : "true");
}
themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleThemePop();
});
document.addEventListener("click", (e) => {
  // close pop when clicking outside
  if (!themePop.contains(e.target) && e.target !== themeBtn) {
    themePop.classList.remove("open");
    themePop.setAttribute("aria-hidden", "true");
  }
});

document.querySelectorAll(".theme-item").forEach(btn => {
  btn.addEventListener("click", () => setTheme(btn.dataset.theme));
});

themeSlider.addEventListener("input", () => {
  localStorage.setItem("themeSlider", String(themeSlider.value));
  applyThemeMix(Number(themeSlider.value));
});

// Load saved theme
(function initTheme() {
  const mode = localStorage.getItem("themeMode") || "dark";
  const slider = localStorage.getItem("themeSlider");
  if (slider != null) themeSlider.value = slider;
  setTheme(mode);
})();

// ================== init brand page ==================
(function init() {
  const brand = getBrandFromPath();
  buildBrandMenu(brand);
  setActiveBrand(brand);
})();
