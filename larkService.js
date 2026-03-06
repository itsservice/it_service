// larkService.js — Auto field-detection + full Lark Base integration
const axios = require('axios');
const BASE = 'https://open.larksuite.com/open-apis';

let _token = null, _tokenExp = 0;
let _fieldMap = null;    // internalKey → larkColumnName
let _fieldTypes = {};    // larkColumnName → field ui_type (Text, SingleSelect, DateTime, etc.)
let _fieldOptions = {};  // larkColumnName → Set of valid option names
let _optionMap = {};     // "optXXXX" → "text value" (for select fields)
let _ticketCache = null, _ticketCacheExp = 0;
const CACHE_TTL = 30_000; // cache tickets 30 วินาที

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
  if (v === null || v === undefined) return '';

  // ── String: อาจเป็น option ID เช่น "optBaPvMxB" ──
  if (typeof v === 'string') {
    if (v.startsWith('opt') && _optionMap[v]) return _optionMap[v];
    return v;
  }

  // ── Lark option object: { id: 'optXXX', text: 'ค่า' } ──
  if (v && typeof v === 'object' && !Array.isArray(v) && 'text' in v)
    return String(v.text || '');

  // ── Lark multi-select: [{ id, text }, ...] ──
  if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'text' in v[0])
    return v.map(x => String(x.text || '')).join(', ');

  // ── Array of option IDs: ["optXXX", "optYYY"] ──
  if (Array.isArray(v) && v.length && typeof v[0] === 'string' && v[0].startsWith('opt'))
    return v.map(id => _optionMap[id] || id).join(', ');

  // ── Lark rich text: [{ type, text }] ──
  if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'type' in v[0])
    return v.map(x => x.text || x.raw_value || '').join('');

  // ── URL field ──
  if (v && typeof v === 'object' && !Array.isArray(v) && ('link' in v || 'url' in v))
    return v.link || v.url || '';

  // ── Date fields ──
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

// ── Normalize status from Lark to our system ──────────────────
// Lark อาจเก็บสถานะเป็นชื่อเดิม (ไม่มี emoji) หรือชื่อใหม่
const STATUS_NORMALIZE = {
  // Lark old → our new
  'แก้ไข':                      'แก้ไข',
  'รอตรวจงาน':                  'แก้ไข',
  'รอดำเนินการ':                 'รอดำเนินการ ⏱️',
  'รอดำเนินการ ⏱️':             'รอดำเนินการ ⏱️',
  'ตรวจงาน':                    'ตรวจงาน',
  'อยู่ระหว่างดำเนินการ':        'อยู่ระหว่างดำเนินการ ⚙️',
  'อยู่ระหว่างดำเนินการ ⚙️':    'อยู่ระหว่างดำเนินการ ⚙️',
  'รอชิ้นส่วน':                  'รอดำเนินการ ⏱️',
  'เสร็จสิ้น':                   'เสร็จสิ้น ✅',
  'เสร็จสิ้น ✅':               'เสร็จสิ้น ✅',
  'ยกเลิก':                      'ยกเลิก ❌',
  'ยกเลิก ❌':                  'ยกเลิก ❌',
};
function normalizeStatus(s) {
  if (!s) return '';
  const clean = String(s).trim();
  return STATUS_NORMALIZE[clean] || clean;
}

// ── Parse a Lark record → internal object ─────────────────────
function parseRecord(rec) {
  const out = { _recordId: rec.record_id };
  for (const [larkName, val] of Object.entries(rec.fields || {})) {
    const key = detectKey(larkName) || larkName;
    out[key] = parseVal(val, key);
  }
  // Normalize status
  if (out.status) out.status = normalizeStatus(out.status);
  // ลบค่าที่เป็น URL ออกจาก field ที่ไม่ควรเป็น URL
  const URL_FIELDS = ['location','detail','type','branchCode','reporter'];
  URL_FIELDS.forEach(k => {
    if (out[k] && typeof out[k] === 'string' && out[k].startsWith('http')) {
      console.log(`[Lark] skip URL value in field "${k}"`);
      out[k] = '';
    }
  });
  // Use Number Ticket as ID if exists
  if (out.id && !String(out.id).startsWith('rec')) {
    // use as-is
  } else {
    out.id = makeId(rec.record_id);
  }
  // Default brand fallback
  if (!out.brand) {
    out.brand = process.env.DEFAULT_BRAND || "Dunkin'";
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
    // Lark datetime field ต้องการ Unix timestamp (ms)
    if (DATE_KEYS.has(key)) {
      const ts = toUnixMs(val);
      if (ts) { out[colName] = ts; continue; }
      console.warn(`[Lark] skip date field "${key}" — cannot convert:`, val);
      continue;
    }
    // Lark SingleSelect field — ตรวจว่า option มีอยู่จริง
    const fieldType = _fieldTypes[colName];
    if (fieldType === 'SingleSelect') {
      const validOpts = _fieldOptions[colName];
      // รหัสสาขา และ ช่าง — อนุญาตให้ส่งแม้ไม่มีใน options (free text)
      const ALLOW_FREE = new Set(['branchCode','engineerName','assignedTo']);
      if (!ALLOW_FREE.has(key) && validOpts && validOpts.size > 0 && !validOpts.has(String(val))) {
        console.warn(`[Lark] SingleSelect "${colName}" skip "${val}"`);
        continue;
      }
      out[colName] = String(val);
      continue;
    }
    out[colName] = typeof val === 'number' ? String(val) : val;
  }
  return out;
}

// แปลงวันที่รูปแบบต่างๆ → Unix ms สำหรับ Lark
function toUnixMs(val) {
  if (!val) return null;
  if (typeof val === 'number') return val > 1e10 ? val : val * 1000;
  // Thai date string: "04/03/2569" → convert BE to CE
  const thMatch = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thMatch) {
    let [, d, m, y] = thMatch;
    if (parseInt(y) > 2300) y = String(parseInt(y) - 543); // พ.ศ. → ค.ศ.
    const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00+07:00`);
    return isNaN(dt) ? null : dt.getTime();
  }
  // ISO string
  const dt = new Date(val);
  return isNaN(dt) ? null : dt.getTime();
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
      // Build option maps and field type registry
      items.forEach(f => {
        _fieldTypes[f.field_name] = f.ui_type;
        if (f.ui_type === 'SingleSelect' || f.ui_type === 'MultiSelect') {
          const opts = f.property?.options || [];
          opts.forEach(o => { if (o.id && o.name) _optionMap[o.id] = o.name; });
          _fieldOptions[f.field_name] = new Set(opts.map(o => o.name));
        }
      });
      console.log('[Lark] optionMap built:', Object.keys(_optionMap).length, 'options');
      console.log('[Lark] fieldTypes:', Object.entries(_fieldTypes).map(([k,v])=>`${k}:${v}`).join(', '));
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
async function listTickets({ brand, status, noCache } = {}) {
  // Return cache ถ้ายังสด (ลด Lark API calls)
  if (!noCache && _ticketCache && Date.now() < _ticketCacheExp) {
    let cached = _ticketCache;
    if (brand) cached = cached.filter(t => t.brand === brand);
    if (status) cached = cached.filter(t => t.status === status);
    return cached;
  }
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
  // Save to cache (ก่อน filter)
  _ticketCache = [...all];
  _ticketCacheExp = Date.now() + CACHE_TTL;

  if (brand) all = all.filter(t => t.brand === brand);
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

// ── Invalidate cache on write ─────────────────────────────────
function invalidateCache() { _ticketCache = null; _ticketCacheExp = 0; }

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
  invalidateCache();
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
  // Parse record จาก response ก่อน
  const created = parseRecord(r.data.data?.record || {});
  // Fetch กลับมาเพื่อดึง "Number Ticket" ที่ Lark generate ให้
  // (Lark auto-number field จะถูก populate หลัง create)
  try {
    await new Promise(resolve => setTimeout(resolve, 800)); // รอ Lark generate
    const fresh = await getTicket(created._recordId);
    if (fresh && fresh.id && !String(fresh.id).startsWith('TK-')) {
      return fresh; // ได้ GD-XXXXX จาก Lark
    }
  } catch(e) {
    console.warn('[Lark] re-fetch after create failed:', e.message);
  }
  invalidateCache();
  return created;
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


// ── clickButton: Lark ไม่รองรับกดปุ่มผ่าน API โดยตรง ──────────
// ใช้ updateTicket แทน (status จะ trigger Lark automation เอง)
async function clickButton(recordId, buttonFieldName) {
  console.log(`[Lark] clickButton skipped (not supported via API): "${buttonFieldName}"`);
  return false;
}
const LARK_BUTTONS = { sendToAdmin:'', done:'', changeEngineer:'' };

module.exports = { listTickets, getTicket, updateTicket, createTicket, debugSchema, getToken, ensureFieldMap, clickButton, LARK_BUTTONS, invalidateCache };
