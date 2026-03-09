# 🖥️ IT Ticket System v2

ระบบจัดการงาน IT Support สำหรับหลายแบรนด์  
**Stack:** Lark Base · LINE Messaging · Render.com · GitHub

---

## 🌐 Brand & Website

### แบรนด์ที่ใช้งานระบบ

| # | Brand |
|---|-------|
| 1 | Dunkin' |
| 2 | Greyhound Cafe |
| 3 | Greyhound Original |
| 4 | Au Bon Pain |
| 5 | Funky Fries |

### URL ทั้งหมด

| หน้า | สำหรับ | URL | สิทธิ์ |
|------|--------|-----|--------|
| **Admin** | ผู้ดูแลระบบ | https://it-service-56im.onrender.com/admin | 🔐 Login |
| **Engineer** | ช่างเทคนิค | https://it-service-56im.onrender.com/engineer | 🔐 Login |
| **Report** | ทุกแบรนด์ | https://it-service-56im.onrender.com/report | 🌍 Public |
| ↳ Dunkin' | ร้าน Dunkin' | https://it-service-56im.onrender.com/report/Dunkin | 🌍 Public |
| ↳ Greyhound Cafe | ร้าน Greyhound Cafe | https://it-service-56im.onrender.com/report/Greyhound%20Cafe | 🌍 Public |
| ↳ Greyhound Original | ร้าน Greyhound Original | https://it-service-56im.onrender.com/report/Greyhound%20Original | 🌍 Public |
| ↳ Au Bon Pain | ร้าน Au Bon Pain | https://it-service-56im.onrender.com/report/Au%20Bon%20Pain | 🌍 Public |
| ↳ Funky Fries | ร้าน Funky Fries | https://it-service-56im.onrender.com/report/Funky%20Fries | 🌍 Public |

> 💡 **หมายเหตุ:** URL แยกตามแบรนด์ใช้สำหรับทำ QR Code แจกให้แต่ละสาขา — เปิดแล้วจะ pre-select brand อัตโนมัติ

---

## 🔑 บัญชีผู้ใช้

| Username | Password | Role | เข้าหน้า |
|----------|----------|------|----------|
| `superadmin` | `super1234` | Super Admin | /admin |
| `admin` | `admin1234` | Admin | /admin |
| `manager` | `mgr1234` | Manager | /admin |
| `eng1` | `eng1234` | ช่างเทคนิค | /engineer |
| `eng2` | `eng5678` | ช่างเทคนิค | /engineer |
| `eng3` | `eng9012` | ช่างเทคนิค | /engineer |

> ⚠️ **เปลี่ยนรหัสผ่านก่อน production!**

---

## 🔄 Flow การทำงาน

```
🏪 ร้านค้า แจ้งปัญหา (/report)
      │
      ▼
📋 POST /api/tickets → บันทึกลง Lark Base
      │
      ▼
📲 LINE แจ้ง Admin Group ทันที
      │
      ▼
⚙️  Admin รับเรื่อง (/admin)
      │  → เปลี่ยนสถานะ / มอบหมายช่าง
      │  → Activity Log บันทึกทุก action
      │
      ▼
🔧 ช่าง รับงาน (/engineer)
      │  → เห็นเฉพาะงานแบรนด์ตัวเอง
      │  → กรอกรายงาน + ส่งงาน
      │  → LINE แจ้ง Admin
      │
      ▼
✅ Admin ตรวจรับ → ปิดงาน
      │
      ▼
📲 LINE แจ้ง User (ถ้ามี LINE User ID)
```

---

## 🛠️ Debug Endpoints

| URL | ใช้ทำอะไร |
|-----|-----------|
| `/debug/tables` | ดูสถานะ Lark tables ทั้งหมด |
| `/debug/branches` | ดู branch code ที่โหลดมาในระบบ |
| `/debug/branch-raw` | ดู field names ดิบจาก Lark |
| `/debug/env` | ตรวจ environment variables |

---

## ⚙️ Environment Variables

| Key | ค่าที่ต้องตั้ง |
|-----|---------------|
| `LARK_APP_ID` | App ID จาก Lark Developer |
| `LARK_APP_SECRET` | App Secret จาก Lark Developer |
| `LARK_APP_TOKEN` | Token ของ Lark Base |
| `LARK_TABLE_DUNKIN` | Table ID ของ Dunkin' |
| `LARK_TABLE_GREYHOUND_CAFE` | Table ID ของ Greyhound Cafe |
| `LARK_TABLE_GREYHOUND_ORIGINAL` | Table ID ของ Greyhound Original |
| `LARK_TABLE_AU_BON_PAIN` | Table ID ของ Au Bon Pain |
| `LARK_TABLE_FUNKY_FRIES` | Table ID ของ Funky Fries |
| `LARK_BRANCH_DUNKIN` | Branch Table ID ของ Dunkin' |
| `LARK_BRANCH_GREYHOUND_CAFE` | Branch Table ID ของ Greyhound Cafe |
| `LARK_BRANCH_AU_BON_PAIN` | Branch Table ID ของ Au Bon Pain |
| `LARK_BRANCH_FUNKY_FRIES` | Branch Table ID ของ Funky Fries |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot Token |
| `LINE_CHANNEL_SECRET` | LINE Bot Secret |
| `LINE_ADMIN_GROUP_ID` | Group ID ที่ต้องการรับแจ้งเตือน |
| `APP_URL` | https://it-service-56im.onrender.com |
| `PWD_SALT` | Random string สำหรับ hash password |

---

## 📁 โครงสร้างไฟล์

```
it-ticket-system/
│
├── server.js           — Entry point
├── app.js              — Express routes ทั้งหมด
├── auth.js             — Session + Activity Log
├── users.js            — User management (in-memory)
│
├── larkService.js      — Lark Base API + field detection
├── larkWebhook.js      — Lark → LINE notifications
│
├── lineWebhook.js      — LINE bot webhook
├── lineService.js      — LINE push message helper
│
├── env.js              — Environment variables reference
├── package.json
│
├── report.html         — 🌍 หน้าแจ้งปัญหา + ติดตาม (Public)
├── admin.html          — ⚙️  Admin Dashboard (Login required)
└── engineer.html       — 🔧 Engineer Portal (Login required)
```

---

## 🚀 วิธี Deploy บน Render

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "IT Ticket v2"
git remote add origin https://github.com/YOUR/REPO.git
git push -u origin main
```

### 2. สร้าง Web Service บน Render
- **Build Command:** `npm install`
- **Start Command:** `node server.js`

### 3. ตั้ง Environment Variables ใน Render Dashboard
ใส่ค่าตามตาราง Environment Variables ด้านบน
