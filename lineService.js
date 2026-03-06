// lineService.js — LINE push message helper
const axios = require('axios');

async function pushMessage(to, messages){
  const AT = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if(!AT){ console.warn('[LINE] No LINE_CHANNEL_ACCESS_TOKEN'); return; }
  if(!to){ console.warn('[LINE] No recipient'); return; }
  try{
    const r = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {to, messages},
      {headers:{Authorization:'Bearer '+AT,'Content-Type':'application/json'},timeout:10_000}
    );
    console.log('[LINE] Pushed to',to,'→',r.status);
    return r.data;
  }catch(err){
    console.error('[LINE push error]', err.response?.data || err.message);
  }
}

module.exports = { pushMessage };
