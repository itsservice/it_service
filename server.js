app.get('/portal', (req, res) => {

res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GD Portal</title>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f9;
  overflow-x: hidden;
}

/* Fade Animation */
.fade-up {
  opacity: 0;
  transform: translateY(40px);
  animation: fadeUp 0.8s ease forwards;
}

@keyframes fadeUp {
  to { opacity:1; transform:translateY(0); }
}

/* Layout */
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

/* Menu Button */
.menu-btn {
  position: fixed;
  top: 15px;
  left: 15px;
  width: 45px;
  height: 45px;
  background: #222;
  color: white;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 1001;
  font-size: 20px;
}

/* Sidebar */
.sidebar {
  position: fixed;
  left: -260px;
  top: 0;
  width: 260px;
  height: 100%;
  background: #222;
  color: white;
  padding: 20px;
  transition: 0.3s;
  z-index: 1002;
}

.sidebar.open {
  left: 0;
}

/* Overlay */
.overlay {
  position: fixed;
  top:0;
  left:0;
  width:100%;
  height:100%;
  background: rgba(0,0,0,0.4);
  display:none;
  z-index:1000;
}

.overlay.show {
  display:block;
}

/* Buttons */
button {
  width: 260px;
  padding: 15px;
  margin: 10px;
  border-radius: 10px;
  border: none;
  font-size: 16px;
  cursor: pointer;
  transition: 0.3s;
}

button:hover { transform: scale(1.05); }

.brand { font-size:32px; margin-bottom:30px; }

.time {
  position: fixed;
  top: 15px;
  right: 30px;
  font-size: 14px;
}
</style>
</head>

<body>

<div class="menu-btn" onclick="openMenu()">≡</div>
<div class="overlay" id="overlay" onclick="closeMenu()"></div>

<div class="sidebar" id="sidebar">
  <h3>ตั้งค่า</h3>
  <button onclick="setSize('small')">Small</button>
  <button onclick="setSize('medium')">Medium</button>
  <button onclick="setSize('large')">Large</button>
  <hr>
  <button onclick="setColor('#007bff')">Blue</button>
  <button onclick="setColor('#28a745')">Green</button>
  <button onclick="setColor('#dc3545')">Red</button>
</div>

<div class="time" id="time"></div>

<div class="container fade-up">
  <div class="brand fade-up" style="animation-delay:0.2s">GD</div>

  <button id="btn1" class="fade-up"
    style="animation-delay:0.4s;background:#007bff;color:white"
    onclick="window.location.href='https://gjpl1ez37fzh.jp.larksuite.com/share/base/form/shrjp3lEZoGxc1dyZtcXdPBehJf'">
    แจ้งปัญหา
  </button>

  <button id="btn2" class="fade-up"
    style="animation-delay:0.6s;background:#6c757d;color:white"
    onclick="window.location.href='https://gjpl1ez37fzh.jp.larksuite.com/share/base/query/shrjpnvMShBpzPtQrNeNP8Tzygc'">
    ติดตาม Ticket
  </button>
</div>

<script>
function openMenu() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}

function closeMenu() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function setSize(size) {
  var fontSize = "16px";
  var padding = "15px";

  if (size === 'small') { fontSize="14px"; padding="10px"; }
  if (size === 'large') { fontSize="20px"; padding="20px"; }

  document.querySelectorAll("button").forEach(function(btn){
    btn.style.fontSize = fontSize;
    btn.style.padding = padding;
  });
}

function setColor(color) {
  document.getElementById('btn1').style.background = color;
  document.getElementById('btn2').style.background = color;
}

function updateTime() {
  document.getElementById('time').innerText =
    new Date().toLocaleString('th-TH');
}
updateTime();
setInterval(updateTime, 1000);
</script>

</body>
</html>
`);
});
