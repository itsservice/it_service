const brands = require('./brands.json');

app.get('/portal/:brand', (req, res) => {

  const brandKey = req.params.brand.toUpperCase();
  const brand = brands[brandKey];

  if (!brand) {
    return res.status(404).send("Brand not found");
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brand.brandName} Service Portal</title>

<style>

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f3f4f6;
  overflow-x: hidden;
}

/* Sidebar */
.sidebar {
  position: fixed;
  left: -220px;
  top: 0;
  width: 220px;
  height: 100%;
  background: #111827;
  color: white;
  padding: 20px;
  transition: 0.3s;
}

.sidebar.active {
  left: 0;
}

.menu-btn {
  position: absolute;
  top: 20px;
  left: 20px;
  cursor: pointer;
  font-size: 24px;
}

/* Container */
.container {
  text-align: center;
  margin-top: 150px;
}

/* Fade Animation */
.fade-up {
  opacity: 0;
  transform: translateY(40px);
  animation: fadeUp 0.8s ease forwards;
}

.fade-up:nth-child(1) { animation-delay: 0.2s; }
.fade-up:nth-child(2) { animation-delay: 0.4s; }
.fade-up:nth-child(3) { animation-delay: 0.6s; }

@keyframes fadeUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

button {
  width: 260px;
  padding: 14px;
  margin: 10px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: 0.2s;
}

.primary {
  background: ${brand.primaryColor};
  color: white;
}

.secondary {
  background: #4b5563;
  color: white;
}

/* Size Presets */
.small button { width: 200px; padding: 10px; font-size: 14px; }
.medium button { width: 260px; padding: 14px; font-size: 16px; }
.large button { width: 320px; padding: 18px; font-size: 18px; }

.time {
  position: absolute;
  top: 20px;
  right: 40px;
  font-size: 14px;
  color: #555;
}

</style>
</head>

<body class="medium">

<div class="menu-btn" onclick="toggleMenu()">☰</div>

<div class="sidebar" id="sidebar">
  <h3>Preset</h3>
  <p onclick="setSize('small')" style="cursor:pointer;">ขนาดเล็ก</p>
  <p onclick="setSize('medium')" style="cursor:pointer;">ขนาดกลาง</p>
  <p onclick="setSize('large')" style="cursor:pointer;">ขนาดใหญ่</p>
</div>

<div class="time" id="time"></div>

<div class="container">
  <h1 class="fade-up">${brand.brandName}</h1>

  <button class="primary fade-up"
    onclick="window.location.href='${brand.reportUrl}'">
    แจ้งปัญหา
  </button>

  <br>

  <button class="secondary fade-up"
    onclick="window.location.href='${brand.trackUrl}'">
    ติดตาม Ticket
  </button>
</div>

<script>

function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('active');
}

function setSize(size) {
  document.body.className = size;
  toggleMenu();
}

/* Time */
function updateTime() {
  var now = new Date();
  var options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  document.getElementById('time').innerText =
    now.toLocaleString('th-TH', options);
}

updateTime();
setInterval(updateTime, 1000);

</script>

</body>
</html>
`);
});
