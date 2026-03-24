---
name: it-support-system
description: |
  Project context skill for the IT Support Ticket System. Use this skill whenever the user mentions
  report.html, admin.html, engineer.html, app.js, repair_api.py, FastAPI, branches, tickets,
  Lark, LINE notify, Render deploy, or any work related to this IT Support project.
  Contains full stack info, API endpoints, file paths, conventions, design rules, and pending tasks.
  Always consult this skill before writing any code, editing any file, or answering questions
  about this project — even if the request seems simple.
---

# IT Support Ticket System — Project Skill

## Stack Overview

| Layer | Tech | URL / Location |
|---|---|---|
| Frontend | HTML/CSS/JS (no framework) | Served by Node.js |
| Backend | Node.js (Express) | https://it-service-56im.onrender.com |
| FastAPI | Python (MySQL bridge) | http://repair.mobile1234.site (nginx → port 8000) |
| Database | MySQL 10.8.1.88 | database: `it_ticket` |
| Ticket DB | Lark Base | via larkService.js |
| Notifications | LINE Messaging API | via lineNotify.js |
| Deploy | Render.com + GitHub | repo: itsservice/it_service, branch: main |

---

## Server Paths

```
FastAPI server:   /opt/repair_api/repair_api.py
FastAPI venv:     /opt/repair_api/venv/bin/uvicorn
FastAPI restart:  sudo fuser -k 8000/tcp && sleep 2 && cd /opt/repair_api && nohup sudo /opt/repair_api/venv/bin/uvicorn repair_api:app --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &
FastAPI log:      tail -f /tmp/api.log
```

---

## Environment Variables (Render)

```
REPAIR_API_URL=http://repair.mobile1234.site
REPAIR_API_KEY=repair123
LINE_CHANNEL_ACCESS_TOKEN=(set in Render dashboard)
LINE_CHANNEL_SECRET=adb0c832bf0c7e691b0e698b7a0d5667
LINE_ADMIN_GROUP_ID=(set in Render dashboard)
LARK_APP_ID, LARK_APP_SECRET, LARK_APP_TOKEN
LARK_TABLE_DUNKIN, LARK_TABLE_GREYHOUND_CAFE, etc.
APP_URL=https://it-service-56im.onrender.com
PWD_SALT=it-ticket-salt-2025
```

---

## Key Files

```
server.js          — Entry point, keep-alive ping, graceful shutdown
app.js             — All Express routes, SSE, /api/* endpoints
auth.js            — Session management, requireAuth middleware, activity log
users.js           — In-memory user store, role definitions
larkService.js     — Lark Base API, field detection, ticket CRUD
larkWebhook.js     — Lark → LINE notifications
lineWebhook.js     — LINE bot webhook (!groupid, !userid commands)
lineNotify.js      — LINE push message helper
lineConfig.js      — LINE headers/config
repair_api.py      — FastAPI: branches CRUD, notifications, MySQL bridge
report.html        — Public: submit ticket + track status
admin.html         — Admin dashboard: tickets, analytics, users, debug
engineer.html      — Engineer portal: view/update assigned tickets
itsupport-landing.html — Landing page
portal.html/.js/.css   — Brand selector portal
```

---

## Brands

| Brand | Prefix | Env Table Key |
|---|---|---|
| Dunkin' | GD | LARK_TABLE_DUNKIN |
| Greyhound Cafe | GH | LARK_TABLE_GREYHOUND_CAFE |
| Greyhound Original | GO | LARK_TABLE_GREYHOUND_ORIGINAL |
| Au Bon Pain | ABP | LARK_TABLE_AU_BON_PAIN |
| Funky Fries | FF | LARK_TABLE_FUNKY_FRIES |

---

## Role Hierarchy

```
superadmin > manager > admin > lead_engineer > engineer > guest
```

User accounts are in-memory in `users.js`. Passwords hashed with SHA-256 + PWD_SALT.

---

## API Endpoints (Node.js)

```
GET  /api/tickets              — list all tickets (auth optional, engineer sees own brand)
GET  /api/tickets/:rid         — single ticket by recordId
POST /api/tickets              — create ticket (public)
PATCH /api/tickets/:rid/status — update status (auth required)
PATCH /api/tickets/:rid/assign — assign engineer (admin+)
PATCH /api/tickets/:rid/engineer — engineer submit work
PATCH /api/tickets/:rid/close  — close ticket (admin+)
PATCH /api/tickets/:rid        — generic update (admin+)
GET  /api/branches             — branches from MySQL via FastAPI (cached 5 min)
GET  /api/logs                 — activity log (admin+)
GET  /api/users                — user list (admin+)
POST /api/users                — create user
PATCH /api/users/:id           — update user
DELETE /api/users/:id          — delete user (superadmin)
POST /api/auth/login           — login → returns Bearer token
POST /api/auth/logout          — logout
GET  /api/auth/me              — get current user
GET  /api/events               — SSE stream (ticket_created, ticket_updated)
GET  /health                   — health check
GET  /debug/env                — env var status
GET  /debug/lark-fields        — Lark field mapping debug
GET  /debug/tables             — Lark table status
GET  /debug/rebuild-fieldmap   — force rebuild field map
```

---

## FastAPI Endpoints (repair_api.py)

```
GET  /api/branches             — flat array, params: brand, status
POST /api/branches             — add branch (superadmin→active, others→pending)
PATCH /api/branches/{id}       — update branch + location
POST /api/branches/{id}/approve
POST /api/branches/{id}/reject
GET  /api/notifications        — params: role, username
GET  /api/notifications/unread-count
PATCH /api/notifications/{id}/read
PATCH /api/notifications/read-all
```

Branch object shape:
```json
{
  "id": 1,
  "brand": "Dunkin'",
  "code": "K.0001",
  "nameTh": "ครัวพระรามสาม",
  "nameEn": "Kitchen Rama 3",
  "ip": "172.23.33.2",
  "phone": "659407970",
  "location_lat": null,
  "location_lng": null,
  "location_name": "",
  "status": "active"
}
```

/api/branches from Node.js returns **nested by brand**:
```json
{ "ok": true, "branches": { "Dunkin'": [...], "Greyhound Cafe": [...] } }
```

---

## Database (MySQL)

```
Host: 10.8.1.88
Database: it_ticket
API Key header: X-API-Key: repair123
```

Key tables: `branches` (1,118 rows), `notifications`

Branches were imported from IP_Shop_1.xlsx:
- GD sheet → Dunkin' (926 branches)
- ABP → Au Bon Pain (116)
- Funky Fries → Funky Fries (40)
- GHC → Greyhound Cafe (36)

---

## Design System (HTML files)

**CRITICAL: Never change design unless explicitly asked.**

### report.html Design
- **Fonts:** Syne (display/headings), Sarabun (body), IBM Plex Mono (code/ID)
- **Theme:** CSS variables, light default + `[data-t="dark"]` for dark mode
- **Light mode colors:**
  - `--bg: #f5f5f5` (page background — light gray)
  - `--bg2: #ffffff` (inputs, fields — white)
  - `--bg3: #f4f4f4` (secondary bg)
  - `--card: #ffffff` (cards — white)
  - `--border: #e8e8e8`
- **Dark mode:** `[data-t="dark"]` with `--bg:#0a0a0a` etc.
- **Animation:** `@keyframes up` — fade + translateY
- **Card style:** `border-radius:12px`, `border:1px solid var(--border)`
- **Topbar:** sticky, `font-weight:800`, monospace clock, `.smb` buttons

### admin.html Design
- Similar dark-first design
- Uses Chart.js for analytics
- Sidebar navigation on desktop, bottom nav on mobile

### Do NOT change:
- Font families (Syne/Sarabun/IBM Plex Mono)
- Color variable names
- Card/border-radius/animation patterns
- Layout structure
- Dark mode logic

---

## report.html — Completed Features

1. ✅ Brand picker (card grid)
2. ✅ Branch picker — bottom sheet modal, searches from `/api/branches`
3. ✅ GPS consent popup — custom (not browser native)
   - If branch has `location_lat/lng` in DB → use silently, no popup
   - If no DB location → show popup with Allow/Deny
   - GPS coords appended to `location` field: `[GPS:lat,lng]` or `[DB:lat,lng]`
4. ✅ Bilingual TH/EN — button in topbar, all labels switch
5. ✅ LINE User ID field — **REMOVED**
6. ✅ Categories (Thai): งานระบบไฟฟ้า, ประปา, เครื่องทำกาแฟ, etc.
7. ✅ Track tab — search by ticket ID

---

## Pending Tasks

### 1. admin.html — Branches Page
- Add "สาขา" nav item in sidebar
- Table view of all branches, filterable by brand
- Edit modal: superadmin can edit `location_lat`, `location_lng`, `location_name` directly → PATCH `/api/branches/:id`
- Other roles → submit change → pending approval flow
- Approve/reject buttons for superadmin

### 2. report.html — Light Mode Polish
Apply these color values to `:root` (light mode only):
```css
--bg: #f5f5f5;      /* page background */
--bg2: #ffffff;     /* inputs/fields */
--bg3: #f4f4f4;
--bg4: #eeeeee;
--border: #e8e8e8;
--border2: #d4d4d4;
--card: #ffffff;
```

---

## Lark Field Mapping

`larkService.js` uses keyword detection. Key internal keys:
`id, status, brand, branchCode, sla, reporter, phone, type, detail, location, sentDate, line_user_id, line_group_id, assignedTo, workDetail, partsUsed, workHours, completedAt, engineerName, adminNote, closedAt, closedBy`

Status values (with emoji):
- `รอดำเนินการ ⏱️` — waiting
- `อยู่ระหว่างดำเนินการ ⚙️` — in progress
- `ตรวจงาน` — review
- `เสร็จสิ้น ✅` — done
- `ยกเลิก ❌` — cancelled

---

## Coding Conventions

- No frameworks — vanilla JS, fetch API
- `esc(s)` function for HTML escaping always used before innerHTML
- SSE via `/api/events` for real-time updates
- Bearer token auth stored in `localStorage` (`admin_auth`, `eng_auth`)
- All API calls have 10-15s timeout via AbortController
- Render free tier: keep-alive ping every 10 min (06:00–23:00 Thai time)
- Memory watchdog: exit if heap > 400MB (Render auto-restarts)
- `larkService.js` has circuit breaker after 5 failures, resets after 1 min

---

## Common Issues & Fixes

| Issue | Fix |
|---|---|
| Lark fields not mapping | GET /debug/rebuild-fieldmap |
| Branches not loading | Check REPAIR_API_URL env var, restart FastAPI |
| FastAPI "Unread result found" | Add `cursor.fetchall()` after SELECT with no results |
| Render cold start slow | Normal — free tier sleeps, takes ~50s to wake |
| /api/branches returns empty | Check MySQL connection 10.8.1.88, branchCache brand key mismatch |
