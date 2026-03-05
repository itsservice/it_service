// =============================================
// larkService.js  —  Lark Base API client
// =============================================
// ENV ที่ต้องตั้งใน Render:
//   LARK_APP_ID      = cli_xxxxxxxxxxxxxxxx
//   LARK_APP_SECRET  = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//   LARK_APP_TOKEN   = RUkWwDUisiBmkrk9pzYjVok6pAe   (จาก URL ของ Base)
//   LARK_TABLE_ID    = tblCqCvo7GOEB1uN               (จาก URL)
// =============================================

const axios = require('axios');
const BASE_URL = 'https://open.larksuite.com/open-apis';

// Token cache
let _token = null;
let _tokenExp = 0;

async function getTenantToken() {
  if (_token && Date.now() < _tokenExp - 60_000) return _token;
  const r = await axios.post(
    `${BASE_URL}/auth/v3/tenant_access_token/internal`,
    { app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET },
    { timeout: 10_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark auth error: ${r.data.msg}`);
  _token    = r.data.tenant_access_token;
  _tokenExp = Date.now() + r.data.expire * 1000;
  return _token;
}

function larkHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// *** ปรับ field name ให้ตรงกับ Lark Base ของคุณ ***
const FIELD_MAP = {
  'Ticket ID':    'id',
  'Status':       'status',
  'Brand':        'brand',
  'Branch Code':  'branchCode',
  'SLA':          'sla',
  'Reporter':     'reporter',
  'Phone':        'phone',
  'Type':         'type',
  'Detail':       'detail',
  'Location':     'location',
  'Sent Date':    'sentDate',
  'SLA Date':     'slaDate',
  'Created At':   'createdAt',
  'LINE User ID': 'line_user_id',
  'LINE Group ID':'line_group_id',
  'Record URL':   'recordUrl',
};
const REVERSE_MAP = Object.fromEntries(Object.entries(FIELD_MAP).map(([k,v])=>[v,k]));

function parseRecord(record) {
  const out = { _recordId: record.record_id };
  for (const [larkField, val] of Object.entries(record.fields || {})) {
    const key = FIELD_MAP[larkField] || larkField;
    if (Array.isArray(val) && val[0]?.text !== undefined) {
      out[key] = val.map(v => v.text).join('');
    } else if (val && typeof val === 'object' && val.text !== undefined) {
      out[key] = val.text;
    } else {
      out[key] = val;
    }
  }
  if (!out.id) out.id = record.record_id;
  return out;
}

async function listTickets() {
  const token = await getTenantToken();
  const appToken = process.env.LARK_APP_TOKEN;
  const tableId  = process.env.LARK_TABLE_ID;
  let allRecords = [], pageToken = undefined;
  do {
    const params = { page_size: 100 };
    if (pageToken) params.page_token = pageToken;
    const r = await axios.get(
      `${BASE_URL}/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
      { headers: larkHeaders(token), params, timeout: 15_000 }
    );
    if (r.data.code !== 0) throw new Error(`Lark list error: ${r.data.msg}`);
    allRecords = allRecords.concat((r.data.data?.items || []).map(parseRecord));
    pageToken  = r.data.data?.has_more ? r.data.data.page_token : undefined;
  } while (pageToken);
  return allRecords;
}

async function updateTicketField(recordId, fields) {
  const token = await getTenantToken();
  const larkFields = {};
  for (const [key, val] of Object.entries(fields)) {
    larkFields[REVERSE_MAP[key] || key] = val;
  }
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
  const larkFields = {};
  for (const [key, val] of Object.entries(fields)) {
    larkFields[REVERSE_MAP[key] || key] = val;
  }
  const r = await axios.post(
    `${BASE_URL}/bitable/v1/apps/${process.env.LARK_APP_TOKEN}/tables/${process.env.LARK_TABLE_ID}/records`,
    { fields: larkFields },
    { headers: larkHeaders(token), timeout: 15_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark create error: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

module.exports = { listTickets, updateTicketField, createTicket, getTenantToken };
