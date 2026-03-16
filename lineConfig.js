// lineConfig.js — LINE notification target config
// MySQL-backed — ตั้งค่าผ่านหน้า Admin ได้
// Fallback: ใช้ memory + env ถ้า DB ไม่พร้อม

let db = null;
let useDB = false;

// In-memory config (loaded from DB on startup, or from env)
let _config = {
  adminGroupId: process.env.LINE_ADMIN_GROUP_ID || '',
  brandGroups: {
    "Dunkin'": process.env.LINE_GROUP_DUNKIN || '',
    "Greyhound Cafe": process.env.LINE_GROUP_GREYHOUND_CAFE || '',
    "Greyhound Original": process.env.LINE_GROUP_GREYHOUND_ORIGINAL || '',
    "Au Bon Pain": process.env.LINE_GROUP_AU_BON_PAIN || '',
    "Funky Fries": process.env.LINE_GROUP_FUNKY_FRIES || '',
  },
};

const BRAND_KEY_MAP = {
  "Dunkin'": 'brand_group_dunkin',
  "Greyhound Cafe": 'brand_group_greyhound_cafe',
  "Greyhound Original": 'brand_group_greyhound_original',
  "Au Bon Pain": 'brand_group_au_bon_pain',
  "Funky Fries": 'brand_group_funky_fries',
};

// ── Init: load from DB ──────────────────────────────
async function initDB() {
  try {
    db = require('./db');
    const [rows] = await db.query('SELECT config_key, config_value FROM line_config');
    if (rows.length) {
      useDB = true;
      rows.forEach(r => {
        if (r.config_key === 'admin_group_id') _config.adminGroupId = r.config_value || '';
        Object.entries(BRAND_KEY_MAP).forEach(([brand, key]) => {
          if (r.config_key === key) _config.brandGroups[brand] = r.config_value || '';
        });
      });
      console.log('[LineConfig] Loaded from MySQL:', JSON.stringify(_config));
    }
  } catch (e) {
    console.warn('[LineConfig] MySQL not available:', e.message, '— using env/memory');
  }
}
initDB();

// ── GETTERS ─────────────────────────────────────────

function getConfig() {
  return JSON.parse(JSON.stringify(_config));
}

function getAdminGroupId() {
  return _config.adminGroupId || process.env.LINE_ADMIN_GROUP_ID || '';
}

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
  return t ? t.slice(0, 8) + '...' + t.slice(-4) : '(not set — ตั้งใน Render env)';
}

// ── UPDATE (save to DB + memory) ────────────────────

async function updateConfig(newConfig) {
  // Update memory
  if (newConfig.adminGroupId !== undefined) {
    _config.adminGroupId = String(newConfig.adminGroupId || '').trim();
  }
  if (newConfig.brandGroups && typeof newConfig.brandGroups === 'object') {
    Object.keys(newConfig.brandGroups).forEach(brand => {
      if (_config.brandGroups.hasOwnProperty(brand)) {
        _config.brandGroups[brand] = String(newConfig.brandGroups[brand] || '').trim();
      }
    });
  }

  // Save to DB
  if (useDB && db) {
    try {
      await db.query(
        'INSERT INTO line_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)',
        ['admin_group_id', _config.adminGroupId]
      );
      for (const [brand, dbKey] of Object.entries(BRAND_KEY_MAP)) {
        await db.query(
          'INSERT INTO line_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)',
          [dbKey, _config.brandGroups[brand] || '']
        );
      }
      console.log('[LineConfig] Saved to MySQL');
    } catch (e) {
      console.error('[LineConfig] DB save error:', e.message);
    }
  }

  console.log('[LineConfig] Updated:', JSON.stringify(_config));
  return getConfig();
}

module.exports = { getConfig, updateConfig, getAdminGroupId, getBrandGroupId, hasToken, getTokenPreview };
