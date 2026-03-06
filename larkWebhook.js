// larkWebhook.js — Lark events → LINE notifications (v2)
const express = require('express');
const { listTickets } = require('./larkService');
const { addLog } = require('./auth');
const router = express.Router();

async function pushLine(to, messages){
  if(!to || !process.env.LINE_CHANNEL_ACCESS_TOKEN) return;
  const axios = require('axios');
  try{
    await axios.post('https://api.line.me/v2/bot/message/push',
      {to, messages},
      {headers:{Authorization:'Bearer '+process.env.LINE_CHANNEL_ACCESS_TOKEN,'Content-Type':'application/json'},timeout:8000}
    );
  }catch(e){console.error('[LINE push]',e.response?.data||e.message);}
}

function sc(s){return{'รอตรวจงาน':'#f59e0b','อยู่ระหว่างดำเนินการ':'#3b82f6','รอชิ้นส่วน':'#a855f7','เสร็จสิ้น':'#00e5a0','ยกเลิก':'#ef4444'}[s]||'#888888';}
const URL=()=>process.env.APP_URL||'https://it-service-56im.onrender.com';

function newTicketFlex(t){
  return {type:'flex',altText:`🎫 Ticket ใหม่ ${t.id||''} — ${t.brand||''}`,contents:{type:'bubble',size:'kilo',
    header:{type:'box',layout:'vertical',backgroundColor:'#0d0d12',paddingAll:'16px',contents:[
      {type:'text',text:'🎫 Ticket ใหม่',size:'xs',color:'#00e5a0',weight:'bold'},
      {type:'text',text:t.type||'แจ้งปัญหา',size:'lg',weight:'bold',color:'#ffffff',margin:'sm'},
      {type:'text',text:`${t.brand||'-'} · ${t.branchCode||'-'}`,size:'xs',color:'#888888',margin:'xs'},
    ]},
    body:{type:'box',layout:'vertical',backgroundColor:'#141419',paddingAll:'16px',spacing:'sm',contents:[
      {type:'text',text:t.detail||'-',size:'sm',color:'#aaaaaa',wrap:true,maxLines:3},
      {type:'separator',color:'#222222',margin:'md'},
      {type:'box',layout:'horizontal',margin:'md',contents:[
        {type:'box',layout:'vertical',flex:1,contents:[{type:'text',text:'ผู้แจ้ง',size:'xxs',color:'#666666'},{type:'text',text:t.reporter||'-',size:'sm',color:'#dddddd',weight:'bold'}]},
        {type:'box',layout:'vertical',flex:1,contents:[{type:'text',text:'วันที่',size:'xxs',color:'#666666'},{type:'text',text:t.sentDate||'-',size:'sm',color:'#dddddd'}]},
      ]},
    ]},
    footer:{type:'box',layout:'vertical',backgroundColor:'#0d0d12',paddingAll:'12px',
      contents:[{type:'button',action:{type:'uri',label:'เปิด Dashboard',uri:URL()+'/admin'},style:'primary',color:'#00e5a0',height:'sm'}]
    }
  }};
}

function engineerFlex(t){
  return {type:'flex',altText:`🔧 ช่างส่งงาน ${t.id||''}`,contents:{type:'bubble',size:'kilo',
    header:{type:'box',layout:'vertical',backgroundColor:'#071a10',paddingAll:'16px',contents:[
      {type:'text',text:'🔧 ช่างส่งงานแล้ว — รอตรวจรับ',size:'xs',color:'#00e5a0',weight:'bold'},
      {type:'text',text:t.id||'',size:'sm',color:'#888888',margin:'xs'},
    ]},
    body:{type:'box',layout:'vertical',backgroundColor:'#0d1a12',paddingAll:'16px',spacing:'sm',contents:[
      {type:'text',text:t.workDetail||'-',size:'sm',color:'#bbbbbb',wrap:true,maxLines:4},
      {type:'separator',color:'#1a3020',margin:'md'},
      {type:'box',layout:'horizontal',margin:'sm',contents:[
        {type:'text',text:'ช่าง: '+(t.engineerName||'-'),size:'xs',color:'#888888',flex:1},
        {type:'text',text:'อะไหล่: '+(t.partsUsed||'-'),size:'xs',color:'#888888',flex:1,align:'end'},
      ]},
    ]},
    footer:{type:'box',layout:'vertical',backgroundColor:'#071a10',paddingAll:'12px',
      contents:[{type:'button',action:{type:'uri',label:'✅ ตรวจรับงาน',uri:URL()+'/admin'},style:'primary',color:'#00e5a0',height:'sm'}]
    }
  }};
}

function closedFlex(t){
  return {type:'flex',altText:`✅ งานเสร็จสิ้น ${t.id||''}`,contents:{type:'bubble',size:'kilo',
    header:{type:'box',layout:'vertical',backgroundColor:'#070d17',paddingAll:'16px',contents:[
      {type:'text',text:'✅ งานเสร็จสิ้น',size:'xs',color:'#3b82f6',weight:'bold'},
      {type:'text',text:t.type||'-',size:'lg',weight:'bold',color:'#ffffff',margin:'sm'},
    ]},
    body:{type:'box',layout:'vertical',backgroundColor:'#0d1221',paddingAll:'16px',spacing:'sm',contents:[
      {type:'box',layout:'horizontal',contents:[{type:'text',text:'Ticket',size:'xs',color:'#666666',flex:1},{type:'text',text:t.id||'-',size:'xs',color:'#3b82f6',align:'end',flex:1}]},
      {type:'box',layout:'horizontal',contents:[{type:'text',text:'ปิดโดย',size:'xs',color:'#666666',flex:1},{type:'text',text:t.closedBy||'-',size:'xs',color:'#bbbbbb',align:'end',flex:1}]},
      {type:'box',layout:'horizontal',contents:[{type:'text',text:'วันที่ปิด',size:'xs',color:'#666666',flex:1},{type:'text',text:t.closedAt||'-',size:'xs',color:'#bbbbbb',align:'end',flex:1}]},
      ...(t.adminNote?[{type:'separator',color:'#1a203a',margin:'md'},{type:'text',text:t.adminNote,size:'xs',color:'#888888',wrap:true,margin:'sm'}]:[]),
    ]}
  }};
}

router.post('/webhook', async (req, res) => {
  const body = req.body || {};
  if(body.challenge){ res.json({challenge:body.challenge}); return; }
  res.sendStatus(200);

  try{
    const evtType = body.event_type||body.type||'';
    const data = body.data||body.event||body;
    const rid = data.record_id||data._recordId;
    if(!rid) return;

    const tickets = await listTickets();
    const t = tickets.find(x=>x._recordId===rid);
    if(!t) return;

    const adminGroup = process.env.LINE_ADMIN_GROUP_ID;
    const broadcast  = req.app.locals?.broadcast;

    if(t.status==='เสร็จสิ้น' && t.closedBy){
      if(t.line_user_id) await pushLine(t.line_user_id,[closedFlex(t)]);
      if(t.line_group_id) await pushLine(t.line_group_id,[closedFlex(t)]);
      addLog({action:'line_notify',detail:`แจ้งผู้ใช้: งานเสร็จสิ้น ${t.id}`});
    }
    else if(t.workDetail && t.status==='รอตรวจงาน'){
      if(adminGroup) await pushLine(adminGroup,[engineerFlex(t)]);
      addLog({action:'line_notify',detail:`แจ้ง Admin: ช่างส่งงาน ${t.id}`});
    }
    else{
      if(adminGroup) await pushLine(adminGroup,[newTicketFlex(t)]);
      addLog({action:'line_notify',detail:`แจ้ง Admin: Ticket ใหม่ ${t.id}`});
    }
    if(broadcast) broadcast('ticket_updated',{recordId:rid,status:t.status,ts:new Date().toISOString()});
  }catch(err){console.error('[LarkWebhook]',err.message);}
});

module.exports = router;
