// larkService.js — Auto field-detection + full Lark Base integration
const axios = require('axios');
const BASE = 'https://open.larksuite.com/open-apis';

let _token = null, _tokenExp = 0;
let _fieldMap = null; // detected at runtime: internalKey → larkColumnName

async function getToken() {
  if (_token && Date.now() < _tokenExp - 60_000) return _token;
  const r = await axios.post(`${BASE}/auth/v3/tenant_access_token/internal`, {
    app_id: process.env.LARK_APP_ID,
    app_secret: process.env.LARK_APP_SECRET,
  }, { timeout: 10_000 });
  if (r.data.code !== 0) throw new Error(`Lark auth: ${r.data.msg}`);
  _token = r.data.tenant_access_token;
  _tokenExp = Date.now() + r.data.expire * 1000;
  return _token;
}
const hdr = t => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
const APP = () => process.env.LARK_APP_TOKEN;
const TBL = () => process.env.LARK_TABLE_ID;

// ── Keyword → internal key mapping ────────────────────────────
const KEYWORDS = [
  // Ticket ID
  { key: 'id',           words: ['ticket id','ticketid','ticket no','ticket_id','number ticket','หมายเลข ticket','เลข ticket','ticket number','no.'] },
  // Status
  { key: 'status',       words: ['status','สถานะ','state','สถานะงาน','สถานะ.','สถานะ '] },
  // Brand
  { key: 'brand',        words: ['brand','แบรนด์','แบรนด','brand name','บริษัท','ร้าน'] },
  // Branch
  { key: 'branchCode',   words: ['branch code','branchcode','รหัสสาขา','รหัส สาขา','สาขา','branch no','code'] },
  // SLA / Priority
  { key: 'sla',          words: ['sla','sla level','priority','ความสำคัญงาน','ความสำคัญ','ลำดับความสำคัญ'] },
  // Reporter
  { key: 'reporter',     words: ['reporter','ผู้แจ้ง','ผู้แจ้งซ่อม','ผู้แจ้งปัญหา','ชื่อผู้แจ้ง','ผู้แจ้งซ่อม','name','ชื่อ'] },
  // Phone
  { key: 'phone',        words: ['phone','เบอร์','เบอร์ติดต่อ','เบอร์ติดต่อ','เบอร์โทรติดต่อ','mobile','tel','โทร'] },
  // Type
  { key: 'type',         words: ['type','ประเภท','ประเภทงาน','ประเภทปัญหา','ประเภท/อุปกรณ์','job type','หมวดหมู่'] },
  // Detail / Problem
  { key: 'detail',       words: ['detail','รายละเอียด','รายละเอียด/อาการ','รายละเอียดปัญหา','คำอธิบายเพิ่มเติม','อาการ','problem','issue'] },
  // Location
  { key: 'location',     words: ['location','สถานที่','สถานที่/โซน','zone','area'] },
  // Sent Date
  { key: 'sentDate',     words: ['sent date','sentdate','ส่งเมื่อ','วันที่ส่ง','วันที่แจ้ง','วันที่','date','submission date'] },
  // SLA Date
  { key: 'slaDate',      words: ['sla date','sladate','วันนัดงาน','due date','นัดวันซ่อม'] },
  // LINE
  { key: 'line_user_id', words: ['line user id','line user','line uid','line_user_id'] },
  { key: 'line_group_id',words: ['line group id','line group','line_group_id'] },
  // Assign
  { key: 'assignedTo',   words: ['assigned to','assigned','มอบหมาย','ช่างที่รับงาน','engineer assigned','id ช่าง'] },
  // Work detail
  { key: 'workDetail',   words: ['work detail','รายละเอียดงาน','ผลการซ่อม','รายงานช่าง','คำอธิบายเพิ่มเติม'] },
  // Parts
  { key: 'partsUsed',    words: ['parts used','อะไหล่','อะไหล่ที่ใช้','แนบรูป'] },
  // Hours
  { key: 'workHours',    words: ['work hours','ชั่วโมงทำงาน','man hour'] },
  // Completed
  { key: 'completedAt',  words: ['completed at','วันที่เสร็จ','เสร็จเมื่อ','ปุ่มเสร็จงาน'] },
  // Engineer name
  { key: 'engineerName', words: ['engineer name','ชื่อช่าง','ช่าง','engineer','ลิงก์งานช่าง','ปุ่มส่งงานช่าง','id ช่าง'] },
  // Admin note
  { key: 'adminNote',    words: ['admin note','หมายเหตุ admin','หมายเหตุ','remark','แก้ไข'] },
  // Closed
  { key: 'closedAt',     words: ['closed at','วันที่ปิด','ปิดเมื่อ'] },
  { key: 'closedBy',     words: ['closed by','ปิดโดย','จบโดย','แก้ไขโดย'] },
  // Photo
  { key: 'photo',        words: ['photo','รูปงาน','รูป','แนบรูป','รูปภาพ','image'] },
  // Done button
  { key: 'doneBtn',      words: ['ปุ่มเสร็จงาน','ปุ่มส่งงานช่าง','ปุ่มจบงาน'] },
];

const FAST = {};
for (const { key, words } of KEYWORDS) {
  for (const w of words) FAST[w.toLowerCase().trim()] = key;
}

function detectKey(larkName) {
  const n = (larkName || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (FAST[n]) return FAST[n];
  for (const [w, k] of Object.entries(FAST)) {
    if (n.includes(w) || w.includes(n)) return k;
  }
  return null;
}

// Fields we can write back
const WRITABLE_KEYS = new Set([
  'status','brand','branchCode','sla','reporter','phone','type','detail',
  'location','sentDate','line_user_id','line_group_id','assignedTo',
  'workDetail','partsUsed','workHours','completedAt','engineerName',
  'adminNote','closedAt','closedBy'
]);

// ── Date formatter ─────────────────────────────────────────────
function fmtDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return v;
  const n = typeof v === 'number' ? v : Number(v);
  if (!isNaN(n) && n > 1_000_000_000_000)
    return new Date(n).toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d)) return d.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  return String(v);
}
const DATE_KEYS = new Set(['sentDate','slaDate','completedAt','closedAt']);

function parseVal(v, key) {
  if (Array.isArray(v) && v[0]?.text !== undefined) return v.map(x => x.text || '').join('');
  if (v && typeof v === 'object' && !Array.isArray(v) && 'text' in v) return v.text;
  if (v && typeof v === 'object' && !Array.isArray(v) && ('link' in v || 'url' in v)) return v.link || v.url || '';
  if (DATE_KEYS.has(key)) return fmtDate(v);
  if (typeof v === 'number' && v > 1_000_000_000_000) return fmtDate(v);
  return v;
}

// ── Auto-detect field map ──────────────────────────────────────
function buildFieldMap(record) {
  const map = {}; // internalKey → larkColName (for write-back)
  for (const larkName of Object.keys(record.fields || {})) {
    const key = detectKey(larkName);
    if (key && !map[key]) map[key] = larkName;
  }
  console.log('\n[Lark] Field map detected:');
  Object.entries(map).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ← "${v}"`));
  const unmapped = Object.keys(record.fields || {}).filter(n => !detectKey(n));
  if (unmapped.length) console.log('[Lark] Unmapped:', unmapped.join(', '));
  return map;
}

// ── Ticket ID counter ──────────────────────────────────────────
let _seq = 0;
const _idCache = new Map();
function makeId(recordId) {
  if (_idCache.has(recordId)) return _idCache.get(recordId);
  const id = 'TK-' + String(++_seq).padStart(4, '0');
  _idCache.set(recordId, id);
  return id;
}

// ── Parse a Lark record → internal object ─────────────────────
function parseRecord(rec) {
  const out = { _recordId: rec.record_id };
  for (const [larkName, val] of Object.entries(rec.fields || {})) {
    const key = detectKey(larkName) || larkName;
    out[key] = parseVal(val, key);
  }
  if (!out.id || String(out.id).startsWith('rec')) {
    out.id = makeId(rec.record_id);
  }
  // Default brand fallback (ถ้าไม่มี column Brand ใน Lark)
  if (!out.brand) {
    out.brand = process.env.DEFAULT_BRAND || 'Dunkin\'';
  }
  return out;
}

// ── toWriteFields ──────────────────────────────────────────────
function toWriteFields(fields) {
  const out = {};
  const fm = _fieldMap || {};
  const hasFm = Object.keys(fm).length > 0;
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === null || val === '') continue;
    if (!WRITABLE_KEYS.has(key)) continue;
    const colName = fm[key];
    if (!colName) {
      console.warn('[Lark] no column mapped for key "' + key + '" — skipping');
      continue;
    }
    out[colName] = typeof val === 'number' ? String(val) : val;
  }
  return out;
}

// ── ensureFieldMap ────────────────────────────────────────────
async function ensureFieldMap() {
  if (_fieldMap && Object.keys(_fieldMap).length > 0) return;
  console.log('[Lark] fieldMap not ready — building from schema...');
  try {
    // ดึง schema โดยตรง ไม่ต้องรอ listTickets
    const token = await getToken();
    const axios = require('axios');
    const r = await axios.get(
      `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/fields`,
      { headers: hdr(token), timeout: 10_000 }
    );
    const items = r.data.data?.items || [];
    if (items.length) {
      const fakeRecord = { record_id: 'fake', fields: {} };
      items.forEach(f => { fakeRecord.fields[f.field_name] = ''; });
      _fieldMap = buildFieldMap(fakeRecord);
      console.log('[Lark] fieldMap built from schema:', Object.keys(_fieldMap).length, 'fields');
    } else {
      // fallback: list tickets
      await listTickets();
    }
  } catch(e) {
    console.error('[Lark] ensureFieldMap error:', e.message);
    await listTickets(); // fallback
  }
}

// ── LIST tickets ───────────────────────────────────────────────
async function listTickets({ brand, status } = {}) {
  const token = await getToken();
  let all = [], pt;
  do {
    const params = { page_size: 100 };
    if (pt) params.page_token = pt;
    const r = await axios.get(
      `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/records`,
      { headers: hdr(token), params, timeout: 15_000 }
    );
    if (r.data.code !== 0) throw new Error(`Lark list: ${r.data.msg}`);
    const items = r.data.data?.items || [];
    if (!_fieldMap && items.length) _fieldMap = buildFieldMap(items[0]);
    all = all.concat(items.map(parseRecord));
    pt = r.data.data?.has_more ? r.data.data.page_token : undefined;
  } while (pt);

  // Filter server-side
  if (brand && brand !== 'ALL') all = all.filter(t => t.brand === brand);
  if (status) all = all.filter(t => t.status === status);

  // Sort: newest first (by id descending)
  all.sort((a, b) => {
    const na = String(a.id || '').replace(/\D/g, '');
    const nb = String(b.id || '').replace(/\D/g, '');
    return Number(nb) - Number(na);
  });

  console.log(`[Lark] Loaded ${all.length} tickets`);
  return all;
}

// ── GET single ticket ──────────────────────────────────────────
async function getTicket(recordId) {
  const token = await getToken();
  const r = await axios.get(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/records/${recordId}`,
    { headers: hdr(token), timeout: 10_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark get: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

// ── UPDATE ticket ──────────────────────────────────────────────
async function updateTicket(recordId, fields) {
  await ensureFieldMap(); // ต้องมี fieldMap ก่อน write เสมอ
  const token = await getToken();
  const larkFields = toWriteFields(fields);
  if (!Object.keys(larkFields).length) {
    console.warn('[Lark] update: no writable fields', Object.keys(fields));
    return {};
  }
  console.log('[Lark] PUT', recordId, JSON.stringify(larkFields));
  const r = await axios.put(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/records/${recordId}`,
    { fields: larkFields },
    { headers: hdr(token), timeout: 15_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark update: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

// ── CREATE ticket ──────────────────────────────────────────────
async function createTicket(fields) {
  await ensureFieldMap(); // ต้องมี fieldMap ก่อน write เสมอ
  const token = await getToken();
  const larkFields = toWriteFields(fields);
  if (!Object.keys(larkFields).length) throw new Error('No valid fields');
  console.log('[Lark] POST ticket:', JSON.stringify(larkFields));
  const r = await axios.post(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/records`,
    { fields: larkFields },
    { headers: hdr(token), timeout: 15_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark create: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

// ── DEBUG: get raw field schema ────────────────────────────────
async function debugSchema() {
  const token = await getToken();
  const rf = await axios.get(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/fields`,
    { headers: hdr(token), timeout: 10_000 }
  );
  const schema = (rf.data.data?.items || []).map(f => ({
    name: f.field_name, type: f.type,
    mapped_to: detectKey(f.field_name) || '(unmapped)'
  }));
  const rr = await axios.get(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/records`,
    { headers: hdr(token), params: { page_size: 1 }, timeout: 10_000 }
  );
  const sample = rr.data.data?.items?.[0] ? parseRecord(rr.data.data.items[0]) : null;
  return { schema, fieldMap: _fieldMap, sample };
}

module.exports = { listTickets, getTicket, updateTicket, createTicket, debugSchema, getToken, ensureFieldMap };
