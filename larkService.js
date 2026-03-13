// larkService.js — Proxy to FastAPI (MySQL) แทน Lark Base
// Render.com → FastAPI (repair.mobile1234.site) → MySQL (10.8.1.88)

const axios = require('axios');

const API_BASE = process.env.FASTAPI_URL || 'https://repair.mobile1234.site';
const API_KEY  = process.env.API_KEY      || 'repair123';

const headers = { 'X-API-Key': API_KEY };

// ── Cache ──────────────────────────────────────────────────────
let _cache = null;
let _cacheExp = 0;

function invalidateCache() {
  _cache = null;
  _cacheExp = 0;
}

// ── Map FastAPI ticket → format เดิมที่ frontend ใช้ ──────────
function mapTicket(t) {
  return {
    _recordId:    String(t.id),
    id:           t.ticket_id,
    status:       mapStatus(t.status),
    brand:        t.brand        || '',
    branchCode:   t.branch_code  || '',
    reporter:     t.reporter     || '',
    phone:        t.phone        || '',
    type:         t.type         || '',
    detail:       t.detail       || '',
    location:     t.location     || '',
    sentDate:     t.sent_date    || '',
    slaDate:      t.sla_date     || '',
    assignedTo:   t.assigned_to  || '',
    engineerName: t.engineer_name|| '',
    workDetail:   t.work_detail  || '',
    partsUsed:    t.parts_used   || '',
    workHours:    t.work_hours   || '',
    lineUserId:   t.line_user_id || '',
    createdAt:    t.created_at   || '',
  };
}

// Map status MySQL → แสดงผล
function mapStatus(s) {
  const map = {
    'pending':      'รอดำเนินการ ⏱️',
    'in_progress':  'อยู่ระหว่างดำเนินการ ⚙️',
    'review':       'ตรวจงาน',
    'done':         'เสร็จสิ้น ✅',
    'cancelled':    'ยกเลิก',
  };
  return map[s] || s || 'รอดำเนินการ ⏱️';
}

// Map status แสดงผล → MySQL
function mapStatusReverse(s) {
  if (!s) return 'pending';
  if (s.includes('รอดำเนินการ'))         return 'pending';
  if (s.includes('อยู่ระหว่างดำเนินการ')) return 'in_progress';
  if (s.includes('ตรวจงาน'))             return 'review';
  if (s.includes('เสร็จสิ้น'))           return 'done';
  if (s.includes('ยกเลิก'))              return 'cancelled';
  return s;
}

// ── listTickets ────────────────────────────────────────────────
async function listTickets(opts = {}) {
  if (_cache && Date.now() < _cacheExp && !opts?.noCache) {
    return _cache;
  }
  try {
    const r = await axios.get(`${API_BASE}/api/tickets`, {
      headers,
      params: { limit: 200 },
      timeout: 15000,
    });
    const tickets = (r.data.tickets || []).map(mapTicket);
    _cache = tickets;
    _cacheExp = Date.now() + 30_000; // cache 30s
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
      headers,
      timeout: 10000,
    });
    return mapTicket(r.data);
  } catch(e) {
    console.error('[larkService] getTicket error:', e.message);
    throw e;
  }
}

// ── createTicket ───────────────────────────────────────────────
async function createTicket(data) {
  try {
    const payload = {
      brand:       data.brand,
      branch_code: data.branchCode || '',
      reporter:    data.reporter,
      phone:       data.phone,
      type:        data.type || '',
      detail:      data.detail,
      location:    data.location || '',
      line_user_id:data.lineUserId || null,
    };
    const r = await axios.post(`${API_BASE}/api/tickets`, payload, {
      headers,
      timeout: 10000,
    });
    invalidateCache();
    // ดึง ticket ที่สร้างใหม่มาแสดง
    const tickets = await listTickets({ noCache: true });
    const newTicket = tickets.find(t => t.id === r.data.ticket_id);
    return newTicket || { _recordId: String(r.data.id), id: r.data.ticket_id, ...data };
  } catch(e) {
    console.error('[larkService] createTicket error:', e.message);
    throw e;
  }
}

// ── updateTicket ───────────────────────────────────────────────
async function updateTicket(recordId, data) {
  try {
    const payload = {};
    if (data.status)       payload.status        = mapStatusReverse(data.status);
    if (data.engineerName) payload.engineer_name = data.engineerName;
    if (data.assignedTo)   payload.assigned_to   = data.assignedTo;
    if (data.workDetail)   payload.work_detail   = data.workDetail;
    if (data.partsUsed)    payload.parts_used    = data.partsUsed;
    if (data.workHours)    payload.work_hours    = parseFloat(data.workHours) || null;
    if (data.slaDate)      payload.sla_date      = data.slaDate;

    await axios.patch(`${API_BASE}/api/tickets/${recordId}`, payload, {
      headers,
      timeout: 10000,
    });
    invalidateCache();
    return await getTicket(recordId);
  } catch(e) {
    console.error('[larkService] updateTicket error:', e.message);
    throw e;
  }
}

// ── getToken (ไม่ใช้แล้ว แต่ export ไว้กัน error) ─────────────
async function getToken() {
  return 'not-used';
}

// ── ensureFieldMap / debugSchema (ไม่ใช้แล้ว) ─────────────────
async function ensureFieldMap(force = false) {
  return true;
}

async function debugSchema() {
  return { fieldMap: {}, schema: [] };
}

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  invalidateCache,
  getToken,
  ensureFieldMap,
  debugSchema,
};
