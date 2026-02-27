app.get('/portal', (req, res) => {

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GD Service Portal</title>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f6f9;
  overflow-x: hidden;
}

/* Fade Up Animation */
.fade-up {
  opacity: 0;
  transform: translateY(40px);
  animation: fadeUp 0.8s ease forwards;
}

@keyframes fadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Layout */
.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.brand {
  font-size: 32px;
  margin-bottom: 30px;
}

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

button:hover {
  transform: scale(1.05);
}

/* Sidebar */
.menu-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  font-size: 24px;
  cursor: pointer;
}

.sidebar {
  position: fixed;
  left: -300px;
  top: 0;
  width: 260px;
  height: 100%;
  background: #222;
  color: white;
  padding: 20px;
  transition: 0.3s;
}

.sidebar.open {
  left: 0;
}

.sidebar h3 {
  margin-top: 0;
}

.sidebar button {
  width: 100%;
  margin: 5px 0;
}

/* Time */
.time {
  position: fixed;
  top: 20px;
  right: 40px;
  font-size: 14px;
}
</style>
</head>

<body>

<div class="menu-btn" onclick="toggleMenu()">☰</div>
<div class="time" id="time"></div>

<div class="sidebar" id="sidebar">
  <h3>ตั้งค่า Preset</h3>

  <strong>ขนาด</strong>
  <button onclick="setSize('small')">เล็ก</button>
  <button onclick="setSize('medium')">กลาง</button>
  <button onclick="setSize('large')">ใหญ่</button>

  <hr>

  <strong>สี</strong>
  <button onclick="setColor('#007bff')">Blue</button>
  <button onclick="setColor('#28a745')">Green</button>
  <button onclick="setColor('#dc3545')">Red</button>
</div>

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
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function setSize(size) {
  let fontSize;
  let padding;

  if (size === 'small') {
    fontSize = "14px";
    padding = "10px";
  }
  if (size === 'medium') {
    fontSize = "16px";
    padding = "15px";
  }
  if (size === 'large') {
    fontSize = "20px";
    padding = "20px";
  }

  document.querySelectorAll("button").forEach(btn => {
    btn.style.fontSize = fontSize;
    btn.style.padding = padding;
  });
}

function setColor(color) {
  document.getElementById('btn1').style.background = color;
  document.getElementById('btn2').style.background = color;
}

function updateTime() {
  const now = new Date();
  document.getElementById('time').innerText =
    now.toLocaleString('th-TH');
}

updateTime();
setInterval(updateTime, 1000);
</script>

</body>
</html>
`);
});
