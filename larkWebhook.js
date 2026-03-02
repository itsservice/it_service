const express = require('express');
const router = express.Router();

const { LARK_ENCRYPT_KEY } = require('./env');
const { decryptLark } = require('./larkCrypto');
const { linePushFlex } = require('./lineService');

router.post('/webhook', async (req, res) => {
  try {
    let body = req.body;

    console.log('\n📥 LARK RAW');
    console.log(JSON.stringify(body, null, 2));

    // DECRYPT
    if (body?.encrypt && LARK_ENCRYPT_KEY) {
      body = decryptLark(LARK_ENCRYPT_KEY, body.encrypt);
      console.log('🔓 LARK DECRYPTED');
      console.log(JSON.stringify(body, null, 2));
    }

    // URL VERIFICATION
    if (body?.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // ตอบทันที กัน timeout
    res.json({ ok: true });

    const data = body?.event || body || {};
    console.log('📦 LARK DATA:', JSON.stringify(data, null, 2));

    const recordUrl =
      typeof data.recordUrl === 'string' && data.recordUrl.trim() !== ''
        ? data.recordUrl.trim()
        : null;

    console.log('🔗 RECORD URL:', recordUrl);

    const target = data.line_user_id || data.line_group_id;
    if (!target) {
      console.log('ℹ️ Missing line_user_id / line_group_id -> skip push');
      return;
    }

    const flexMessage = {
      type: "flex",
      altText: `Ticket ${data.ticket_id || ''}`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            { type: "text", text: data.type || "Report Ticket", weight: "bold", size: "lg" },
            { type: "separator", margin: "md" },

            { type: "text", text: `Ticket ID: ${data.ticket_id || '-'}`, size: "sm", wrap: true },
            { type: "text", text: `วันที่: ${data.ticketDate || '-'}`, size: "sm", wrap: true },

            { type: "separator", margin: "md" },

            { type: "text", text: `ประเภท/อุปกรณ์: ${data.title || '-'}`, size: "sm", wrap: true },
            { type: "text", text: `รายละเอียด/อาการ: ${data.symptom || '-'}`, size: "sm", wrap: true },

            { type: "separator", margin: "md" },

            { type: "text", text: `สาขา: ${data.branch || '-'}`, size: "sm" },
            { type: "text", text: `รหัสสาขา: ${data.branch_code || '-'}`, size: "sm" },

            { type: "separator", margin: "md" },

            { type: "text", text: `เบอร์โทร: ${data.phone || '-'}`, size: "sm", wrap: true },
            { type: "text", text: `สถานะ: ${data.status || '-'}`, size: "sm", wrap: true }
          ]
        },
        footer: recordUrl
          ? {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  action: { type: "uri", label: "เปิดรายการ", uri: recordUrl }
                }
              ]
            }
          : undefined
      }
    };

    await linePushFlex(target, flexMessage);
    console.log('✅ PUSH SUCCESS');
  } catch (err) {
    console.error('❌ LARK ERROR:', err?.message || err);

    // กัน headers already sent
    if (!res.headersSent) res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
