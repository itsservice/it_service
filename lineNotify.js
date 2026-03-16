// lineNotify.js — LINE Flex Message sender
// ดึงค่า Group ID จาก lineConfig.js (ตั้งผ่านหน้า Admin ได้)
const axios = require('axios');
const lineConfig = require('./lineConfig');

const AT = () => process.env.LINE_CHANNEL_ACCESS_TOKEN;
const APP_URL = () => process.env.APP_URL || 'https://it-service-56im.onrender.com';

async function push(to, messages) {
  const token = AT();
  if (!token) { console.warn('[LINE] SKIP — no LINE_CHANNEL_ACCESS_TOKEN'); return { ok:false, error:'no token' }; }
  if (!to)    { console.warn('[LINE] SKIP — no recipient'); return { ok:false, error:'no recipient' }; }
  try {
    console.log(`[LINE] Push -> ${to.slice(0,12)}...`);
    const r = await axios.post('https://api.line.me/v2/bot/message/push',
      { to, messages },
      { headers: { Authorization:'Bearer '+token, 'Content-Type':'application/json' }, timeout:10000 }
    );
    console.log(`[LINE] OK -> ${to.slice(0,12)}... (${r.status})`);
    return { ok:true };
  } catch(err) {
    console.error(`[LINE] FAIL -> ${to.slice(0,12)}...`, err.response?.data || err.message);
    return { ok:false, error: err.response?.data || err.message };
  }
}

function infoRow(label, value) {
  return { type:'box', layout:'horizontal', spacing:'sm', contents:[
    { type:'text', text:label, size:'sm', color:'#888888', flex:3, weight:'bold' },
    { type:'text', text:String(value||'-'), size:'sm', color:'#111111', flex:5, wrap:true }
  ]};
}

function makeFlex(title, subtitle, color, ticket, buttonLabel, buttonUrl) {
  const rows = [
    infoRow('Ticket', ticket.id||'-'),
    infoRow('Date', ticket.sentDate || new Date().toLocaleString('th-TH')),
    infoRow('Type', ticket.type||'-'),
    infoRow('Brand', ticket.brand||'-'),
    infoRow('Branch', ticket.branchCode||'-'),
    infoRow('Reporter', ticket.reporter||'-'),
    infoRow('Phone', ticket.phone||'-'),
  ];
  if (ticket.engineerName) rows.push(infoRow('Engineer', ticket.engineerName));
  if (ticket.status) rows.push(infoRow('Status', (ticket.status||'').replace(/[⏱️⚙️✅❌🔍✏️]/g,'').trim()));
  if (ticket.workDetail) rows.push(infoRow('Work', (ticket.workDetail||'').slice(0,80)));

  const bubble = { type:'bubble', size:'mega',
    header:{ type:'box', layout:'vertical', backgroundColor:'#000000', paddingAll:'16px', contents:[
      { type:'text', text:title, size:'sm', color:color||'#ffffff', weight:'bold' },
      { type:'text', text:subtitle, size:'lg', weight:'bold', color:'#ffffff', margin:'sm', wrap:true },
      { type:'text', text:`${ticket.brand||'-'} / ${ticket.branchCode||'-'}`, size:'xs', color:'#888888', margin:'xs' },
    ]},
    body:{ type:'box', layout:'vertical', backgroundColor:'#111111', paddingAll:'16px', spacing:'sm', contents:rows }
  };
  if (buttonLabel && buttonUrl) {
    bubble.footer = { type:'box', layout:'vertical', backgroundColor:'#111111', paddingAll:'12px', contents:[
      { type:'button', style:'primary', color:'#ffffff', action:{ type:'uri', label:buttonLabel, uri:buttonUrl } }
    ]};
  }
  return { type:'flex', altText:`${title}: ${ticket.id||''} - ${ticket.type||''}`, contents:bubble };
}

// ═══ NOTIFICATIONS ═══

async function notifyNewTicket(ticket) {
  console.log(`[LINE] notifyNewTicket: ${ticket.id} brand=${ticket.brand}`);
  const flex = makeFlex('TICKET NEW', ticket.type||'New Issue', '#00e5a0', ticket,
    'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`);
  const results = [];

  const adminGroup = lineConfig.getAdminGroupId();
  if (adminGroup) results.push(await push(adminGroup, [flex]));
  else console.warn('[LINE] No Admin Group ID set (go to Admin > LINE Settings)');

  const brandGroup = lineConfig.getBrandGroupId(ticket.brand);
  if (brandGroup && brandGroup !== adminGroup) results.push(await push(brandGroup, [flex]));

  console.log(`[LINE] notifyNewTicket: ${results.filter(r=>r.ok).length}/${results.length} sent`);
  return results;
}

async function notifyAssigned(ticket, engineerLineId) {
  console.log(`[LINE] notifyAssigned: ${ticket.id} -> ${ticket.engineerName} lineId=${engineerLineId||'NONE'}`);
  const results = [];

  if (engineerLineId) {
    const flex = makeFlex('JOB ASSIGNED', `${ticket.type||'Job'} assigned to you`, '#60a5fa', ticket,
      'Open Job', `${APP_URL()}/engineer?ticket=${ticket.id}`);
    results.push(await push(engineerLineId, [flex]));
  } else {
    console.warn(`[LINE] Engineer "${ticket.engineerName}" has no LINE User ID — skip personal msg`);
    console.warn('[LINE] Fix: Admin > Edit User > LINE User ID (get via !userid in LINE chat)');
  }

  const adminGroup = lineConfig.getAdminGroupId();
  if (adminGroup) {
    const adminFlex = makeFlex('ASSIGNED', `${ticket.id} -> ${ticket.engineerName}`, '#60a5fa', ticket,
      'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`);
    results.push(await push(adminGroup, [adminFlex]));
  }

  return results;
}

async function notifyReassigned(ticket, oldLineId, newLineId) {
  console.log(`[LINE] notifyReassigned: ${ticket.id}`);
  const results = [];
  if (oldLineId) results.push(await push(oldLineId, [makeFlex('JOB REASSIGNED', `${ticket.id} reassigned`, '#fb923c', ticket, null, null)]));
  if (newLineId) results.push(await push(newLineId, [makeFlex('NEW JOB', `${ticket.type||'Job'} assigned`, '#60a5fa', ticket, 'Open Job', `${APP_URL()}/engineer?ticket=${ticket.id}`)]));
  const adminGroup = lineConfig.getAdminGroupId();
  if (adminGroup) results.push(await push(adminGroup, [makeFlex('REASSIGNED', `${ticket.id} -> ${ticket.engineerName}`, '#fb923c', ticket, 'View Ticket', `${APP_URL()}/admin?ticket=${ticket.id}`)]));
  return results;
}

async function notifyWorkSubmitted(ticket) {
  console.log(`[LINE] notifyWorkSubmitted: ${ticket.id}`);
  const flex = makeFlex('WORK SUBMITTED', `${ticket.engineerName||'Engineer'} submitted`, '#22d3ee', ticket,
    'Review Now', `${APP_URL()}/admin?ticket=${ticket.id}`);
  const results = [];
  const adminGroup = lineConfig.getAdminGroupId();
  if (adminGroup) results.push(await push(adminGroup, [flex]));
  const brandGroup = lineConfig.getBrandGroupId(ticket.brand);
  if (brandGroup && brandGroup !== adminGroup) results.push(await push(brandGroup, [flex]));
  return results;
}

async function notifyTicketClosed(ticket) {
  console.log(`[LINE] notifyTicketClosed: ${ticket.id}`);
  const flex = makeFlex('TICKET CLOSED', `${ticket.id} completed`, '#4ade80', ticket,
    'View Summary', `${APP_URL()}/admin?ticket=${ticket.id}`);
  const results = [];
  const adminGroup = lineConfig.getAdminGroupId();
  if (adminGroup) results.push(await push(adminGroup, [flex]));
  const brandGroup = lineConfig.getBrandGroupId(ticket.brand);
  if (brandGroup && brandGroup !== adminGroup) results.push(await push(brandGroup, [flex]));
  const reporterLine = ticket.line_user_id || ticket.reporter_line_id || ticket.lineUserId;
  if (reporterLine) results.push(await push(reporterLine, [makeFlex('COMPLETED', `Ticket ${ticket.id} done`, '#4ade80', ticket, 'View', `${APP_URL()}/report`)]));
  return results;
}

async function notifyRevision(ticket, engineerLineId) {
  console.log(`[LINE] notifyRevision: ${ticket.id}`);
  if (engineerLineId) return [await push(engineerLineId, [makeFlex('REVISION', `${ticket.id} needs fix`, '#f87171', ticket, 'Fix Now', `${APP_URL()}/engineer?ticket=${ticket.id}`)])];
  return [];
}

module.exports = { push, notifyNewTicket, notifyAssigned, notifyReassigned, notifyWorkSubmitted, notifyTicketClosed, notifyRevision };
