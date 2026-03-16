// lineNotify.js — Centralized LINE Flex Message sender for all workflow events
// Sends directly via LINE Push API — does NOT depend on Lark webhook
const axios = require('axios');

const AT = () => process.env.LINE_CHANNEL_ACCESS_TOKEN;
const APP_URL = () => process.env.APP_URL || 'https://it-service-56im.onrender.com';

// ═══ CORE PUSH ═══
async function push(to, messages) {
  const token = AT();
  if (!token) { console.warn('[LINE] No LINE_CHANNEL_ACCESS_TOKEN'); return { ok: false, error: 'no token' }; }
  if (!to) { console.warn('[LINE] No recipient'); return { ok: false, error: 'no recipient' }; }
  try {
    const r = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      { to, messages },
      { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    console.log('[LINE] Pushed to', to.slice(0, 10) + '...', 'status:', r.status);
    return { ok: true };
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[LINE push error]', errData);
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
  if (ticket.workDetail) rows.push(infoRow('Work', (ticket.workDetail || '').slice(0, 60)));

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

  return { type: 'flex', altText: `${title}: ${ticket.id || ''} — ${ticket.type || ''}`, contents: bubble };
}

function cleanStatus(s) {
  return (s || '').replace(/[⏱️⚙️✅❌🔍✏️]/g, '').trim();
}

// ═══ EVENT-SPECIFIC NOTIFICATIONS ═══

// STEP 2: New ticket created → send to brand LINE group
async function notifyNewTicket(ticket) {
  const targets = getTargets(ticket);
  const flex = makeFlex(
    'TICKET NEW', ticket.type || 'New Issue', '#00e5a0', ticket,
    'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`
  );
  const results = [];
  for (const to of targets.groups) {
    results.push(await push(to, [flex]));
  }
  // Also always send to admin group
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup && !targets.groups.includes(adminGroup)) {
    results.push(await push(adminGroup, [flex]));
  }
  return results;
}

// STEP 4: Assigned to engineer → send to engineer personal LINE
async function notifyAssigned(ticket, engineerLineId) {
  const flex = makeFlex(
    'JOB ASSIGNED', `${ticket.type || 'Job'} assigned to you`, '#60a5fa', ticket,
    'Open Job', `${APP_URL()}/engineer?ticket=${ticket.id}`
  );
  const results = [];
  if (engineerLineId) results.push(await push(engineerLineId, [flex]));
  // Also notify admin group
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) results.push(await push(adminGroup, [flex]));
  return results;
}

// STEP 5: Reassigned — notify old engineer and new engineer
async function notifyReassigned(ticket, oldEngineerLineId, newEngineerLineId) {
  const results = [];
  // Old engineer: "Job reassigned"
  if (oldEngineerLineId) {
    const oldFlex = makeFlex(
      'JOB REASSIGNED', `${ticket.id} has been reassigned to another engineer`, '#fb923c', ticket,
      null, null
    );
    results.push(await push(oldEngineerLineId, [oldFlex]));
  }
  // New engineer: "New job"
  if (newEngineerLineId) {
    const newFlex = makeFlex(
      'NEW JOB', `${ticket.type || 'Job'} assigned to you`, '#60a5fa', ticket,
      'Open Job', `${APP_URL()}/engineer?ticket=${ticket.id}`
    );
    results.push(await push(newEngineerLineId, [newFlex]));
  }
  // Admin group
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) {
    const adminFlex = makeFlex(
      'REASSIGNED', `${ticket.id} reassigned: ${ticket.engineerName}`, '#fb923c', ticket,
      'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`
    );
    results.push(await push(adminGroup, [adminFlex]));
  }
  return results;
}

// STEP 9: Engineer submits work → notify admin + brand group
async function notifyWorkSubmitted(ticket) {
  const targets = getTargets(ticket);
  const flex = makeFlex(
    'WORK SUBMITTED', `${ticket.engineerName || 'Engineer'} submitted work`, '#22d3ee', ticket,
    'Review Now', `${APP_URL()}/admin?ticket=${ticket.id}`
  );
  const results = [];
  // Admin group
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) results.push(await push(adminGroup, [flex]));
  // Brand groups
  for (const to of targets.groups) {
    if (to !== adminGroup) results.push(await push(to, [flex]));
  }
  return results;
}

// STEP 11: Ticket closed → notify brand group + reporter
async function notifyTicketClosed(ticket) {
  const targets = getTargets(ticket);
  const flex = makeFlex(
    'TICKET CLOSED', `${ticket.id} completed`, '#4ade80', ticket,
    'View Summary', `${APP_URL()}/admin?ticket=${ticket.id}`
  );
  const results = [];
  // Admin group
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
  if (adminGroup) results.push(await push(adminGroup, [flex]));
  // Brand groups
  for (const to of targets.groups) {
    if (to !== adminGroup) results.push(await push(to, [flex]));
  }
  // Reporter (if has LINE ID)
  if (ticket.line_user_id || ticket.reporter_line_id || ticket.lineUserId) {
    const reporterLine = ticket.line_user_id || ticket.reporter_line_id || ticket.lineUserId;
    const reporterFlex = makeFlex(
      'COMPLETED', `Your ticket ${ticket.id} is done`, '#4ade80', ticket,
      'View Ticket', `${APP_URL()}/brands/${(ticket.brand||'').toLowerCase().replace(/ /g,'-').replace(/'/g,'')}/track?id=${ticket.id}`
    );
    results.push(await push(reporterLine, [reporterFlex]));
  }
  return results;
}

// STEP: Send back for revision
async function notifyRevision(ticket, engineerLineId) {
  const flex = makeFlex(
    'REVISION REQUIRED', `${ticket.id} needs revision`, '#f87171', ticket,
    'Fix Now', `${APP_URL()}/engineer?ticket=${ticket.id}`
  );
  const results = [];
  if (engineerLineId) results.push(await push(engineerLineId, [flex]));
  return results;
}

// ═══ HELPERS ═══

// Get LINE targets for a ticket's brand
function getTargets(ticket) {
  const groups = [];
  const adminGroup = process.env.LINE_ADMIN_GROUP_ID;

  // Brand-specific group IDs from env
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
