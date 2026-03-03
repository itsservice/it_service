// ===== CONFIG =====
const BRANDS = [
  { code: "GD",  issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "ABP", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "GH",  issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "BR4", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "BR5", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "BR6", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "BR7", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "BR8", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
  { code: "BR9", issueUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf", trackUrl: "https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc" },
];

// ===== DOM =====
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const brandList = document.getElementById("brandList");

const brandTitle = document.getElementById("brandTitle");
const btnIssue = document.getElementById("btnIssue");
const btnTrack = document.getElementById("btnTrack");

const dateTimeEl = document.getElementById("dateTime");
const tempEl = document.getElementById("tempC");

const themeBtn = document.getElementById("themeBtn");
const themePanel = document.getElementById("themePanel");
const customRow = document.getElementById("customRow");
const mixSlider = document.getElementById("mixSlider");

// ===== HELPERS =====
function getBrandFromPath() {
  // /portal/BR5
  const parts = window.location.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("portal");
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1].toUpperCase();
  return "GD";
}

function setBrand(code) {
  const b = BRANDS.find(x => x.code === code) || BRANDS[0];
  brandTitle.textContent = b.code;

  btnIssue.onclick = () => window.location.href = b.issueUrl;
  btnTrack.onclick = () => window.location.href = b.trackUrl;

  // active highlight
  document.querySelectorAll(".brandBtn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.code === b.code);
  });
}

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.remove("hidden");
}
function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.add("hidden");
}
function toggleSidebar() {
  if (sidebar.classList.contains("open")) closeSidebar();
  else openSidebar();
}

// ===== SIDEBAR BUILD =====
function buildBrandButtons() {
  brandList.innerHTML = "";
  BRANDS.forEach(b => {
    const btn = document.createElement("button");
    btn.className = "brandBtn";
    btn.textContent = b.code;
    btn.dataset.code = b.code;
    btn.onclick = () => {
      // go to brand page
      window.location.href = `/portal/${b.code}`;
    };
    brandList.appendChild(btn);
  });
}

// ===== TIME =====
function updateTime() {
  const now = new Date();
  // th-TH: dd/mm/yyyy HH:MM:SS
  dateTimeEl.textContent = now.toLocaleString("th-TH");
}
setInterval(updateTime, 1000);
updateTime();

// ===== TEMP (best-effort) =====
async function tryLoadTemp(lat, lon) {
  // Best-effort: open API may fail depending on network policy. If fail -> keep "--"
  // Using open endpoint style (no key) - if blocked, it will just stay as "--"
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) return;
  const j = await r.json();
  const t = j?.current?.temperature_2m;
  if (typeof t === "number") tempEl.textContent = String(Math.round(t));
}

function loadTemp() {
  // fallback: Bangkok
  const fallback = () => tryLoadTemp(13.7563, 100.5018).catch(() => {});

  if (!navigator.geolocation) return fallback();

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      tryLoadTemp(latitude, longitude).catch(() => fallback());
    },
    () => fallback(),
    { enableHighAccuracy: false, timeout: 2500 }
  );
}
loadTemp();

// ===== THEME =====
function setTheme(mode) {
  document.body.classList.remove("theme-light", "theme-dark");
  customRow.classList.add("hidden");

  if (mode === "light") {
    document.body.classList.add("theme-light");
  } else if (mode === "dark") {
    document.body.classList.add("theme-dark");
  } else if (mode === "custom") {
    customRow.classList.remove("hidden");
    // custom uses CSS var --mix from slider
  }
  localStorage.setItem("themeMode", mode);
}

function applyCustomMix(v) {
  document.documentElement.style.setProperty("--mix", String(v));
  localStorage.setItem("themeMix", String(v));
}

// Theme panel toggle
themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  themePanel.classList.toggle("hidden");
});

// click outside closes panel
document.addEventListener("click", () => {
  if (!themePanel.classList.contains("hidden")) themePanel.classList.add("hidden");
});

// theme option
document.querySelectorAll(".panelItem").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const mode = e.currentTarget.dataset.theme;
    setTheme(mode);
  });
});

mixSlider.addEventListener("input", (e) => {
  applyCustomMix(e.target.value);
});

// restore
(function restoreTheme(){
  const mode = localStorage.getItem("themeMode") || "dark";
  const mix = Number(localStorage.getItem("themeMix") || "50");
  mixSlider.value = String(mix);
  applyCustomMix(mix);
  setTheme(mode);
})();

// ===== SIDEBAR EVENTS =====
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleSidebar();
});

closeSidebarBtn.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

// ESC close
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSidebar();
    themePanel.classList.add("hidden");
  }
});

// ===== INIT =====
buildBrandButtons();
setBrand(getBrandFromPath());

// ===== Theme background variants =====
// (CSS classes)
const style = document.createElement("style");
style.textContent = `
  body.theme-light{
    color: rgba(10,12,18,0.92);
    background:
      radial-gradient(900px 500px at 30% 30%, rgba(0,0,0,0.06), transparent 60%),
      linear-gradient(135deg, #eef2ff, #dbeafe);
  }
  body.theme-dark{
    color: rgba(255,255,255,0.92);
  }
  /* custom mix: 0 day -> 100 night */
  body:not(.theme-light):not(.theme-dark){
    background:
      radial-gradient(1200px 600px at 30% 30%, rgba(255,255,255,0.08), transparent 60%),
      linear-gradient(135deg,
        color-mix(in srgb, #eef2ff calc((100 - var(--mix))*1%), #0b1220 calc(var(--mix)*1%)),
        color-mix(in srgb, #dbeafe calc((100 - var(--mix))*1%), #0f1a33 calc(var(--mix)*1%))
      );
  }
`;
document.head.appendChild(style);
