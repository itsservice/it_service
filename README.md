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
# 📋 IT Support System v2 — Project Brief

> **Session Reference Document**  
> ใช้เป็น prompt อ้างอิงสำหรับการพัฒนาต่อเนื่อง

---

## 🏗️ Stack Overview

| Layer | Technology | URL / Location |
|-------|-----------|----------------|
| Frontend | HTML/CSS/JS + Node.js/Express | https://it-service-56im.onrender.com |
| Backend | Node.js (Express) | Render.com (auto-deploy จาก GitHub) |
| DB Bridge | FastAPI (Python) | https://repair.mobile1234.site |
| Database | MySQL | 10.8.1.88:3306 / database: `it_ticket` |
| API Key | Header: `X-API-Key` | `repair123` |
| Repository | GitHub | https://github.com/itsservice/it_service (branch: `main`) |
| Font | Google Fonts | Prompt (weights 300–800) |
| Notifications | LINE Messaging API | Flex Messages |

> ⚠️ **Critical:** ทุก DB operation ต้องผ่าน FastAPI เท่านั้น — ห้าม connect MySQL โดยตรงจาก Render

---

## 🏪 7 Brands & Ticket Prefix

| # | Brand | Prefix | ตัวอย่าง Ticket ID |
|---|-------|--------|-------------------|
| 1 | Dunkin' | GD | GD-00001 |
| 2 | Greyhound Cafe' | GHC | GHC-00001 |
| 3 | Greyhound Original | GH | GH-00001 |
| 4 | Au Bon Pain | ABP | ABP-00001 |
| 5 | Funky Fries | FF | FF-00001 |
| 6 | Another Hound Cafe' | AHC | AHC-00001 |
| 7 | Bean Hound | BE | BE-00001 |

---

## 🌐 URL ทั้งหมด

| หน้า | สำหรับ | URL | สิทธิ์ |
|------|--------|-----|--------|
| Admin | ผู้ดูแลระบบ | /admin | 🔐 Login |
| Engineer | ช่างเทคนิค | /engineer | 🔐 Login |
| Report | ทุกแบรนด์ | /report | 🌍 Public |

---

## 👥 Role Hierarchy & Permissions

| Role | Admin Panel | Engineer Portal | ดู Ticket | แก้ไข Ticket | จัดการ Users | GPS Map | รหัสผ่าน |
|------|-------------|-----------------|-----------|---------------|---------------|---------|----------|
| superadmin | ✓ | ✓ | ทั้งหมด | ✓ | ✓ | ✓ | ✓ |
| manager | ✓ | ✓ | ทั้งหมด | ✓ | ✓ | ✓ | ✗ ดูอย่างเดียว |
| admin | ✓ | ✗ | ทั้งหมด | ✓ | ดู+แก้ไข | ดูเท่านั้น | ✗ |
| lead_engineer | ✗ | ✓ | ทั้งหมด | ✓ รับงานใครก็ได้ | ✗ | ✗ ซ่อน | ✗ |
| engineer | ✗ | ✓ | เฉพาะงานตัวเอง | ✓ | ✗ | ✗ ซ่อน | ✗ |
| guest | ดูเท่านั้น | ดูเท่านั้น | ทั้งหมด | ✗ ปุ่ม lock | ✗ | ดูเท่านั้น | ✗ |

---

## 🔧 งานที่ต้องแก้ไข — 18 รายการ

### admin.html (8 รายการ)

#### A1 — GPS Map: User ที่ลบแล้วยังค้างอยู่
- **ปัญหา:** บัญชีที่ถูกลบออกจากระบบยังแสดง marker บนแผนที่ GPS
- **แก้:** sync รายชื่อ engineer กับ active users ก่อน render marker
- **เงื่อนไข:** ถ้า user ถูก delete หรือ inactive → ต้องไม่แสดงบนแผนที่

#### A2 — System Settings: เอา LINE Config ออก
- **ปัญหา:** LINE Config section ใน System Settings ไม่มีประโยชน์ในการใช้งานจริง
- **แก้:** ลบ LINE Config section ออกจากหน้า System Settings ทั้งหมด

#### A3 — System Settings: เอา Dark Mode Toggle ออก
- **ปัญหา:** มี Dark Mode toggle ซ้ำกัน — มีอยู่ที่ sidebar ซ้ายล่างแล้ว
- **แก้:** ลบ Dark Mode toggle ออกจาก System Settings (คงไว้แค่ที่ sidebar)

#### A4 — Notification Bell: ลอยทับทุกอย่าง
- **ปัญหา:** Bell ถูกบังโดย GPS Map และ element อื่น
- **แก้:** เปลี่ยนเป็น `position: fixed` + `z-index` สูงสุด ให้ลอยทับทุก element ทุกหน้า

#### A5 — Sidebar: เอาปุ่ม คู่มือ/Role ออก
- **ปัญหา:** ปุ่ม "คู่มือ / Role" แสดงอยู่ที่ sidebar ซ้ายล่าง ซ้ำกับปุ่มในหน้า Users
- **แก้:** ลบออกจาก sidebar — คงไว้แค่ปุ่ม **📖 คู่มือ Role** ในหน้า Users เท่านั้น

#### A6 — Server Logs: เพิ่ม Date Range Filter
- **ปัญหา:** ดู log ได้แค่ล่าสุด ไม่สามารถเลือกช่วงวันที่ได้
- **แก้:** เพิ่ม date picker "จากวันที่" และ "ถึงวันที่" filter log จาก DB ตามช่วงเวลาที่เลือก
- **Data source:** Activity Log จาก MySQL ผ่าน FastAPI

#### A7 — เพิ่มปุ่มสลับภาษา TH/EN
- **ปัญหา:** ไม่มีปุ่มสลับภาษาไทย/อังกฤษ
- **แก้:** เพิ่มปุ่ม **TH / EN** ใน topbar สลับ label ทุก element ในหน้า

#### A8 — Branches Map: นำทางด้วย Google Maps
- **ปัญหา:** กดปุ่ม Map ในหน้า Branches แล้วไปหน้า GPS Map ของช่าง ซึ่งไม่ถูกต้อง
- **ต้องการ:** กดแล้วดูตำแหน่งสาขาได้ + กดเริ่มนำทางจาก GPS ปัจจุบันไปยังสาขาได้
- **แก้:** เปิด Google Maps ใน tab ใหม่พร้อม navigation mode
```
https://www.google.com/maps/dir/?api=1
  &origin=[lat_ปัจจุบัน],[lng_ปัจจุบัน]
  &destination=[lat_สาขา],[lng_สาขา]
  &travelmode=driving
```
- ถ้าไม่มี GPS ปัจจุบัน → เปิดแค่ตำแหน่งสาขา (no origin)

---

### report.html (1 รายการ)

#### R1 — แก้ Ticket Prefix ผิด
- **ปัญหา:** แบรนด์บางแบรนด์ใช้ prefix "TK" แทนที่จะเป็น code ของแบรนด์
- **แก้:** แก้ mapping ให้ถูกต้องตามตารางด้านบน
  - Bean Hound → `BE`
  - Another Hound Cafe' → `AHC`
  - Greyhound Original → `GH`
  - Greyhound Cafe' → `GHC`
  - Au Bon Pain → `ABP`
  - Funky Fries → `FF`
  - Dunkin' → `GD`

---

### engineer.html (6 รายการ)

#### E1 — เพิ่ม Tab "งานตรวจ"
- **ปัญหา:** ไม่มี tab แสดงงานที่อยู่ใน status "ตรวจงาน"
- **แก้:** เพิ่ม tab **"งานตรวจ"** แสดง tickets ที่ status = `ตรวจงาน`

#### E2 — แก้ Stats 4 ช่อง ให้อ้างอิงจาก Status จริง
- **ปัญหา:** ตัวเลข stats ด้านบนไม่ชัดเจนว่าอ้างอิงจากอะไร
- **แก้:** แสดงตามนี้

| ช่อง | Status ที่นับ |
|------|--------------|
| งานที่รับ | `อยู่ระหว่างดำเนินการ ⚙️` |
| งานตรวจ | `ตรวจงาน` |
| งานเสร็จแล้ว | `เสร็จสิ้น ✅` |
| ทั้งหมด | รวมทุก status ที่ assign ให้ช่างคนนี้ |

#### E3 — ประวัติ: ดึงจาก DB ตามชื่อ Engineer
- **ปัญหา:** ประวัติการทำงานไม่ได้ดึงจาก DB จริง
- **แก้:** Query tickets จาก MySQL โดย filter `assigned_to` หรือ `engineer_name` ตรงกับ username ของช่างที่ login อยู่
- **Data source:** MySQL ผ่าน FastAPI

#### E4 — ค้นหาประวัติด้วย Date Range
- **ปัญหา:** ค้นหาประวัติได้แค่ดูทั้งหมด ไม่สามารถกรองวันที่ได้
- **แก้:** เพิ่มช่อง **"จากวันที่"** และ **"ถึงวันที่"** ใน tab ประวัติ filter ตาม `sentDate` หรือ `completedAt`

#### E5 — เพิ่มปุ่มสลับภาษา TH/EN
- **ปัญหา:** ไม่มีปุ่มสลับภาษาไทย/อังกฤษ
- **แก้:** เพิ่มปุ่ม **TH / EN** ใน topbar เหมือน admin.html

#### E6 — Bottom Bar ต้องเหมือน Admin.html
- **ปัญหา:** Bottom bar (Dark / Home / Logout) มี design ต่างจาก Admin
- **แก้:** ซิงค์ design, font, สี, spacing ให้ตรงกับ admin.html

---

## 📐 Design System

```
Font: 'Prompt', sans-serif (Google Fonts)
Weights: 300, 400, 500, 600, 700, 800

CSS Variables:
--bg        : #f5f5f5  (page background)
--bg2       : #ffffff  (inputs/fields)
--card      : #ffffff  (cards)
--border    : #e8e8e8
--fg        : #0a0a0a
--fg2       : #3a3a38
--fg3       : #7a7a75
--fg4       : #a8a8a2

Dark Mode via [data-t="dark"]:
--bg: #0a0a0a, --card: #141413, etc.
```

---

## 🔄 Ticket Status Flow

```
รอดำเนินการ ⏱️
    ↓
อยู่ระหว่างดำเนินการ ⚙️
    ↓
ตรวจงาน
    ↓
เสร็จสิ้น ✅
    
(หรือ) ยกเลิก ❌
```

---

## ⚙️ API Reference

### Node.js Endpoints (Render)
```
GET  /api/tickets              — list all tickets
POST /api/tickets              — create ticket
PATCH /api/tickets/:rid/status — update status
PATCH /api/tickets/:rid/assign — assign engineer
PATCH /api/tickets/:rid/close  — close ticket
GET  /api/branches             — branches (nested by brand, cached 5min)
PATCH /api/branches/:id        — update branch location
GET  /api/logs                 — activity log
GET  /api/users                — user list
POST /api/users                — create user
PATCH /api/users/:id           — update user
DELETE /api/users/:id          — delete user
GET  /api/events               — SSE stream
```

### FastAPI Endpoints (repair.mobile1234.site)
```
GET  /api/branches             — flat array of all branches
PATCH /api/branches/{id}       — update branch + location
GET  /api/notifications        — params: role, username
```

---

## 🗄️ Database

```
Host     : 10.8.1.88:3306
Database : it_ticket
Access   : ผ่าน FastAPI เท่านั้น (X-API-Key: repair123)
```

### Key Tables
| Table | ข้อมูล |
|-------|--------|
| branches | 1,118+ สาขา พร้อม lat/lng |
| notifications | การแจ้งเตือน |
| activity_log | log การทำงาน (A6 ใช้ที่นี่) |

---

## 🚀 Deploy Process

```
1. แก้ไขโค้ดใน /home/claude/repo/
2. git add [files]
3. git commit -m "message"
4. git push origin main
5. Render Dashboard → Manual Deploy → Deploy latest commit
6. รอ ~2-3 นาที
```

> ⚠️ Render free tier: cold start ~50s / Memory limit 400MB / Keep-alive ping ทุก 10 นาที

---

## ✅ Checklist งานที่ทำเสร็จแล้ว

- [x] admin.html — Branches page พร้อม table, filter, pagination
- [x] admin.html — `renderBranches` เพิ่มเข้า render map แล้ว
- [x] admin.html — Users page: ปุ่ม 📖 คู่มือ Role + Modal card scroll
- [x] admin.html — Delete user: popup ยืนยัน + ปุ่มสีแดง
- [x] itsupport-landing.html — Mobile fixes (scroll, card size, particle)
- [x] Brand cards 7 แบรนด์ (report + landing)
- [x] Import lat/lng 1,118 สาขาเข้า MySQL

## ⏳ Checklist งานที่ยังต้องทำ (Session นี้)

- [ ] A1 — GPS Map sync active users
- [ ] A2 — เอา LINE Config ออก
- [ ] A3 — เอา Dark Mode toggle ออกจาก System
- [ ] A4 — Bell position:fixed z-index สูงสุด
- [ ] A5 — เอาปุ่มคู่มือออกจาก sidebar
- [ ] A6 — Server Logs date range filter
- [ ] A7 — TH/EN toggle ใน admin.html
- [ ] A8 — Branches Map → Google Maps navigation
- [ ] R1 — แก้ Ticket prefix ใน report.html
- [ ] E1 — เพิ่ม tab งานตรวจ
- [ ] E2 — แก้ Stats 4 ช่อง
- [ ] E3 — ประวัติดึงจาก DB
- [ ] E4 — Date range filter ประวัติ
- [ ] E5 — TH/EN toggle ใน engineer.html
- [ ] E6 — Bottom bar sync กับ admin.html
