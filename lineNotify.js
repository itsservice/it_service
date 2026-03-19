// lineNotify.js — ส่ง LINE notification
const axios  = require('axios');
const lc     = require('./lineConfig');

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push';

function getToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
}

// ── push raw ─────────────────────────────────────────────────
async function push(to, messages) {
  const token = getToken();
  if (!token) { console.warn('[LINE] No LINE_CHANNEL_ACCESS_TOKEN'); return { ok:false, error:'no token' }; }
  if (!to)    { console.warn('[LINE] No recipient');                 return { ok:false, error:'no recipient' }; }
  try {
    await axios.post(LINE_PUSH, { to, messages }, {
      headers: { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
      timeout: 10_000,
    });
    console.log(`[LINE] pushed to ${to.slice(0,8)}...`);
    return { ok:true };
  } catch (e) {
    console.error('[LINE push]', e.response?.data || e.message);
    return { ok:false, error: String(e.response?.data?.message || e.message) };
  }
}

// ── Flex helpers ──────────────────────────────────────────────
function textMsg(text) {
  return [{ type:'text', text }];
}

function statusColor(s='') {
  if (s.includes('เสร็จสิ้น')) return '#00b87a';
  if (s.includes('ระหว่าง'))  return '#3b82f6';
  if (s.includes('ตรวจ'))     return '#f59e0b';
  return '#888888';
}

function flex(title, subtitle, rows=[], footer=null, headerColor='#0d0d12') {
  const contents = [
    { type:'text', text:title,    weight:'bold', size:'md', color:'#ffffff' },
    { type:'text', text:subtitle, size:'xs',     color:'#aaaaaa', margin:'xs' },
    { type:'separator', margin:'md', color:'#333333' },
    ...rows.map(([l,v]) => ({
      type:'box', layout:'horizontal', margin:'sm',
      contents:[
        { type:'text', text:l, size:'xs', color:'#888888', flex:2 },
        { type:'text', text:String(v||'-'), size:'xs', color:'#dddddd', flex:3, align:'end', wrap:true },
      ]
    })),
  ];
  return {
    type: 'flex',
    altText: title,
    contents: {
      type: 'bubble', size: 'kilo',
      header: {
        type:'box', layout:'vertical',
        backgroundColor: headerColor, paddingAll:'14px',
        contents: contents,
      },
      ...(footer ? {
        footer: {
          type:'box', layout:'vertical', backgroundColor:'#0a0a0f', paddingAll:'10px',
          contents: [{ type:'text', text:footer, size:'xs', color:'#666666', wrap:true }]
        }
      } : {}),
    },
  };
}

// ── 1. ช่างส่งงาน → แจ้ง Admin (LINE ส่วนตัว) ────────────────
async function notifyWorkSubmitted(ticket) {
  const adminIds = await lc.getAdminUserIds();
  if (!adminIds.length) {
    console.warn('[LINE] notifyWorkSubmitted: no admin_user_id configured');
    return;
  }

  const msg = flex(
    '🔧 ช่างส่งงานแล้ว — รอตรวจรับ',
    `Ticket: ${ticket.id || ticket._recordId || '-'}`,
    [
      ['แบรนด์',   ticket.brand     || '-'],
      ['สาขา',     ticket.branchCode|| '-'],
      ['ประเภท',   ticket.type      || '-'],
      ['ช่าง',     ticket.engineerName || '-'],
      ['รายละเอียดงาน', (ticket.workDetail||'-').slice(0,60)],
      ['อะไหล่',   ticket.partsUsed || '-'],
    ],
    'กรุณาตรวจรับงานใน Admin Dashboard',
    '#071a10'
  );

  await Promise.all(adminIds.map(id => push(id, [msg])));
}

// ── 2. Admin ปิดงาน → แจ้งกลุ่ม Brand ────────────────────────
async function notifyTicketClosed(ticket) {
  const brand = ticket.brand || '';
  const groupId = await lc.getBrandGroupId(brand);
  if (!groupId) {
    console.warn(`[LINE] notifyTicketClosed: no brand group for "${brand}"`);
    // fallback: แจ้ง admin group แทน
    const adminGroup = await lc.getAdminGroupId();
    if (!adminGroup) return;
    const msg = textMsg(`✅ Ticket ${ticket.id||'-'} [${brand}] ปิดงานแล้ว\nโดย: ${ticket.closedBy||'-'}`);
    await push(adminGroup, msg);
    return;
  }

  const msg = flex(
    '✅ งานเสร็จสิ้น',
    `Ticket: ${ticket.id || ticket._recordId || '-'}`,
    [
      ['แบรนด์',   ticket.brand     || '-'],
      ['สาขา',     ticket.branchCode|| '-'],
      ['ประเภท',   ticket.type      || '-'],
      ['ช่าง',     ticket.engineerName || '-'],
      ['ปิดโดย',   ticket.closedBy  || '-'],
      ['วันที่ปิด', ticket.closedAt  || '-'],
      ...(ticket.adminNote ? [['หมายเหตุ', ticket.adminNote]] : []),
    ],
    null,
    '#07120d'
  );

  await push(groupId, [msg]);
}

// ── 3. Ticket ใหม่ → แจ้ง Admin group ────────────────────────
async function notifyNewTicket(ticket) {
  const groupId = await lc.getAdminGroupId();
  if (!groupId) return;

  const msg = flex(
    '🎫 Ticket ใหม่',
    `${ticket.type || 'แจ้งปัญหา'} — ${ticket.brand || ''}`,
    [
      ['สาขา',   ticket.branchCode || '-'],
      ['ผู้แจ้ง', ticket.reporter   || '-'],
      ['เบอร์',  ticket.phone      || '-'],
      ['รายละเอียด', (ticket.detail||'-').slice(0,80)],
    ],
    'เปิด Admin Dashboard เพื่อมอบหมายช่าง',
    '#0d0d12'
  );

  await push(groupId, [msg]);
}

// ── 4. มอบหมายช่าง → แจ้ง LINE ส่วนตัวช่าง ──────────────────
async function notifyAssigned(ticket, engineerLineId) {
  if (!engineerLineId) return;

  const msg = flex(
    '🔔 มีงานมอบหมายให้คุณ',
    `Ticket: ${ticket.id || '-'}`,
    [
      ['แบรนด์',    ticket.brand     || '-'],
      ['สาขา',      ticket.branchCode|| '-'],
      ['ประเภท',    ticket.type      || '-'],
      ['รายละเอียด',(ticket.detail||'-').slice(0,80)],
    ],
    'เปิดหน้าช่างเพื่อรับงาน',
    '#0a1428'
  );

  await push(engineerLineId, [msg]);
}

// ── 5. แก้ไข/reassign ─────────────────────────────────────────
async function notifyRevision(ticket, engineerLineId) {
  if (!engineerLineId) return;
  await push(engineerLineId, textMsg(`✏️ Ticket ${ticket.id||'-'} มีการแก้ไข กรุณาตรวจสอบ`));
}

async function notifyReassigned(ticket, oldEngLineId, newEngLineId) {
  if (oldEngLineId) await push(oldEngLineId, textMsg(`🔄 Ticket ${ticket.id||'-'} ถูกโอนให้ช่างคนอื่น`));
  if (newEngLineId) await notifyAssigned(ticket, newEngLineId);
}

module.exports = {
  push,
  notifyNewTicket,
  notifyWorkSubmitted,
  notifyTicketClosed,
  notifyAssigned,
  notifyRevision,
  notifyReassigned,
};
