// lineConfig.js — LINE notification target config (editable from Admin UI)
// เก็บใน memory — restart แล้วจะ fallback กลับไปใช้ค่าจาก env

const _defaults = {
  adminGroupId: '',         // LINE Group ID หลัก (แจ้งทุก event)
  brandGroups: {
    "Dunkin'": '',
    "Greyhound Cafe": '',
    "Greyhound Original": '',
    "Au Bon Pain": '',
    "Funky Fries": '',
  },
};

// โหลดค่าเริ่มต้นจาก env (ถ้ามี)
let _config = {
  adminGroupId: process.env.LINE_ADMIN_GROUP_ID || '',
  brandGroups: {
    "Dunkin'":            process.env.LINE_GROUP_DUNKIN || '',
    "Greyhound Cafe":     process.env.LINE_GROUP_GREYHOUND_CAFE || '',
    "Greyhound Original": process.env.LINE_GROUP_GREYHOUND_ORIGINAL || '',
    "Au Bon Pain":        process.env.LINE_GROUP_AU_BON_PAIN || '',
    "Funky Fries":        process.env.LINE_GROUP_FUNKY_FRIES || '',
  },
};

function getConfig() {
  return JSON.parse(JSON.stringify(_config));
}

function updateConfig(newConfig) {
  if (newConfig.adminGroupId !== undefined) {
    _config.adminGroupId = String(newConfig.adminGroupId || '').trim();
  }
  if (newConfig.brandGroups && typeof newConfig.brandGroups === 'object') {
    Object.keys(newConfig.brandGroups).forEach(brand => {
      _config.brandGroups[brand] = String(newConfig.brandGroups[brand] || '').trim();
    });
  }
  console.log('[LineConfig] Updated:', JSON.stringify(_config));
  return getConfig();
}

// ใช้โดย lineNotify.js
function getAdminGroupId() {
  return _config.adminGroupId || process.env.LINE_ADMIN_GROUP_ID || '';
}

function getBrandGroupId(brandName) {
  // หา exact match ก่อน
  if (_config.brandGroups[brandName]) return _config.brandGroups[brandName];
  // หาแบบ lowercase
  const key = Object.keys(_config.brandGroups).find(
    k => k.toLowerCase().replace(/[^a-z]/g, '') === (brandName || '').toLowerCase().replace(/[^a-z]/g, '')
  );
  return key ? _config.brandGroups[key] : '';
}

function hasToken() {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

function getTokenPreview() {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  return t ? t.slice(0, 8) + '...' + t.slice(-4) : '(not set)';
}

module.exports = { getConfig, updateConfig, getAdminGroupId, getBrandGroupId, hasToken, getTokenPreview };
