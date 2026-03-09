// larkService.js — Auto field-detection + full Lark Base integration
const axios = require('axios');
const BASE = 'https://open.larksuite.com/open-apis';

let _token = null, _tokenExp = 0;
let _fieldMap = null;    // internalKey → larkColumnName
let _fieldTypes = {};    // larkColumnName → field ui_type
let _fieldOptions = {};  // larkColumnName → Set of valid option names
let _optionMap = {};     // "optXXXX" → "text value"
let _ticketCache = null, _ticketCacheExp = 0;
const CACHE_TTL = 30_000;

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

// ── Multi-brand table map ─────────────────────────────────────
const BRAND_TABLES = () => [
  { brand: "Dunkin'",            tableId: process.env.LARK_TABLE_DUNKIN            || process.env.LARK_TABLE_ID },
  { brand: "Greyhound Cafe",     tableId: process.env.LARK_TABLE_GREYHOUND_CAFE    },
  // ✅ แก้: รองรับทั้ง GREYHOUND_ORI และ GREYHOUND_ORIGINAL
  { brand: "Greyhound Original", tableId: process.env.LARK_TABLE_GREYHOUND_ORIGINAL || process.env.LARK_TABLE_GREYHOUND_ORI },
  { brand: "Au Bon Pain",        tableId: process.env.LARK_TABLE_AU_BON_PAIN       },
  { brand: "Funky Fries",        tableId: process.env.LARK_TABLE_FUNKY_FRIES       },
].filter(b => b.tableId);

const TBL = () => process.env.LARK_TABLE_ID;

// ── Keyword → internal key mapping ────────────────────────────
const KEYWORDS = [
  { key: 'id',           words: ['ticket id','ticketid','ticket no','ticket_id','number ticket','หมายเลข ticket','เลข ticket','ticket number','no.'] },
  { key: 'status',       words: ['status','สถานะ','state','สถานะงาน','สถานะ.','สถานะ '] },
  { key: 'brand',        words: ['brand','แบรนด์','แบรนด','brand name','บริษัท','ร้าน'] },
  { key: 'branchCode',   words: ['branch code','branchcode','รหัสสาขา','รหัส สาขา','สาขา','branch no','code'] },
  { key: 'sla',          words: ['sla','sla level','priority','ความสำคัญงาน','ความสำคัญ','ลำดับความสำคัญ'] },
  { key: 'reporter',     words: ['reporter','ผู้แจ้ง','ผู้แจ้งซ่อม','ผู้แจ้งปัญหา','ชื่อผู้แจ้ง','name','ชื่อ'] },
  { key: 'phone',        words: ['phone','เบอร์','เบอร์ติดต่อ','เบอร์โทรติดต่อ','mobile','tel','โทร'] },
  { key: 'type',         words: ['type','ประเภท','ประเภทงาน','ประเภทปัญหา','ประเภท/อุปกรณ์','job type','หมวดหมู่'] },
  { key: 'detail',       words: ['detail','รายละเอียด','รายละเอียด/อาการ','รายละเอียดปัญหา','คำอธิบายเพิ่มเติม','อาการ','problem','issue'] },
  { key: 'location',     words: ['location','สถานที่','สถานที่/โซน','zone','area'] },
  { key: 'sentDate',     words: ['sent date','sentdate','ส่งเมื่อ','วันที่ส่ง','วันที่แจ้ง','วันที่','date','submission date'] },
  { key: 'slaDate',      words: ['sla date','sladate','วันนัดงาน','due date','นัดวันซ่อม'] },
  { key: 'line_user_id', words: ['line user id','line user','line uid','line_user_id'] },
  { key: 'line_group_id',words: ['line group id','line group','line_group_id'] },
  { key: 'assignedTo',   words: ['assigned to','assigned','มอบหมาย','ช่างที่รับงาน','engineer assigned','id ช่าง'] },
  { key: 'workDetail',   words: ['work detail','รายละเอียดงาน','ผลการซ่อม','รายงานช่าง'] },
  { key: 'partsUsed',    words: ['parts used','อะไหล่','อะไหล่ที่ใช้'] },
  { key: 'workHours',    words: ['work hours','ชั่วโมงทำงาน','man hour'] },
  { key: 'completedAt',  words: ['completed at','วันที่เสร็จ','เสร็จเมื่อ'] },
  { key: 'engineerName', words: ['engineer name','ชื่อช่าง','ช่าง','engineer'] },
  { key: 'adminNote',    words: ['admin note','หมายเหตุ admin','หมายเหตุ','remark'] },
  { key: 'closedAt',     words: ['closed at','วันที่ปิด','ปิดเมื่อ'] },
  { key: 'closedBy',     words: ['closed by','ปิดโดย','จบโดย'] },
  { key: 'photo',        words: ['photo','รูปงาน','รูป','รูปภาพ','image'] },
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

const WRITABLE_KEYS = new Set([
  'status','brand','branchCode','sla','reporter','phone','type','detail',
  'location','sentDate','line_user_id','line_group_id','assignedTo',
  'workDetail','partsUsed','workHours','completedAt','engineerName',
  'adminNote','closedAt','closedBy'
]);

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
  if (typeof v === 'string') {
    if (v.startsWith('opt') && _optionMap[v]) return _optionMap[v];
    return v;
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && 'text' in v)
    return String(v.text || '');
  if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'text' in v[0])
    return v.map(x => String(x.text || '')).join(', ');
  if (Array.isArray(v) && v.length && typeof v[0] === 'string' && v[0].startsWith('opt'))
    return v.map(id => _optionMap[id] || id).join(', ');
  if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'type' in v[0])
    return v.map(x => x.text || x.raw_value || '').join('');
  if (v && typeof v === 'object' && !Array.isArray(v) && ('link' in v || 'url' in v))
    return v.link || v.url || '';
  if (DATE_KEYS.has(key)) return fmtDate(v);
  if (typeof v === 'number' && v > 1_000_000_000_000) return fmtDate(v);
  return v;
}

function buildFieldMap(record) {
  const map = {};
  for (const larkName of Object.keys(record.fields || {})) {
    const key = detectKey(larkName);
    if (key && !map[key]) map[key] = larkName;
  }
  console.log('\n[Lark] Field map detected:');
  Object.entries(map).forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ← "${v}"`));
  const unmapped = Object.keys(record.fields || {}).filter(n => !detectKey(n));
  if (unmapped.length) console.log('[Lark] Unmapped fields:', unmapped.join(', '));
  return map;
}

const BRAND_ID_PREFIX = {
  "Dunkin'":           'DK',
  "Greyhound Cafe":    'GH',
  "Greyhound Original":'GO',
  "Au Bon Pain":       'ABP',
  "Funky Fries":       'FF',
};
let _seq = 0;
const _idCache = new Map();
function makeId(recordId, brand) {
  if (_idCache.has(recordId)) return _idCache.get(recordId);
  const prefix = (brand && BRAND_ID_PREFIX[brand]) || 'TK';
  const id = prefix + '-' + String(++_seq).padStart(4, '0');
  _idCache.set(recordId, id);
  return id;
}

const STATUS_NORMALIZE = {
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

function parseRecord(rec) {
  const out = { _recordId: rec.record_id };
  for (const [larkName, val] of Object.entries(rec.fields || {})) {
    const key = detectKey(larkName) || larkName;
    out[key] = parseVal(val, key);
  }
  if (out.status) out.status = normalizeStatus(out.status);
  const URL_FIELDS = new Set(['location','detail','type','branchCode','reporter','phone','engineerName','sla','sentDate']);
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string' && out[k].startsWith('http')) {
      if (URL_FIELDS.has(k)) { out[k] = ''; }
      else {
        if (!out._links) out._links = {};
        out._links[k] = out[k];
        out[k] = '';
      }
    }
  }
  if (out.id && !String(out.id).startsWith('rec')) {
    // use as-is
  } else {
    out.id = makeId(rec.record_id, out.brand);
  }
  if (!out.brand) out.brand = process.env.DEFAULT_BRAND || "Dunkin'";
  return out;
}

// ✅ แก้: ตรวจสอบ fieldMap ก่อน write และ log ชัดเจน
function toWriteFields(fields) {
  const out = {};
  const fm = _fieldMap || {};
  const hasFm = Object.keys(fm).length > 0;

  if (!hasFm) {
    console.error('[Lark] ⚠️  toWriteFields called but _fieldMap is empty! Fields will be skipped.');
  }

  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === null || val === '') continue;
    if (!WRITABLE_KEYS.has(key)) continue;
    const colName = fm[key];
    if (!colName) {
      console.warn(`[Lark] no column mapped for key "${key}" — skipping (fieldMap keys: ${Object.keys(fm).join(', ')})`);
      continue;
    }
    if (DATE_KEYS.has(key)) {
      const ts = toUnixMs(val);
      if (ts) { out[colName] = ts; continue; }
      console.warn(`[Lark] skip date field "${key}" — cannot convert:`, val);
      continue;
    }
    const fieldType = _fieldTypes[colName];
    if (fieldType === 'SingleSelect') {
      const validOpts = _fieldOptions[colName];
      if (validOpts && validOpts.size > 0) {
        const valStr = String(val).trim();
        const matched = [...validOpts].find(o =>
          o.toLowerCase() === valStr.toLowerCase() ||
          o.replace(/[.\s]/g,'').toLowerCase() === valStr.replace(/[.\s]/g,'').toLowerCase()
        );
        if (!matched) {
          console.warn(`[Lark] SingleSelect "${colName}" skip "${val}" (not in options: ${[...validOpts].join(', ')})`);
          continue;
        }
        out[colName] = matched;
      } else {
        out[colName] = String(val);
      }
      continue;
    }
    out[colName] = typeof val === 'number' ? String(val) : val;
  }
  return out;
}

function toUnixMs(val) {
  if (!val) return null;
  if (typeof val === 'number') return val > 1e10 ? val : val * 1000;
  const thMatch = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (thMatch) {
    let [, d, m, y] = thMatch;
    if (parseInt(y) > 2300) y = String(parseInt(y) - 543);
    const dt = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T00:00:00+07:00`);
    return isNaN(dt) ? null : dt.getTime();
  }
  const dt = new Date(val);
  return isNaN(dt) ? null : dt.getTime();
}

// ✅ แก้: ensureFieldMap รอจริงๆ และ retry ถ้า fieldMap ว่าง
async function ensureFieldMap(forceRebuild = false) {
  if (!forceRebuild && _fieldMap && Object.keys(_fieldMap).length > 0) return;
  console.log('[Lark] Building fieldMap from ALL brand tables...');
  try {
    const token = await getToken();
    const tables = BRAND_TABLES();

    if (tables.length === 0) {
      throw new Error('No brand tables configured. Check LARK_TABLE_* env vars.');
    }

    let firstItems = null;
    _fieldTypes = {};
    _fieldOptions = {};
    _optionMap = {};

    await Promise.all(tables.map(async ({ brand: brandName, tableId }) => {
      try {
        const r = await axios.get(
          `${BASE}/bitable/v1/apps/${APP()}/tables/${tableId}/fields`,
          { headers: hdr(token), timeout: 10_000 }
        );
        const items = r.data.data?.items || [];
        if (!items.length) {
          console.warn(`[Lark] No fields returned for ${brandName} (tableId: ${tableId})`);
          return;
        }
        if (!firstItems) firstItems = items;
        items.forEach(f => {
          _fieldTypes[f.field_name] = f.ui_type;
          if (f.ui_type === 'SingleSelect' || f.ui_type === 'MultiSelect') {
            const opts = f.property?.options || [];
            opts.forEach(o => { if (o.id && o.name) _optionMap[o.id] = o.name; });
            if (!_fieldOptions[f.field_name]) _fieldOptions[f.field_name] = new Set();
            opts.forEach(o => _fieldOptions[f.field_name].add(o.name));
          }
        });
        console.log(`[Lark] Schema loaded: ${brandName} — ${items.length} fields`);
      } catch(e) {
        console.error(`[Lark] Schema failed for ${brandName} (${tableId}):`, e.message);
      }
    }));

    if (firstItems && firstItems.length > 0) {
      const fakeRecord = { record_id: 'fake', fields: {} };
      firstItems.forEach(f => { fakeRecord.fields[f.field_name] = ''; });
      _fieldMap = buildFieldMap(fakeRecord);
      console.log(`[Lark] ✅ fieldMap ready: ${Object.keys(_fieldMap).length} keys mapped`);
      if (Object.keys(_fieldMap).length === 0) {
        console.error('[Lark] ⚠️  fieldMap built but 0 keys mapped! Field names may not match KEYWORDS.');
        console.log('[Lark] Available field names:', firstItems.map(f => f.field_name).join(', '));
      }
    } else {
      console.warn('[Lark] No fields found via schema API — falling back to listTickets()');
      await listTickets({ noCache: true });
    }
  } catch(e) {
    console.error('[Lark] ensureFieldMap error:', e.message);
    // Fallback: try to build from existing records
    try {
      await listTickets({ noCache: true });
    } catch(e2) {
      console.error('[Lark] Fallback listTickets also failed:', e2.message);
    }
  }
}

async function listTickets({ brand, status, noCache } = {}) {
  if (!noCache && _ticketCache && Date.now() < _ticketCacheExp) {
    let cached = _ticketCache;
    if (brand) cached = cached.filter(t => t.brand === brand);
    if (status) cached = cached.filter(t => t.status === status);
    return cached;
  }
  const token = await getToken();
  const tables = BRAND_TABLES();
  let allTickets = [];

  const TABLE_TIMEOUT = 12_000;
  const fetchTable = async ({ brand: brandName, tableId }) => {
    let all = [], pt;
    do {
      const params = { page_size: 100 };
      if (pt) params.page_token = pt;
      const r = await axios.get(
        `${BASE}/bitable/v1/apps/${APP()}/tables/${tableId}/records`,
        { headers: hdr(token), params, timeout: TABLE_TIMEOUT }
      );
      const items = r.data.data?.items || [];
      // Build fieldMap from first record if not yet built
      if ((!_fieldMap || Object.keys(_fieldMap).length === 0) && items.length) {
        _fieldMap = buildFieldMap(items[0]);
      }
      const parsed = items.map(rec => {
        const t = parseRecord(rec);
        t.brand = brandName;
        return t;
      });
      all = all.concat(parsed);
      pt = r.data.data?.has_more ? r.data.data.page_token : undefined;
    } while (pt);
    console.log(`[Lark] Fetched ${all.length} tickets from ${brandName}`);
    return all;
  };

  const results = await Promise.allSettled(tables.map(t => fetchTable(t)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') allTickets = allTickets.concat(r.value);
    else console.error(`[Lark] ${tables[i].brand} failed:`, r.reason?.message);
  });

  allTickets.sort((a, b) => {
    const ai = parseInt(String(a.id||'0').replace(/\D/g,''))||0;
    const bi = parseInt(String(b.id||'0').replace(/\D/g,''))||0;
    return bi - ai;
  });

  _ticketCache = allTickets;
  _ticketCacheExp = Date.now() + CACHE_TTL;

  let result = allTickets;
  if (brand) result = result.filter(t => t.brand === brand);
  if (status) result = result.filter(t => t.status === status);
  return result;
}

async function getTicket(recordId, tableId) {
  const token = await getToken();
  const tbl = tableId || TBL();
  const r = await axios.get(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${tbl}/records/${recordId}`,
    { headers: hdr(token), timeout: 10_000 }
  );
  if (r.data.code !== 0) throw new Error(`Lark get: ${r.data.msg}`);
  return parseRecord(r.data.data?.record || {});
}

function invalidateCache() { _ticketCache = null; _ticketCacheExp = 0; }

async function updateTicket(recordId, fields) {
  await ensureFieldMap();
  const token = await getToken();

  // ✅ แก้: ตรวจสอบ fieldMap ก่อน update
  if (!_fieldMap || Object.keys(_fieldMap).length === 0) {
    throw new Error('fieldMap not ready — cannot update ticket. Please retry in a moment.');
  }

  const larkFields = toWriteFields(fields);
  if (!Object.keys(larkFields).length) {
    console.warn('[Lark] update: no writable fields after mapping. Input:', Object.keys(fields));
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

// ✅ แก้หลัก: createTicket — ตรวจสอบ fieldMap, เพิ่ม sentDate/status อัตโนมัติ, log ชัดเจน
async function createTicket(fields) {
  // Retry ensureFieldMap สูงสุด 3 ครั้งถ้ายังไม่มี fieldMap
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (_fieldMap && Object.keys(_fieldMap).length > 0) break;
    console.log(`[Lark] ensureFieldMap attempt ${attempt}/3...`);
    await ensureFieldMap(attempt > 1); // force rebuild ตั้งแต่ attempt 2
    if (_fieldMap && Object.keys(_fieldMap).length > 0) break;
    if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
  }

  if (!_fieldMap || Object.keys(_fieldMap).length === 0) {
    throw new Error('ระบบยังโหลด field map ไม่สำเร็จ กรุณาลองใหม่ในอีก 10 วินาที (fieldMap empty)');
  }

  const token = await getToken();

  // เลือก table ตาม brand
  const brandTable = BRAND_TABLES().find(b => b.brand === fields.brand);
  const targetTable = brandTable?.tableId || TBL();

  if (!targetTable) {
    throw new Error(`ไม่พบ Table ID สำหรับแบรนด์ "${fields.brand}" — กรุณาตั้งค่า env LARK_TABLE_* ให้ครบ`);
  }

  // ✅ เพิ่ม sentDate และ status อัตโนมัติถ้าไม่มี
  const now = new Date().toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit', year:'numeric' });
  const enrichedFields = {
    sentDate: now,
    status: 'รอดำเนินการ ⏱️',
    ...fields, // fields จาก user จะ override ค่า default ถ้ามี
  };

  console.log(`[Lark] createTicket → brand="${fields.brand}" tableId="${targetTable}"`);
  console.log('[Lark] fieldMap state:', JSON.stringify(_fieldMap));
  console.log('[Lark] input fields:', JSON.stringify(enrichedFields));

  // ลอง pass 1: ส่งทุก field
  let larkFields = toWriteFields(enrichedFields);

  if (!Object.keys(larkFields).length) {
    // ✅ แก้: ถ้า toWriteFields คืน {} แสดงว่า field names ใน Lark ไม่ match KEYWORDS
    // ลอง fallback: ส่ง raw field names โดยตรง (ใช้ชื่อ column จาก firstItems ถ้ามี)
    throw new Error(
      `ไม่สามารถแมป fields ได้ (toWriteFields คืนค่าว่าง)\n` +
      `fieldMap keys: ${Object.keys(_fieldMap).join(', ')}\n` +
      `input keys: ${Object.keys(enrichedFields).join(', ')}\n` +
      `กรุณาเปิด /debug/lark-fields เพื่อดู field names จริงใน Lark`
    );
  }

  console.log('[Lark] POST ticket fields:', JSON.stringify(larkFields));

  let r = await axios.post(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${targetTable}/records`,
    { fields: larkFields },
    { headers: hdr(token), timeout: 15_000 }
  );

  // Retry ถ้า SingleSelect error — ส่งเฉพาะ text fields
  if (r.data.code !== 0 && r.data.msg && r.data.msg.includes('SelectFieldConvFail')) {
    console.warn('[Lark] SingleSelect error — retrying with text-only fields');
    const SAFE_KEYS = ['reporter','phone','detail','location','workDetail','partsUsed','adminNote'];
    const safeFields = {};
    SAFE_KEYS.forEach(k => { if (enrichedFields[k]) safeFields[k] = enrichedFields[k]; });
    larkFields = toWriteFields(safeFields);
    if (!Object.keys(larkFields).length) throw new Error(`Lark create: ${r.data.msg}`);
    console.log('[Lark] Retry POST (text-only):', JSON.stringify(larkFields));
    r = await axios.post(
      `${BASE}/bitable/v1/apps/${APP()}/tables/${targetTable}/records`,
      { fields: larkFields },
      { headers: hdr(token), timeout: 15_000 }
    );
  }

  // ✅ แก้: log error body ชัดเจน
  if (r.data.code !== 0) {
    console.error('[Lark] create failed:', r.data.code, r.data.msg);
    console.error('[Lark] fields sent:', JSON.stringify(larkFields));
    throw new Error(`Lark create: ${r.data.msg} (code: ${r.data.code})`);
  }

  const created = parseRecord(r.data.data?.record || {});

  // Fetch กลับมาเพื่อดึง auto-number จาก Lark
  try {
    await new Promise(resolve => setTimeout(resolve, 800));
    const fresh = await getTicket(created._recordId, targetTable);
    if (fresh && fresh._recordId) {
      invalidateCache();
      return fresh;
    }
  } catch(e) {
    console.warn('[Lark] re-fetch after create failed:', e.message);
  }

  invalidateCache();
  return created;
}

async function debugSchema() {
  const token = await getToken();
  const rf = await axios.get(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/fields`,
    { headers: hdr(token), timeout: 10_000 }
  );
  const schema = (rf.data.data?.items || []).map(f => ({
    name: f.field_name, type: f.type, ui_type: f.ui_type,
    mapped_to: detectKey(f.field_name) || '(unmapped)',
    options: f.property?.options?.map(o => o.name) || [],
  }));
  const rr = await axios.get(
    `${BASE}/bitable/v1/apps/${APP()}/tables/${TBL()}/records`,
    { headers: hdr(token), params: { page_size: 1 }, timeout: 10_000 }
  );
  const sample = rr.data.data?.items?.[0] ? parseRecord(rr.data.data.items[0]) : null;
  return { schema, fieldMap: _fieldMap, fieldTypes: _fieldTypes, sample };
}

async function clickButton(recordId, buttonFieldName) {
  console.log(`[Lark] clickButton skipped (not supported via API): "${buttonFieldName}"`);
  return false;
}
const LARK_BUTTONS = { sendToAdmin:'', done:'', changeEngineer:'' };

module.exports = {
  listTickets, getTicket, updateTicket, createTicket,
  debugSchema, getToken, ensureFieldMap, clickButton,
  LARK_BUTTONS, invalidateCache,
};
