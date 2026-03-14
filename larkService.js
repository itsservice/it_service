// larkService.js — Proxy to FastAPI (MySQL) แทน Lark Base
// Render.com → FastAPI (repair.mobile1234.site) → MySQL (10.8.1.88)
// FastAPI PATCH fields: status, assigned_to, engineer_name, work_detail, parts_used, work_hours

const axios = require('axios');

const API_BASE = process.env.FASTAPI_URL || 'https://repair.mobile1234.site';
const API_KEY  = process.env.API_KEY      || 'repair123';
const headers  = { 'X-API-Key': API_KEY };

// ── Cache ──────────────────────────────────────────────────────
let _cache = null;
let _cacheExp = 0;

function invalidateCache() { _cache = null; _cacheExp = 0; }

// ── mapTicket: FastAPI → frontend format ──────────────────────
function mapTicket(t) {
  return {
    _recordId:    t.ticket_id,
    id:           t.ticket_id,
    status:       mapStatus(t.status),
    brand:        t.brand         || '',
    branchCode:   t.branch_code   || '',
    reporter:     t.reporter      || '',
    phone:        t.phone         || '',
    type:         t.type          || '',
    detail:       t.detail        || '',
    location:     t.location      || '',
    sentDate:     t.sent_date     || '',
    slaDate:      t.sla_date      || '',
    assignedTo:   t.assigned_to   || '',
    engineerName: t.engineer_name || '',
    workDetail:   t.work_detail   || '',
    partsUsed:    t.parts_used    || '',
    workHours:    t.work_hours    || '',
    lineUserId:   t.line_user_id  || '',
    createdAt:    t.created_at    || '',
    sla:          t.sla           || '',
    // fields ที่ FastAPI ไม่มี — เก็บ local
    adminNote:    t.admin_note    || '',
    closedAt:     t.closed_at     || '',
    closedBy:     t.closed_by     || '',
    completedAt:  t.completed_at  || '',
  };
}

// Map status MySQL/English → Thai display
function mapStatus(s) {
  if (!s) return 'รอดำเนินการ ⏱️';
  const map = {
    'pending':     'รอดำเนินการ ⏱️',
    'in_progress': 'อยู่ระหว่างดำเนินการ ⚙️',
    'review':      'ตรวจงาน',
    'done':        'เสร็จสิ้น ✅',
    'cancelled':   'ยกเลิก ❌',
  };
  if (map[s]) return map[s];
  // Thai string ที่อาจมี emoji แล้ว — normalize
  if (s.includes('รอดำเนินการ'))          return 'รอดำเนินการ ⏱️';
  if (s.includes('อยู่ระหว่างดำเนินการ')) return 'อยู่ระหว่างดำเนินการ ⚙️';
  if (s.includes('ตรวจงาน'))              return 'ตรวจงาน';
  if (s.includes('เสร็จสิ้น'))            return 'เสร็จสิ้น ✅';
  if (s.includes('ยกเลิก'))               return 'ยกเลิก ❌';
  return s;
}

// Map status Thai → MySQL English
function mapStatusReverse(s) {
  if (!s) return 'pending';
  if (s.includes('รอดำเนินการ'))          return 'pending';
  if (s.includes('อยู่ระหว่างดำเนินการ')) return 'in_progress';
  if (s.includes('ตรวจงาน'))              return 'review';
  if (s.includes('เสร็จสิ้น'))            return 'done';
  if (s.includes('ยกเลิก'))               return 'cancelled';
  return 'pending';
}

// ── listTickets ────────────────────────────────────────────────
async function listTickets(opts = {}) {
  if (_cache && Date.now() < _cacheExp && !opts?.noCache) return _cache;
  try {
    const r = await axios.get(`${API_BASE}/api/tickets`, {
      headers,
      params: { limit: 500 },
      timeout: 15000,
    });
    const tickets = (r.data.tickets || []).map(mapTicket);
    _cache = tickets;
    _cacheExp = Date.now() + 30_000;
    return tickets;
  } catch(e) {
    console.error('[larkService] listTickets error:', e.message);
    return _cache || [];
  }
}

// ── getTicket ──────────────────────────────────────────────────
async function getTicket(recordId) {
  try {
    const r = await axios.get(`${API_BASE}/api/tickets/${recordId}`, {
      headers, timeout: 10000,
    });
    return mapTicket(r.data);
  } catch(e) {
    console.error('[larkService] getTicket error:', e.message);
    // fallback: ค้นหาจาก cache
    if (_cache) {
      const t = _cache.find(x => x._recordId === recordId || x.id === recordId);
      if (t) return t;
    }
    throw e;
  }
}

// ── createTicket ───────────────────────────────────────────────
async function createTicket(data) {
  try {
    const payload = {
      brand:        data.brand,
      branch_code:  data.branchCode || '',
      reporter:     data.reporter,
      phone:        data.phone,
      type:         data.type || '',
      detail:       data.detail,
      location:     data.location || '',
      line_user_id: data.lineUserId || null,
    };
    const r = await axios.post(`${API_BASE}/api/tickets`, payload, {
      headers, timeout: 10000,
    });
    invalidateCache();
    const tickets = await listTickets({ noCache: true });
    const newTicket = tickets.find(t => t.id === r.data.ticket_id);
    return newTicket || { _recordId: r.data.ticket_id, id: r.data.ticket_id, ...data };
  } catch(e) {
    console.error('[larkService] createTicket error:', e.message);
    throw e;
  }
}

// ── updateTicket ───────────────────────────────────────────────
// FastAPI PATCH รับ: status, assigned_to, engineer_name, work_detail, parts_used, work_hours
// fields อื่น (adminNote, closedBy, completedAt) — ไม่มีใน schema ปล่อยผ่าน
async function updateTicket(recordId, data) {
  try {
    const payload = {};

    // fields ที่ FastAPI รองรับ
    if (data.status !== undefined)
      payload.status = mapStatusReverse(data.status);
    if (data.engineerName !== undefined)
      payload.engineer_name = data.engineerName;
    if (data.assignedTo !== undefined)
      payload.assigned_to = data.assignedTo;
    if (data.workDetail !== undefined)
      payload.work_detail = data.workDetail;
    if (data.partsUsed !== undefined)
      payload.parts_used = data.partsUsed;
    if (data.workHours !== undefined && data.workHours !== '')
      payload.work_hours = parseFloat(data.workHours) || null;

    if (Object.keys(payload).length === 0) {
      console.warn('[larkService] updateTicket: no supported fields to update');
      // คืน ticket จาก cache แทน
      if (_cache) {
        const t = _cache.find(x => x._recordId === recordId);
        if (t) return t;
      }
      return await getTicket(recordId);
    }

    await axios.patch(`${API_BASE}/api/tickets/${recordId}`, payload, {
      headers, timeout: 10000,
    });
    invalidateCache();
    return await getTicket(recordId);
  } catch(e) {
    console.error('[larkService] updateTicket error:', e.message);
    throw e;
  }
}

// ── stubs (ไม่ใช้แล้วแต่ export ไว้กัน error) ──────────────
async function getToken() { return 'not-used'; }
async function ensureFieldMap() { return true; }
async function debugSchema() { return { fieldMap: {}, schema: [] }; }

module.exports = {
  listTickets, getTicket, createTicket, updateTicket,
  invalidateCache, getToken, ensureFieldMap, debugSchema,
};
