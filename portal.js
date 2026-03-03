const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const timeEl = document.getElementById('time');

const btn1 = document.getElementById('btn1');
const btn2 = document.getElementById('btn2');

menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

// Update time (th-TH)
function updateTime(){
  const now = new Date();
  timeEl.innerText = now.toLocaleString('th-TH');
}
updateTime();
setInterval(updateTime, 1000);

// Preset controls (size/color)
document.querySelectorAll('.btn.preset').forEach((b) => {
  b.addEventListener('click', () => {
    const size = b.dataset.size;
    const color = b.dataset.color;

    if (size) setSize(size);
    if (color) setColor(color);
  });
});

function setSize(size){
  let fontSize = "16px";
  let padding = "15px";

  if (size === 'small'){ fontSize = "14px"; padding = "10px"; }
  if (size === 'medium'){ fontSize = "16px"; padding = "15px"; }
  if (size === 'large'){ fontSize = "20px"; padding = "20px"; }

  document.documentElement.style.setProperty('--btn-font', fontSize);
  document.documentElement.style.setProperty('--btn-pad', padding);
}

function setColor(color){
  // ให้ปุ่ม action ทั้งสองเปลี่ยนสีพื้นหลัง
  document.documentElement.style.setProperty('--primary', color);
  document.documentElement.style.setProperty('--secondary', color);
}

// Navigate with a tiny click animation
function goWithEffect(btn){
  const href = btn.dataset.href;
  if (!href) return;

  btn.style.transform = 'scale(0.96)';
  setTimeout(() => {
    window.location.href = href;
  }, 90);
}

btn1.addEventListener('click', () => goWithEffect(btn1));
btn2.addEventListener('click', () => goWithEffect(btn2));
