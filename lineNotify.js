// lineNotify.js — LINE Flex Message Cards
// Admin / Engineer / Reporter — IT Support System
const axios = require('axios');
const lc    = require('./lineConfig');

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push';
const APP_URL   = process.env.APP_URL || 'https://it-service-56im.onrender.com';

function getToken() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
}

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

function textMsg(text) { return [{ type:'text', text }]; }

function fmtDate(raw) {
  try {
    const d = raw ? new Date(raw) : new Date();
    if (isNaN(d)) return raw || '-';
    const z = n => String(n).padStart(2,'0');
    return `${z(d.getDate())}/${z(d.getMonth()+1)}/${d.getFullYear()}  ${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
  } catch { return raw || '-'; }
}
function nowTH() { return fmtDate(new Date().toISOString()); }

function statusColor(s='') {
  if (/เสร็จสิ้น/.test(s)) return '#00b87a';
  if (/ระหว่าง/.test(s))   return '#3b82f6';
  if (/ตรวจ/.test(s))       return '#f59e0b';
  if (/ยกเลิก/.test(s))    return '#ef4444';
  return '#94a3b8';
}
function sLabel(s='') { return s.replace(/[⏱️⚙️✅❌✏️]/g,'').trim() || '-'; }

// ── Flex builders ────────────────────────────────────────────
function hdrBox(icon, title, subtitle, bg) {
  return {
    type:'box', layout:'vertical', backgroundColor:bg, paddingAll:'16px',
    contents:[{
      type:'box', layout:'horizontal', spacing:'md',
      contents:[
        { type:'text', text:icon, size:'xl', flex:0 },
        { type:'box', layout:'vertical', flex:1, contents:[
          { type:'text', text:title,    weight:'bold', size:'sm', color:'#ffffff', wrap:true },
          { type:'text', text:subtitle, size:'xs',     color:'#cccccc', margin:'xs', wrap:true },
        ]}
      ]
    }]
  };
}

function row(label, value, valColor='#333333') {
  return {
    type:'box', layout:'horizontal', margin:'sm', spacing:'sm',
    contents:[
      { type:'text', text:label,           size:'xs', color:'#888888', flex:3, weight:'bold' },
      { type:'text', text:String(value||'-'), size:'xs', color:valColor, flex:5, wrap:true, align:'end' },
    ]
  };
}

function sep() { return { type:'separator', margin:'md', color:'#eeeeee' }; }

function linkBtn(label, url, color='#1a73e8') {
  return {
    type:'box', layout:'vertical', margin:'md',
    backgroundColor:color, cornerRadius:'8px', paddingAll:'12px',
    action:{ type:'uri', uri:url },
    contents:[{ type:'text', text:label, color:'#ffffff', size:'sm', weight:'bold', align:'center' }]
  };
}

// ══════════════════════════════════════════
// CARD: ADMIN — Ticket ใหม่
// ══════════════════════════════════════════
function cardAdmin_NewTicket(ticket) {
  const dt = fmtDate(ticket.sentDate || ticket.createdAt) || nowTH();
  return {
    type:'flex', altText:`🎫 Ticket ใหม่ ${ticket.id||''} — ${ticket.type||''}`,
    contents:{
      type:'bubble', size:'kilo',
      header: hdrBox('🎫','Ticket ใหม่ — รอมอบหมายช่าง',`${ticket.id||'-'} · ${ticket.brand||'-'}`,'#0d1117'),
      body:{
        type:'box', layout:'vertical', paddingAll:'14px', spacing:'none',
        contents:[
          { type:'text', text:ticket.type||'-',                  weight:'bold', size:'md', color:'#111111', wrap:true },
          { type:'text', text:(ticket.detail||'-').slice(0,120), size:'xs',     color:'#555555', margin:'sm', wrap:true },
          sep(),
          row('เลข Ticket',  ticket.id||'-',        '#1a73e8'),
          row('หัวข้องาน',   ticket.type||'-',       '#333333'),
          row('รายละเอียด', (ticket.detail||'-').slice(0,80), '#555555'),
          row('แบรนด์',      ticket.brand||'-',      '#333333'),
          row('สาขา',        ticket.branchCode||'-', '#333333'),
          row('ผู้แจ้ง',     ticket.reporter||'-',   '#333333'),
          row('เบอร์',       ticket.phone||'-',      '#333333'),
          row('วันที่/เวลา', dt,                     '#888888'),
          sep(),
          linkBtn('🖥️  เปิดหน้า Admin Dashboard', `${APP_URL}/admin`, '#1a73e8'),
        ]
      }
    }
  };
}

// ══════════════════════════════════════════
// CARD: ADMIN — ช่างส่งงาน
// ══════════════════════════════════════════
function cardAdmin_WorkSubmitted(ticket) {
  const dt = fmtDate(ticket.completedAt) || nowTH();
  return {
    type:'flex', altText:`🔧 ช่างส่งงาน ${ticket.id||''} — รอตรวจรับ`,
    contents:{
      type:'bubble', size:'kilo',
      header: hdrBox('🔧','ช่างส่งงานแล้ว — รอตรวจรับ',`${ticket.id||'-'} · ${ticket.brand||'-'}`,'#071a10'),
      body:{
        type:'box', layout:'vertical', paddingAll:'14px', spacing:'none',
        contents:[
          { type:'text', text:ticket.type||'-',                  weight:'bold', size:'md', color:'#111111', wrap:true },
          { type:'text', text:(ticket.detail||'-').slice(0,100), size:'xs',     color:'#555555', margin:'sm', wrap:true },
          sep(),
          row('เลข Ticket',  ticket.id||'-',                          '#1a73e8'),
          row('หัวข้องาน',   ticket.type||'-',                         '#333333'),
          row('รายละเอียด', (ticket.detail||'-').slice(0,80),          '#555555'),
          row('แบรนด์',      ticket.brand||'-',                        '#333333'),
          row('สาขา',        ticket.branchCode||'-',                   '#333333'),
          row('ช่าง',        ticket.engineerName||'-',                 '#16a34a'),
          row('รายงานงาน',   (ticket.workDetail||'-').slice(0,80),     '#333333'),
          row('อะไหล่',      ticket.partsUsed||'-',                    '#333333'),
          row('วันที่/เวลา', dt,                                       '#888888'),
          sep(),
          linkBtn('✅  ตรวจรับงานใน Admin Dashboard', `${APP_URL}/admin`, '#16a34a'),
        ]
      }
    }
  };
}

// ══════════════════════════════════════════
// CARD: ADMIN — ปิดงาน
// ══════════════════════════════════════════
function cardAdmin_Closed(ticket) {
  const dt = fmtDate(ticket.closedAt) || nowTH();
  return {
    type:'flex', altText:`✅ ปิดงาน ${ticket.id||''} เรียบร้อย`,
    contents:{
      type:'bubble', size:'kilo',
      header: hdrBox('✅','ปิดงานเรียบร้อย',`${ticket.id||'-'} · ${ticket.brand||'-'}`,'#07120d'),
      body:{
        type:'box', layout:'vertical', paddingAll:'14px', spacing:'none',
        contents:[
          { type:'text', text:ticket.type||'-',                  weight:'bold', size:'md', color:'#111111', wrap:true },
          { type:'text', text:(ticket.detail||'-').slice(0,100), size:'xs',     color:'#555555', margin:'sm', wrap:true },
          sep(),
          row('เลข Ticket',  ticket.id||'-',                  '#1a73e8'),
          row('หัวข้องาน',   ticket.type||'-',                 '#333333'),
          row('รายละเอียด', (ticket.detail||'-').slice(0,80),  '#555555'),
          row('แบรนด์',      ticket.brand||'-',                '#333333'),
          row('สาขา',        ticket.branchCode||'-',           '#333333'),
          row('ช่าง',        ticket.engineerName||'-',         '#16a34a'),
          row('ปิดโดย',      ticket.closedBy||'-',             '#333333'),
          ...(ticket.adminNote ? [row('หมายเหตุ', ticket.adminNote.slice(0,80), '#555555')] : []),
          row('วันที่/เวลา', dt,                               '#888888'),
          sep(),
          linkBtn('🖥️  ดูรายละเอียดใน Admin', `${APP_URL}/admin`, '#0d6efd'),
        ]
      }
    }
  };
}

// ══════════════════════════════════════════
// CARD: ENGINEER — มีงานมอบหมาย
// ══════════════════════════════════════════
function cardEngineer_Assigned(ticket) {
  const dt = fmtDate(ticket.sentDate || ticket.createdAt) || nowTH();
  return {
    type:'flex', altText:`🔔 มีงานมอบหมาย ${ticket.id||''} — ${ticket.type||''}`,
    contents:{
      type:'bubble', size:'kilo',
      header: hdrBox('🔔','มีงานมอบหมายให้คุณ',`${ticket.id||'-'} · ${ticket.brand||'-'}`,'#0a1428'),
      body:{
        type:'box', layout:'vertical', paddingAll:'14px', spacing:'none',
        contents:[
          { type:'text', text:ticket.type||'-',                  weight:'bold', size:'md', color:'#111111', wrap:true },
          { type:'text', text:(ticket.detail||'-').slice(0,120), size:'xs',     color:'#555555', margin:'sm', wrap:true },
          sep(),
          row('เลข Ticket',   ticket.id||'-',         '#1a73e8'),
          row('หัวข้องาน',    ticket.type||'-',        '#333333'),
          row('รายละเอียด',  (ticket.detail||'-').slice(0,80), '#555555'),
          row('วันที่/เวลา',  dt,                      '#888888'),
          row('แบรนด์',       ticket.brand||'-',       '#333333'),
          row('สาขา',         ticket.branchCode||'-',  '#333333'),
          row('ผู้แจ้ง',      ticket.reporter||'-',    '#333333'),
          row('เบอร์ผู้แจ้ง', ticket.phone||'-',       '#333333'),
          sep(),
          linkBtn('🔧  เปิดหน้าช่าง (Engineer Portal)', `${APP_URL}/engineer`, '#7c3aed'),
        ]
      }
    }
  };
}

// ══════════════════════════════════════════
// CARD: REPORTER — รับเรื่องแล้ว
// ══════════════════════════════════════════
function cardReporter_Received(ticket) {
  const dt = fmtDate(ticket.sentDate || ticket.createdAt) || nowTH();
  return {
    type:'flex', altText:`📋 รับเรื่องแล้ว Ticket ${ticket.id||''} — ${ticket.type||''}`,
    contents:{
      type:'bubble', size:'kilo',
      header: hdrBox('📋','รับเรื่องแล้ว — กำลังดำเนินการ',`${ticket.id||'-'} · ${ticket.brand||'-'}`,'#1a1a2e'),
      body:{
        type:'box', layout:'vertical', paddingAll:'14px', spacing:'none',
        contents:[
          { type:'text', text:ticket.type||'-',                  weight:'bold', size:'md', color:'#111111', wrap:true },
          { type:'text', text:(ticket.detail||'-').slice(0,120), size:'xs',     color:'#555555', margin:'sm', wrap:true },
          sep(),
          row('เลข Ticket',  ticket.id||'-',                          '#1a73e8'),
          row('หัวข้องาน',   ticket.type||'-',                         '#333333'),
          row('รายละเอียด', (ticket.detail||'-').slice(0,80),          '#555555'),
          row('วันที่/เวลา', dt,                                       '#888888'),
          row('สาขา',        ticket.branchCode||'-',                   '#333333'),
          row('สถานะ',       sLabel(ticket.status)||'รอดำเนินการ',     statusColor(ticket.status)),
          sep(),
          linkBtn('🔍  ติดตามสถานะงาน', `${APP_URL}/report`, '#0891b2'),
        ]
      }
    }
  };
}

// ══════════════════════════════════════════
// CARD: REPORTER — งานเสร็จสิ้น
// ══════════════════════════════════════════
function cardReporter_Done(ticket) {
  const dt = fmtDate(ticket.closedAt) || nowTH();
  return {
    type:'flex', altText:`✅ งานของท่านเสร็จสิ้นแล้ว Ticket ${ticket.id||''}`,
    contents:{
      type:'bubble', size:'kilo',
      header: hdrBox('✅','งานของท่านเสร็จสิ้นแล้ว',`${ticket.id||'-'} · ${ticket.brand||'-'}`,'#07120d'),
      body:{
        type:'box', layout:'vertical', paddingAll:'14px', spacing:'none',
        contents:[
          { type:'text', text:ticket.type||'-',                  weight:'bold', size:'md', color:'#111111', wrap:true },
          { type:'text', text:(ticket.detail||'-').slice(0,100), size:'xs',     color:'#555555', margin:'sm', wrap:true },
          sep(),
          row('เลข Ticket',  ticket.id||'-',                         '#1a73e8'),
          row('หัวข้องาน',   ticket.type||'-',                        '#333333'),
          row('รายละเอียด', (ticket.detail||'-').slice(0,80),         '#555555'),
          row('วันที่/เวลา', dt,                                      '#888888'),
          row('ช่างที่ซ่อม', ticket.engineerName||'-',                '#16a34a'),
          row('รายงาน',      (ticket.workDetail||'-').slice(0,80),    '#555555'),
          ...(ticket.adminNote ? [row('หมายเหตุ', ticket.adminNote.slice(0,80), '#555555')] : []),
          sep(),
          linkBtn('🔍  ดูรายละเอียดงาน', `${APP_URL}/report`, '#16a34a'),
        ]
      }
    }
  };
}

// ══════════════════════════════════════════
// PUBLIC FUNCTIONS
// ══════════════════════════════════════════

// 1. Ticket ใหม่ → Admin Group + Reporter (ถ้ามี line_user_id)
async function notifyNewTicket(ticket) {
  const tasks = [];
  const groupId = await lc.getAdminGroupId();
  if (groupId) tasks.push(push(groupId, [cardAdmin_NewTicket(ticket)]));
  else console.warn('[LINE] notifyNewTicket: no admin group');
  if (ticket.line_user_id) tasks.push(push(ticket.line_user_id, [cardReporter_Received(ticket)]));
  await Promise.allSettled(tasks);
}

// 2. มอบหมายช่าง → Engineer LINE ส่วนตัว
async function notifyAssigned(ticket, engineerLineId) {
  if (!engineerLineId) return;
  await push(engineerLineId, [cardEngineer_Assigned(ticket)]);
}

// 3. ช่างส่งงาน → Admin LINE ส่วนตัวทุกคน
async function notifyWorkSubmitted(ticket) {
  const adminIds = await lc.getAdminUserIds();
  if (!adminIds.length) { console.warn('[LINE] notifyWorkSubmitted: no admin_user_id'); return; }
  await Promise.allSettled(adminIds.map(id => push(id, [cardAdmin_WorkSubmitted(ticket)])));
}

// 4. Admin ปิดงาน → Brand Group + Reporter
async function notifyTicketClosed(ticket) {
  const tasks = [];
  const groupId = await lc.getBrandGroupId(ticket.brand||'');
  if (groupId) {
    tasks.push(push(groupId, [cardAdmin_Closed(ticket)]));
  } else {
    const adminGroup = await lc.getAdminGroupId();
    if (adminGroup) tasks.push(push(adminGroup, [cardAdmin_Closed(ticket)]));
  }
  if (ticket.line_user_id) tasks.push(push(ticket.line_user_id, [cardReporter_Done(ticket)]));
  await Promise.allSettled(tasks);
}

// 5. Revision / Reassign
async function notifyRevision(ticket, engineerLineId) {
  if (!engineerLineId) return;
  await push(engineerLineId, textMsg(`✏️ Ticket ${ticket.id||'-'} มีการแก้ไข กรุณาตรวจสอบ`));
}

async function notifyReassigned(ticket, oldEngLineId, newEngLineId) {
  if (oldEngLineId) await push(oldEngLineId, textMsg(`🔄 Ticket ${ticket.id||'-'} ถูกโอนให้ช่างคนอื่น`));
  if (newEngLineId) await notifyAssigned(ticket, newEngLineId);
}

module.exports = {
  push, textMsg,
  notifyNewTicket, notifyWorkSubmitted,
  notifyTicketClosed, notifyAssigned,
  notifyRevision, notifyReassigned,
  cardAdmin_NewTicket, cardAdmin_WorkSubmitted, cardAdmin_Closed,
  cardEngineer_Assigned,
  cardReporter_Received, cardReporter_Done,
};
