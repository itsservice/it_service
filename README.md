# Brand
1. Dunkin'
2. Greyhound Cafe
3. Greyhound Original
4. Au Bon Pain
5. Funky Fries

# Website 
--- 
| Page     | Brand                  | Web                                                                   |
|----------|------------------------|-----------------------------------------------------------------------|
| Admin    | `All Brand`            | https://it-service-56im.onrender.com/admin                            |
| Engineer | `All Brand`            | https://it-service-56im.onrender.com/engineer                         |
| Report   | `All Brand`            | https://it-service-56im.onrender.com/report                           |
| ├──      | `Dunkin'`              | https://it-service-56im.onrender.com/report/Dunkin                    |
| ├──      | `Greyhound Cafe`       | https://it-service-56im.onrender.com/report/Greyhound%20Cafe          |
| ├──      | `Greyhound Original`   | https://it-service-56im.onrender.com/report/Greyhound%20Original      |
| ├──      | `Au Bon Pain`          | https://it-service-56im.onrender.com/report/Au%20Bon%20Pain           |
| └──      | `Funky Fries`          | https://it-service-56im.onrender.com/report/Funky%20Fries             |
---

# IT Ticket System v2

ระบบจัดการงาน IT Support สำหรับหลายแบรนด์  
Stack: **Lark Base** + **LINE Messaging** + **Render.com** + **GitHub**

---

## 📁 โครงสร้างไฟล์

```
├── server.js        — Entry point
├── app.js           — Express routes ทั้งหมด
├── auth.js          — Session + Activity Log
├── users.js         — User management (in-memory)
├── larkService.js   — Lark Base API + auto field detection
├── larkWebhook.js   — Lark → LINE notifications
├── lineWebhook.js   — LINE bot webhook
├── lineService.js   — LINE push message helper
├── env.js           — Environment variables reference
├── package.json
│
├── report.html      — 🌐 หน้าแจ้งปัญหา + ติดตาม (Public)
├── admin.html       — ⚙️  Admin Dashboard (Login required)
└── engineer.html    — 🔧 Engineer Portal (Login required)
```

---

## 🚀 วิธี Deploy บน Render

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "IT Ticket v2"
git remote add origin https://github.com/YOUR/REPO.git
git push -u origin main
```

### 2. สร้าง Web Service บน Render
- Build Command: `npm install`
- Start Command: `node server.js`

### 3. ตั้ง Environment Variables
```
LARK_APP_ID              = cli_xxxxx
LARK_APP_SECRET          = xxxxxxxx
LARK_APP_TOKEN           = xxxxxxxx
LARK_TABLE_ID            = tblxxxxxx
LINE_CHANNEL_ACCESS_TOKEN= xxxxxxxx
LINE_CHANNEL_SECRET      = xxxxxxxx
LINE_ADMIN_GROUP_ID      = Cxxxxxxxx
APP_URL                  = https://your-app.onrender.com
PWD_SALT                 = your-random-secret-here
```

---

## 🔑 Default Accounts (เปลี่ยนรหัสผ่านก่อน production!)

| Username    | Password    | Role       | หน้า           |
|-------------|-------------|------------|----------------|
| superadmin  | super1234   | Super Admin| /admin         |
| admin       | admin1234   | Admin      | /admin         |
| manager     | mgr1234     | Manager    | /admin         |
| eng1        | eng1234     | ช่าง       | /engineer      |
| eng2        | eng5678     | ช่าง       | /engineer      |
| eng3        | eng9012     | ช่าง       | /engineer      |

---

## 🌐 หน้าต่างๆ

| URL         | หน้า                            | สิทธิ์   |
|-------------|----------------------------------|----------|
| `/report`   | แจ้งปัญหา + ติดตาม Ticket       | Public   |
| `/admin`    | Dashboard + จัดการ Ticket ทั้งหมด| Login   |
| `/engineer` | งานของช่าง + ส่งรายงาน          | Login    |
| `/debug/env`| ตรวจ env vars                    | Public  |
| `/debug/lark-fields` | ตรวจ Lark field mapping  | Public  |

---

## 🔄 Flow การทำงาน

```
User แจ้งปัญหา (/report)
  → POST /api/tickets → บันทึก Lark
  → LINE แจ้ง Admin Group

Admin เห็น Ticket (/admin)
  → เปลี่ยนสถานะ / มอบหมายช่าง
  → Activity Log บันทึกทุก action

ช่าง รับงาน (/engineer)
  → เห็นเฉพาะงานของแบรนด์ตัวเอง
  → กรอกรายงาน + ส่งงาน
  → LINE แจ้ง Admin

Admin ตรวจรับ → จบงาน
  → LINE แจ้ง User (ถ้ามี LINE User ID)
```

---

## ⚠️ สำคัญ: ชื่อ Column ใน Lark

ระบบ auto-detect ชื่อ column โดยใช้ keyword matching  
ถ้า field ไม่ map ถูกต้อง ให้เข้า `/debug/lark-fields` เพื่อดูว่า column ไหน "unmapped"

Column ที่ระบบต้องการ (ใช้ชื่อเหล่านี้ใน Lark Base):
- `Status` / `สถานะ`
- `Brand` / `แบรนด์`  
- `Branch Code` / `รหัสสาขา`
- `Reporter` / `ผู้แจ้ง`
- `Phone` / `เบอร์`
- `Type` / `ประเภท`
- `Detail` / `รายละเอียด`
- `Sent Date` / `วันที่ส่ง`
- `LINE User ID`
