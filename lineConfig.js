// lineConfig.js — LINE config via FastAPI → MySQL
const axios = require('axios');

const API = process.env.FASTAPI_URL || 'https://repair.mobile1234.site';
const KEY = process.env.FASTAPI_KEY || 'repair123';
const hdr = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };

let _config = {
  adminGroupId: process.env.LINE_ADMIN_GROUP_ID || '',
  brandGroups: {
    "Dunkin'": '', "Greyhound Cafe": '', "Greyhound Original": '',
    "Au Bon Pain": '', "Funky Fries": '',
  },
};

const KEY_MAP = {
  admin_group_id: 'adminGroupId',
  brand_group_dunkin: "Dunkin'",
  brand_group_greyhound_cafe: "Greyhound Cafe",
  brand_group_greyhound_original: "Greyhound Original",
  brand_group_au_bon_pain: "Au Bon Pain",
  brand_group_funky_fries: "Funky Fries",
};

const REVERSE_MAP = {
  "Dunkin'": 'brand_group_dunkin',
  "Greyhound Cafe": 'brand_group_greyhound_cafe',
  "Greyhound Original": 'brand_group_greyhound_original',
  "Au Bon Pain": 'brand_group_au_bon_pain',
  "Funky Fries": 'brand_group_funky_fries',
};

// Load from FastAPI on startup
async function init() {
  try {
    const r = await axios.get(`${API}/api/line-config`, { headers: hdr, timeout: 8000 });
    const cfg = r.data.config || {};
    if (cfg.admin_group_id) _config.adminGroupId = cfg.admin_group_id;
    Object.entries(KEY_MAP).forEach(([dbKey, target]) => {
      if (dbKey === 'admin_group_id') return;
      if (cfg[dbKey]) _config.brandGroups[target] = cfg[dbKey];
    });
    console.log('[LineConfig] Loaded from DB:', JSON.stringify(_config));
  } catch (e) {
    console.warn('[LineConfig] FastAPI load fail:', e.message, '— using env');
  }
}
init();

function getConfig() { return JSON.parse(JSON.stringify(_config)); }
function getAdminGroupId() { return _config.adminGroupId || process.env.LINE_ADMIN_GROUP_ID || ''; }
function getBrandGroupId(brandName) {
  if (_config.brandGroups[brandName]) return _config.brandGroups[brandName];
  const key = Object.keys(_config.brandGroups).find(
    k => k.toLowerCase().replace(/[^a-z]/g, '') === (brandName || '').toLowerCase().replace(/[^a-z]/g, '')
  );
  return key ? _config.brandGroups[key] : '';
}
function hasToken() { return !!process.env.LINE_CHANNEL_ACCESS_TOKEN; }
function getTokenPreview() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  return t ? t.slice(0, 8) + '...' + t.slice(-4) : '(not set)';
}

async function updateConfig(newConfig) {
  if (newConfig.adminGroupId !== undefined) _config.adminGroupId = String(newConfig.adminGroupId || '').trim();
  if (newConfig.brandGroups) {
    Object.keys(newConfig.brandGroups).forEach(b => {
      if (_config.brandGroups.hasOwnProperty(b)) _config.brandGroups[b] = String(newConfig.brandGroups[b] || '').trim();
    });
  }

  // Save to DB via FastAPI
  try {
    const payload = { admin_group_id: _config.adminGroupId };
    Object.entries(REVERSE_MAP).forEach(([brand, dbKey]) => {
      payload[dbKey] = _config.brandGroups[brand] || '';
    });
    await axios.patch(`${API}/api/line-config`, payload, { headers: hdr, timeout: 8000 });
    console.log('[LineConfig] Saved to DB');
  } catch (e) {
    console.error('[LineConfig] Save fail:', e.message);
  }

  return getConfig();
}

module.exports = { getConfig, updateConfig, getAdminGroupId, getBrandGroupId, hasToken, getTokenPreview };
