// larkWebhook.js — Lark events → LINE notifications
const express = require('express');
const axios   = require('axios');
const { getTicket, invalidateCache } = require('./larkService');
const { addLog } = require('./auth');
const router = express.Router();

const URL = () => process.env.APP_URL || 'https://it-service-56im.onrender.com';

async function pushLine(to, messages) {
  const AT = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!to || !AT) return;
  try {
    await axios.post('https://api.line.me/v2/bot/message/push',
      { to, messages },
      { headers:{ Authorization:'Bearer '+AT, 'Content-Type':'application/json' }, timeout:8000 }
    );
    console.log('[LINE] push to', to.slice(0,8)+'...');
  } catch(e) { console.error('[LINE push]', e.response?.data || e.message); }
}

function newTicketFlex(t) {
  return { type:'flex', altText:`🎫 Ticket ใหม่ ${t.id||''} — ${t.type||''}`, contents:{ type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#0d0d12', paddingAll:'16px', contents:[
      { type:'text', text:'🎫 Ticket ใหม่', size:'xs', color:'#00e5a0', weight:'bold' },
      { type:'text', text:t.type||'แจ้งปัญหา', size:'lg', weight:'bold', color:'#ffffff', margin:'sm' },
      { type:'text', text:`${t.brand||'-'} · ${t.branchCode||'-'}`, size:'xs', color:'#888888', margin:'xs' },
    ]},
    body:{ type:'box', layout:'vertical', backgroundColor:'#141419', paddingAll:'16px', spacing:'sm', contents:[
      { type:'text', text:t.detail||'-', size:'sm', color:'#aaaaaa', wrap:true, maxLines:3 },
      { type:'separator', color:'#222222', margin:'md' },
      { type:'box', layout:'horizontal', margin:'md', contents:[
        { type:'box', layout:'vertical', flex:1, contents:[{ type:'text', text:'ผู้แจ้ง', size:'xxs', color:'#666666' },{ type:'text', text:t.reporter||'-', size:'sm', color:'#dddddd', weight:'bold' }]},
        { type:'box', layout:'vertical', flex:1, contents:[{ type:'text', text:'เบอร์', size:'xxs', color:'#666666' },{ type:'text', text:t.phone||'-', size:'sm', color:'#dddddd' }]},
      ]},
    ]},
    footer:{ type:'box', layout:'vertical', backgroundColor:'#0d0d12', paddingAll:'12px',
      contents:[{ type:'button', action:{ type:'uri', label:'เปิด Dashboard', uri:URL()+'/admin' }, style:'primary', color:'#00e5a0', height:'sm' }]
    }
  }};
}

function engineerFlex(t) {
  return { type:'flex', altText:`🔧 ช่างส่งงาน ${t.id||''} รอตรวจ`, contents:{ type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#071a10', paddingAll:'16px', contents:[
      { type:'text', text:'🔧 ช่างส่งงานแล้ว — รอตรวจรับ', size:'xs', color:'#00e5a0', weight:'bold' },
      { type:'text', text:t.id||'', size:'sm', color:'#888888', margin:'xs' },
    ]},
    body:{ type:'box', layout:'vertical', backgroundColor:'#0d1a12', paddingAll:'16px', spacing:'sm', contents:[
      { type:'text', text:t.workDetail||'-', size:'sm', color:'#bbbbbb', wrap:true, maxLines:4 },
      { type:'separator', color:'#1a3020', margin:'md' },
      { type:'box', layout:'horizontal', margin:'sm', contents:[
        { type:'text', text:'ช่าง: '+(t.engineerName||'-'), size:'xs', color:'#888888', flex:1 },
        { type:'text', text:'อะไหล่: '+(t.partsUsed||'-'), size:'xs', color:'#888888', flex:1, align:'end' },
      ]},
    ]},
    footer:{ type:'box', layout:'vertical', backgroundColor:'#071a10', paddingAll:'12px',
      contents:[{ type:'button', action:{ type:'uri', label:'✅ ตรวจรับงาน', uri:URL()+'/admin' }, style:'primary', color:'#00e5a0', height:'sm' }]
    }
  }};
}

function assignedFlex(t) {
  return { type:'flex', altText:`🔧 มอบหมายช่างแล้ว ${t.id||''}`, contents:{ type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#0a1428', paddingAll:'16px', contents:[
      { type:'text', text:'🔧 มอบหมายช่างแล้ว', size:'xs', color:'#3b82f6', weight:'bold' },
      { type:'text', text:t.type||'แจ้งปัญหา', size:'lg', weight:'bold', color:'#ffffff', margin:'sm' },
    ]},
    body:{ type:'box', layout:'vertical', backgroundColor:'#0d1221', paddingAll:'16px', spacing:'sm', contents:[
      { type:'box', layout:'horizontal', contents:[
        { type:'text', text:'Ticket', size:'xs', color:'#666666', flex:1 },
        { type:'text', text:t.id||'-', size:'xs', color:'#3b82f6', align:'end', flex:1 }
      ]},
      { type:'box', layout:'horizontal', contents:[
        { type:'text', text:'ช่างผู้รับงาน', size:'xs', color:'#666666', flex:1 },
        { type:'text', text:t.engineerName||'-', size:'xs', color:'#ffffff', align:'end', flex:1, weight:'bold' }
      ]},
      { type:'box', layout:'horizontal', contents:[
        { type:'text', text:'สาขา', size:'xs', color:'#666666', flex:1 },
        { type:'text', text:t.branchCode||'-', size:'xs', color:'#bbbbbb', align:'end', flex:1 }
      ]},
    ]},
    footer:{ type:'box', layout:'vertical', backgroundColor:'#0a1428', paddingAll:'12px',
      contents:[{ type:'button', action:{ type:'uri', label:'ดูสถานะงาน', uri:URL()+'/report' }, style:'primary', color:'#3b82f6', height:'sm' }]
    }
  }};
}

function closedFlex(t) {
  return { type:'flex', altText:`✅ งานเสร็จสิ้น ${t.id||''}`, contents:{ type:'bubble', size:'kilo',
    header:{ type:'box', layout:'vertical', backgroundColor:'#070d17', paddingAll:'16px', contents:[
      { type:'text', text:'✅ งานเสร็จสิ้น', size:'xs', color:'#3b82f6', weight:'bold' },
      { type:'text', text:t.type||'-', size:'lg', weight:'bold', color:'#ffffff', margin:'sm' },
    ]},
    body:{ type:'box', layout:'vertical', backgroundColor:'#0d1221', paddingAll:'16px', spacing:'sm', contents:[
      { type:'box', layout:'horizontal', contents:[{ type:'text', text:'Ticket', size:'xs', color:'#666666', flex:1 },{ type:'text', text:t.id||'-', size:'xs', color:'#3b82f6', align:'end', flex:1 }]},
      { type:'box', layout:'horizontal', contents:[{ type:'text', text:'ปิดโดย', size:'xs', color:'#666666', flex:1 },{ type:'text', text:t.closedBy||'-', size:'xs', color:'#bbbbbb', align:'end', flex:1 }]},
      { type:'box', layout:'horizontal', contents:[{ type:'text', text:'วันที่ปิด', size:'xs', color:'#666666', flex:1 },{ type:'text', text:t.closedAt||'-', size:'xs', color:'#bbbbbb', align:'end', flex:1 }]},
      ...(t.adminNote ? [{ type:'separator', color:'#1a203a', margin:'md' },{ type:'text', text:t.adminNote, size:'xs', color:'#888888', wrap:true, margin:'sm' }] : []),
    ]}
  }};
}

router.post('/webhook', async (req, res) => {
  const body = req.body || {};

  // Lark challenge verification
  if (body.challenge) { res.json({ challenge:body.challenge }); return; }
  res.sendStatus(200); // ตอบ Lark ก่อนเสมอ

  try {
    console.log('[LarkWebhook] received:', JSON.stringify(body).slice(0, 300));

    // รองรับหลายรูปแบบจาก Lark Automation
    const rid      = body.record_id || body.data?.record_id || body.recordId || null;
    const ticketId = body.ticket_id || body.ticketId || null; // เช่น "GD-00050"

    if (!rid && !ticketId) {
      console.warn('[LarkWebhook] no record_id or ticket_id:', JSON.stringify(body).slice(0,200));
      return;
    }

    // Invalidate cache + fetch fresh
    invalidateCache();
    await new Promise(r => setTimeout(r, 800));

    let t = null;
    if (rid) {
      t = await getTicket(rid);
    } else {
      // ค้นหาจาก ticket_id (GD-XXXXX) ใน cache
      const { listTickets } = require('./larkService');
      const all = await listTickets({ noCache: true });
      t = all.find(x => x.id === ticketId || x.id === String(ticketId).trim());
    }
    if (!t) { console.warn('[LarkWebhook] ticket not found rid=%s tid=%s', rid, ticketId); return; }

    console.log(`[LarkWebhook] ticket=${t.id} status="${t.status}"`);

    const adminGroup   = process.env.LINE_ADMIN_GROUP_ID;
    const broadcast    = req.app.locals?.broadcast;

    // line_user_id: จาก body (Lark ส่งมา) หรือจาก ticket field
    const lineUserId   = body.line_user_id || t.line_user_id || null;
    const lineGroupId  = body.line_group_id || t.line_group_id || null;

    // เทียบสถานะ (strip emoji ก่อน)
    const rawStatus = (t.status || body.status || '').replace(/[✅⚙️⏱️❌🔍✏️]/g,'').trim();

    if (rawStatus === 'เสร็จสิ้น') {
      if (lineUserId)  await pushLine(lineUserId,  [closedFlex(t)]);
      if (lineGroupId) await pushLine(lineGroupId, [closedFlex(t)]);
      if (adminGroup)  await pushLine(adminGroup,  [closedFlex(t)]);
      addLog({ action:'line_notify', detail:`ปิดงาน: ${t.id}` });

    } else if (rawStatus === 'ตรวจงาน') {
      if (adminGroup) await pushLine(adminGroup, [engineerFlex(t)]);
      addLog({ action:'line_notify', detail:`ช่างส่งงาน: ${t.id}` });

    } else if (rawStatus === 'อยู่ระหว่างดำเนินการ') {
      if (lineUserId)  await pushLine(lineUserId,  [assignedFlex(t)]);
      if (adminGroup)  await pushLine(adminGroup,  [assignedFlex(t)]);
      addLog({ action:'line_notify', detail:`มอบหมายช่าง: ${t.id}` });

    } else {
      // Ticket ใหม่ หรือสถานะอื่น → แจ้ง Admin
      if (adminGroup) await pushLine(adminGroup, [newTicketFlex(t)]);
      addLog({ action:'line_notify', detail:`Ticket ใหม่/อัพเดท: ${t.id}` });
    }

    if (broadcast) broadcast('ticket_updated', { recordId:rid, status:t.status, ts:new Date().toISOString() });

  } catch(err) { console.error('[LarkWebhook] ERROR:', err.message); }
});

module.exports = router;
