// lineWebhook.js — LINE Messaging API webhook (v2, no dotenv)
const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const router  = express.Router();

function verifySignature(body, signature){
  const secret = process.env.LINE_CHANNEL_SECRET;
  if(!secret) return true;
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  return hash === signature;
}

router.post('/webhook', (req, res) => {
  const sig = req.headers['x-line-signature'];
  if(req.rawBody && !verifySignature(req.rawBody, sig)){
    return res.status(403).send('Invalid signature');
  }
  res.sendStatus(200);

  const events = (req.body && req.body.events) || [];
  events.forEach(async evt => {
    try{
      if(evt.type === 'message' && evt.message?.type === 'text'){
        const text    = evt.message.text.trim().toLowerCase();
        const replyTo = evt.replyToken;
        const userId  = evt.source?.userId;
        const groupId = evt.source?.groupId;

        if(text === '!groupid' && groupId){
          await reply(replyTo, `Group ID:\n${groupId}\n\nใช้ตั้งค่า LINE_ADMIN_GROUP_ID ใน Render`);
        } else if(text === '!userid' && userId){
          await reply(replyTo, `User ID:\n${userId}`);
        } else if(text === '!help'){
          await reply(replyTo, '🤖 IT Ticket Bot\n\n!groupid — ดู Group ID\n!userid — ดู User ID\n!status — สถานะระบบ');
        } else if(text === '!status'){
          await reply(replyTo, `✅ IT Ticket System Online\n${new Date().toLocaleString('th-TH')}`);
        }
      }
    }catch(err){
      console.error('[LINE webhook]', err.message);
    }
  });
});

async function reply(token, text){
  const AT = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if(!AT || !token) return;
  await axios.post('https://api.line.me/v2/bot/message/reply',
    {replyToken: token, messages:[{type:'text',text}]},
    {headers:{Authorization:'Bearer '+AT,'Content-Type':'application/json'},timeout:8000}
  ).catch(e => console.error('[LINE reply]', e.response?.data||e.message));
}

module.exports = router;
