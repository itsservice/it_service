// lineNotify.js — LINE Flex Message sender for all workflow events
// ส่งโดยตรงผ่าน LINE Push API — ไม่ต้องพึ่ง Lark webhook
const axios = require('axios');

const AT = () => process.env.LINE_CHANNEL_ACCESS_TOKEN;
const APP_URL = () => process.env.APP_URL || 'https://it-service-56im.onrender.com';

// ═══ CORE PUSH ═══
async function push(to, messages) {
  const token = AT();
  if (!token) {
    console.warn('[LINE] SKIP — LINE_CHANNEL_ACCESS_TOKEN not set');
    return { ok: false, error: 'no token' };
  }
  if (!to) {
    console.warn('[LINE] SKIP — no recipient (to is empty)');
    return { ok: false, error: 'no recipient' };
  }
  try {
    console.log(`[LINE] Pushing to ${to.slice(0, 12)}... (${messages.length} msg)`);
    const r = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      { to, messages },
      { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    console.log(`[LINE] OK -> ${to.slice(0, 12)}... status:${r.status}`);
    return { ok: true };
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error(`[LINE] FAIL -> ${to.slice(0, 12)}...`, JSON.stringify(errData));
    return { ok: false, error: errData };
  }
}

// ═══ FLEX MESSAGE BUILDERS ═══

function infoRow(label, value) {
  return {
    type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
      { type: 'text', text: label, size: 'sm', color: '#888888', flex: 3, weight: 'bold' },
      { type: 'text', text: String(value || '-'), size: 'sm', color: '#111111', flex: 5, wrap: true }
    ]
  };
}

function makeFlex(title, subtitle, color, ticket, buttonLabel, buttonUrl) {
  const rows = [
    infoRow('Ticket', ticket.id || '-'),
    infoRow('Date', ticket.sentDate || new Date().toLocaleString('th-TH')),
    infoRow('Type', ticket.type || '-'),
    infoRow('Brand', ticket.brand || '-'),
    infoRow('Branch', ticket.branchCode || '-'),
    infoRow('Reporter', ticket.reporter || '-'),
    infoRow('Phone', ticket.phone || '-'),
  ];
  if (ticket.engineerName) rows.push(infoRow('Engineer', ticket.engineerName));
  if (ticket.status) rows.push(infoRow('Status', cleanStatus(ticket.status)));
  if (ticket.workDetail) rows.push(infoRow('Work', (ticket.workDetail || '').slice(0, 80)));

  const bubble = {
    type: 'bubble', size: 'mega',
    header: {
      type: 'box', layout: 'vertical', backgroundColor: '#000000', paddingAll: '16px', contents: [
        { type: 'text', text: title, size: 'sm', color: color || '#ffffff', weight: 'bold' },
        { type: 'text', text: subtitle, size: 'lg', weight: 'bold', color: '#ffffff', margin: 'sm', wrap: true },
        { type: 'text', text: `${ticket.brand || '-'} / ${ticket.branchCode || '-'}`, size: 'xs', color: '#888888', margin: 'xs' },
      ]
    },
    body: {
      type: 'box', layout: 'vertical', backgroundColor: '#111111', paddingAll: '16px', spacing: 'sm',
      contents: rows
    }
  };

  if (buttonLabel && buttonUrl) {
    bubble.footer = {
      type: 'box', layout: 'vertical', backgroundColor: '#111111', paddingAll: '12px', contents: [
        {
          type: 'button', style: 'primary', color: '#ffffff',
          action: { type: 'uri', label: buttonLabel, uri: buttonUrl }
        }
      ]
    };
  }

  return { type: 'flex', altText: `${title}: ${ticket.id || ''} - ${ticket.type || ''}`, contents: bubble };
}

function cleanStatus(s) {
  return (s || '').replace(/[⏱️⚙️✅❌🔍✏️]/g, '').trim();
}

// ═══ EVENT NOTIFICATIONS ═══

// STEP 2: Ticket ใหม่ -> Admin Group + Brand Group
async function notifyNewTicket(ticket) {
  console.log(`[LINE] notifyNewTicket: ${ticket.id} brand=${ticket.brand}`);
  const targets = getTargets(ticket);
  const flex = makeFlex(
    'TICKET NEW', ticket.type || 'New Issue', '#00e5a0', ticket,
    'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`
  );
  const results = [];

  // Admin group (ส่งเสมอ)
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) {
    console.log(`[LINE] -> Admin Group: ${adminGroup.slice(0,12)}...`);
    results.push(await push(adminGroup, [flex]));
  } else {
    console.warn('[LINE] LINE_ADMIN_GROUP_ID not set — skip admin group');
  }

  // Brand groups
  for (const to of targets.groups) {
    if (to !== adminGroup) {
      console.log(`[LINE] -> Brand Group: ${to.slice(0,12)}...`);
      results.push(await push(to, [flex]));
    }
  }

  console.log(`[LINE] notifyNewTicket done: ${results.length} sent, ok=${results.filter(r=>r.ok).length}`);
  return results;
}

// STEP 4: มอบหมายช่าง -> ช่าง (ส่วนตัว) + Admin Group
async function notifyAssigned(ticket, engineerLineId) {
  console.log(`[LINE] notifyAssigned: ${ticket.id} eng=${ticket.engineerName} lineId=${engineerLineId || 'NONE'}`);
  const flex = makeFlex(
    'JOB ASSIGNED', `${ticket.type || 'Job'} assigned to you`, '#60a5fa', ticket,
    'Open Job', `${APP_URL()}/engineer?ticket=${ticket.id}`
  );
  const results = [];

  // ช่าง (ส่วนตัว)
  if (engineerLineId) {
    console.log(`[LINE] -> Engineer personal: ${engineerLineId.slice(0,12)}...`);
    results.push(await push(engineerLineId, [flex]));
  } else {
    console.warn(`[LINE] Engineer "${ticket.engineerName}" has no LINE User ID — skip personal notification`);
    console.warn('[LINE] Fix: Admin > Edit User > fill LINE User ID (user types !userid in LINE chat with bot)');
  }

  // Admin group (ส่งเสมอเมื่อมอบหมาย)
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) {
    const adminFlex = makeFlex(
      'ASSIGNED', `${ticket.id} -> ${ticket.engineerName}`, '#60a5fa', ticket,
      'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`
    );
    results.push(await push(adminGroup, [adminFlex]));
  }

  console.log(`[LINE] notifyAssigned done: ${results.filter(r=>r.ok).length}/${results.length} ok`);
  return results;
}

// STEP 5: เปลี่ยนช่าง -> ช่างเก่า + ช่างใหม่ + Admin Group
async function notifyReassigned(ticket, oldEngineerLineId, newEngineerLineId) {
  console.log(`[LINE] notifyReassigned: ${ticket.id} old=${oldEngineerLineId||'NONE'} new=${newEngineerLineId||'NONE'}`);
  const results = [];

  if (oldEngineerLineId) {
    const oldFlex = makeFlex(
      'JOB REASSIGNED', `${ticket.id} has been reassigned`, '#fb923c', ticket, null, null
    );
    results.push(await push(oldEngineerLineId, [oldFlex]));
  }

  if (newEngineerLineId) {
    const newFlex = makeFlex(
      'NEW JOB', `${ticket.type || 'Job'} assigned to you`, '#60a5fa', ticket,
      'Open Job', `${APP_URL()}/engineer?ticket=${ticket.id}`
    );
    results.push(await push(newEngineerLineId, [newFlex]));
  }

  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) {
    const adminFlex = makeFlex(
      'REASSIGNED', `${ticket.id} -> ${ticket.engineerName}`, '#fb923c', ticket,
      'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`
    );
    results.push(await push(adminGroup, [adminFlex]));
  }

  return results;
}

// STEP 9: ช่างส่งงาน -> Admin Group + Brand Group
async function notifyWorkSubmitted(ticket) {
  console.log(`[LINE] notifyWorkSubmitted: ${ticket.id} eng=${ticket.engineerName}`);
  const targets = getTargets(ticket);
  const flex = makeFlex(
    'WORK SUBMITTED', `${ticket.engineerName || 'Engineer'} submitted work`, '#22d3ee', ticket,
    'Review Now', `${APP_URL()}/admin?ticket=${ticket.id}`
  );
  const results = [];

  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) results.push(await push(adminGroup, [flex]));

  for (const to of targets.groups) {
    if (to !== adminGroup) results.push(await push(to, [flex]));
  }

  console.log(`[LINE] notifyWorkSubmitted done: ${results.filter(r=>r.ok).length}/${results.length} ok`);
  return results;
}

// STEP 11: ปิดงาน -> Admin Group + Brand Group + ผู้แจ้ง
async function notifyTicketClosed(ticket) {
  console.log(`[LINE] notifyTicketClosed: ${ticket.id}`);
  const targets = getTargets(ticket);
  const flex = makeFlex(
    'TICKET CLOSED', `${ticket.id} completed`, '#4ade80', ticket,
    'View Summary', `${APP_URL()}/admin?ticket=${ticket.id}`
  );
  const results = [];

  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) results.push(await push(adminGroup, [flex]));

  for (const to of targets.groups) {
    if (to !== adminGroup) results.push(await push(to, [flex]));
  }

  const reporterLine = ticket.line_user_id || ticket.reporter_line_id || ticket.lineUserId;
  if (reporterLine) {
    const reporterFlex = makeFlex(
      'COMPLETED', `Your ticket ${ticket.id} is done`, '#4ade80', ticket,
      'View Ticket', `${APP_URL()}/report`
    );
    results.push(await push(reporterLine, [reporterFlex]));
  }

  console.log(`[LINE] notifyTicketClosed done: ${results.filter(r=>r.ok).length}/${results.length} ok`);
  return results;
}

// ส่งกลับแก้ไข -> ช่าง
async function notifyRevision(ticket, engineerLineId) {
  console.log(`[LINE] notifyRevision: ${ticket.id} eng=${engineerLineId||'NONE'}`);
  const flex = makeFlex(
    'REVISION REQUIRED', `${ticket.id} needs revision`, '#f87171', ticket,
    'Fix Now', `${APP_URL()}/engineer?ticket=${ticket.id}`
  );
  if (engineerLineId) return [await push(engineerLineId, [flex])];
  console.warn('[LINE] No engineer LINE ID for revision notification');
  return [];
}

// ═══ HELPERS ═══

function getTargets(ticket) {
  const groups = [];
  const brand = (ticket.brand || '').toLowerCase().replace(/[^a-z]/g, '');
  const brandGroupEnv = {
    dunkin: 'LINE_GROUP_DUNKIN',
    greyhoundcafe: 'LINE_GROUP_GREYHOUND_CAFE',
    greyhoundoriginal: 'LINE_GROUP_GREYHOUND_ORIGINAL',
    aubonpain: 'LINE_GROUP_AU_BON_PAIN',
    funkyfries: 'LINE_GROUP_FUNKY_FRIES',
  };

  const envKey = brandGroupEnv[brand];
  if (envKey && process.env[envKey]) {
    groups.push(process.env[envKey]);
  } else {
    console.log(`[LINE] No brand-specific group for "${ticket.brand}" (env: ${envKey || 'unknown'} = not set)`);
  }

  return { groups };
}

module.exports = {
  push,
  notifyNewTicket,
  notifyAssigned,
  notifyReassigned,
  notifyWorkSubmitted,
  notifyTicketClosed,
  notifyRevision,
};
