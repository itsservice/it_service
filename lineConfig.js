// lineConfig.js — ดึงค่า LINE config จาก MySQL ผ่าน FastAPI
const axios = require('axios');

const API_URL  = process.env.REPAIR_API_URL || 'http://repair.mobile1234.site:8000';
const API_KEY  = process.env.REPAIR_API_KEY  || 'repair123';

// ── in-memory cache (refresh ทุก 5 นาที) ──────────────────────
let _cache    = null;
let _cacheExp = 0;
const CACHE_TTL = 5 * 60 * 1000;

const BRAND_KEY_MAP = {
  "Dunkin'"            : 'brand_group_dunkin',
  "Greyhound Cafe"     : 'brand_group_greyhound_cafe',
  "Greyhound Original" : 'brand_group_greyhound_original',
  "Au Bon Pain"        : 'brand_group_au_bon_pain',
  "Funky Fries"        : 'brand_group_funky_fries',
};

async function fetchFromMySQL() {
  try {
    const r = await axios.get(`${API_URL}/api/line-config`, {
      headers: { 'X-API-Key': API_KEY },
      timeout: 8000,
    });
    if (r.data?.ok) {
      const raw = r.data.config || {};
      // รองรับทั้ง nested format {adminGroupId, brandGroups} และ flat format
      if (raw.brandGroups !== undefined) {
        const flat = {};
        if (raw.adminGroupId) flat['admin_group_id'] = raw.adminGroupId;
        for (const [brand, val] of Object.entries(raw.brandGroups || {})) {
          const key = BRAND_KEY_MAP[brand];
          if (key) flat[key] = val || '';
        }
        _cache = flat;
      } else {
        _cache = raw;
      }
      _cacheExp = Date.now() + CACHE_TTL;
      console.log('[LineConfig] fetched from MySQL:', Object.keys(_cache).length, 'keys');
    }
  } catch (e) {
    console.warn('[LineConfig] fetch failed:', e.message);
  }
  return _cache || {};
}

async function getConfig() {
  if (_cache && Date.now() < _cacheExp) return _cache;
  return fetchFromMySQL();
}

function invalidate() {
  _cache    = null;
  _cacheExp = 0;
}

async function getBrandGroupId(brand) {
  const cfg = await getConfig();
  const key = BRAND_KEY_MAP[brand] ||
    BRAND_KEY_MAP[Object.keys(BRAND_KEY_MAP).find(k => k.toLowerCase() === (brand||'').toLowerCase())];
  const val = key ? (cfg[key] || '') : '';
  // กรอง placeholder
  return val && !val.includes('xxx') ? val : '';
}

async function getAdminGroupId() {
  const cfg = await getConfig();
  return cfg['admin_group_id'] || process.env.LINE_ADMIN_GROUP_ID || '';
}

// ดึง LINE User ID ของ Admin/Superadmin/Manager จาก users table
// กรองเฉพาะ U... (User ID) ไม่เอา C... (Group ID)
async function getAdminUserIds() {
  try {
    const r = await axios.get(`${API_URL}/api/admin-line-ids`, {
      headers: { 'X-API-Key': API_KEY },
      timeout: 8000,
    });
    if (r.data?.ok) {
      const ids = (r.data.admins || [])
        .map(u => (u.line_user_id || '').trim())
        .filter(id => id.startsWith('U')); // เฉพาะ User ID จริงๆ
      console.log('[LineConfig] admin LINE user IDs:', ids.length);
      return ids;
    }
  } catch (e) {
    console.warn('[LineConfig] getAdminUserIds failed:', e.message);
  }
  return [];
}

// updateConfig — บันทึกค่าลง MySQL ผ่าน FastAPI (PATCH /api/line-config)
async function updateConfig(body) {
  try {
    const r = await axios.patch(`${API_URL}/api/line-config`, body, {
      headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    invalidate(); // ล้าง cache
    return r.data?.config || body;
  } catch (e) {
    console.error('[LineConfig] updateConfig failed:', e.message);
    throw new Error('บันทึกไม่สำเร็จ: ' + e.message);
  }
}

function hasToken() {
  return !!(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

function getTokenPreview() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  return t ? t.slice(0, 8) + '...' : '(not set)';
}

module.exports = { getConfig, updateConfig, getBrandGroupId, getAdminGroupId, getAdminUserIds, invalidate, hasToken, getTokenPreview };
