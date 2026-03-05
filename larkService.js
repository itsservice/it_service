// larkService.js — Lark Base API client
const axios = require('axios');
const BASE_URL = 'https://open.larksuite.com/open-apis';

let _token = null, _tokenExp = 0;

async function getTenantToken() {
  if (_token && Date.now() < _tokenExp - 60_000) return _token;
  const r = await axios.post(
    `${BASE_URL}/auth/v3/tenant_access_token/internal`,
    { app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET },
    { timeout: 10_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark auth error: ${r.data.msg}`);
  _token = r.data.tenant_access_token;
  _tokenExp = Date.now() + r.data.expire * 1000;
  return _token;
}

function larkHeaders(t) {
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

// *** ปรับ Column name ให้ตรงกับ Lark Base ***
const FIELD_MAP = {
  'Ticket ID':     'id',
  'Status':        'status',
  'Brand':         'brand',
  'Branch Code':   'branchCode',
  'SLA':           'sla',
  'Reporter':      'reporter',
  'Phone':         'phone',
  'Type':          'type',
  'Detail':        'detail',
  'Location':      'location',
  'Sent Date':     'sentDate',
  'SLA Date':      'slaDate',
  'Created At':    'createdAt',
  'LINE User ID':  'line_user_id',
  'LINE Group ID': 'line_group_id',
  'Record URL':    'recordUrl',
  'Work Detail':   'workDetail',
  'Parts Used':    'partsUsed',
  'Work Hours':    'workHours',
  'Completed At':  'completedAt',
  'Engineer Name': 'engineerName',
  'Admin Note':    'adminNote',
  'Closed At':     'closedAt',
  'Closed By':     'closedBy',
};

const WRITABLE = new Set([
  'Status','Brand','Branch Code','SLA','Reporter','Phone','Type','Detail','Location','Sent Date',
  'LINE User ID','LINE Group ID',
  'Work Detail','Parts Used','Work Hours','Completed At','Engineer Name',
  'Admin Note','Closed At','Closed By',
]);

const REVERSE_MAP = Object.fromEntries(Object.entries(FIELD_MAP).map(([k,v])=>[v,k]));

// FIX: แปลง Unix ms → วันที่ไทย
function fmtDate(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = typeof val === 'number' ? val : Number(val);
  if (!isNaN(n) && n > 1_000_000_000_000) {
    return new Date(n).toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  if (typeof val === 'string' && (val.includes('T') || /^\d{4}-/.test(val))) {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  return String(val);
}

const DATE_KEYS = new Set(['sentDate','slaDate','createdAt','completedAt','closedAt']);

function parseValue(val, key) {
  if (Array.isArray(val) && val.length > 0 && val[0]?.text !== undefined)
    return val.map(v => v.text || '').join('');
  if (val && typeof val === 'object' && !Array.isArray(val) && val.text !== undefined)
    return val.text;
  if (DATE_KEYS.has(key)) return fmtDate(val);
  return val;
}

function parseRecord(record) {
  const out = { _recordId: record.record_id };
  for (const [lk, val] of Object.entries(record.fields || {})) {
    const key = FIELD_MAP[lk] || lk;
    out[key] = parseValue(val, key);
  }
  if (!out.id) out.id = record.record_id;
  return out;
}

// FIX WrongRequestBody: กรองเฉพาะ WRITABLE + val ที่มีค่า
function toWriteFields(fields) {
  const out = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === null || val === '') continue;
    const lk = REVERSE_MAP[key] || key;
    if (WRITABLE.has(lk)) out[lk] = val;
    else console.warn(`[Lark] skip non-writable: ${key} -> ${lk}`);
  }
  return out;
}

async function listTickets() {
  const token = await getTenantToken();
  let all = [], pt;
  do {
    const params = { page_size: 100 };
    if (pt) params.page_token = pt;
    const r = await axios.get(
      `${BASE_URL}/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/records`,
      { headers: larkHeaders(token), params, timeout: 15_000 }
    );
    if (r.data.code !== 0) throw new Error(`Lark list error: ${r.data.msg}`);
    all = all.concat((r.data.data?.items || []).map(parseRecord));
    pt = r.data.data?.has_more ? r.data.data.page_token : undefined;
  } while (pt);
  return all;
}

async function updateTicketField(recordId, fields) {
  const token = await getTenantToken();
  const larkFields = toWriteFields(fields);
  if (!Object.keys(larkFields).length) { console.warn('[Lark] no writable fields'); return {}; }
  console.log('[Lark] PATCH', recordId, JSON.stringify(larkFields));
  const r = await axios.put(
    `${BASE_URL}/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/records/${recordId}`,
    { fields: larkFields },
    { headers: larkHeaders(token), timeout: 15_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark update error: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

async function createTicket(fields) {
  const token = await getTenantToken();
  const larkFields = toWriteFields(fields);
  if (!Object.keys(larkFields).length) throw new Error('No valid writable fields');
  console.log('[Lark] POST', JSON.stringify(larkFields));
  const r = await axios.post(
    `${BASE_URL}/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/records`,
    { fields: larkFields },
    { headers: larkHeaders(token), timeout: 15_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark create error: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

module.exports = { listTickets, updateTicketField, createTicket, getTenantToken };
