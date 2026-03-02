const express = require('express');
const router = express.Router();

const { linePushFlex } = require('../services/lineService');
const { decryptLark } = require('../services/larkCrypto');
const { LARK_ENCRYPT_KEY } = require('../config/env');

// ======================================================
// LARK WEBHOOK
// ======================================================
router.post('/webhook', async (req, res) => {
  try {
    let body = req.body;

    console.log('\n📥 LARK RAW');
    console.log(JSON.stringify(body, null, 2));

    // ================= DECRYPT =================
    if (body.encrypt && LARK_ENCRYPT_KEY) {
      body = decryptLark(LARK_ENCRYPT_KEY, body.encrypt);
      console.log('🔓 LARK DECRYPTED');
      console.log(JSON.stringify(body, null, 2));
    }

    // ================= URL VERIFICATION =================
    if (body.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    // ตอบทันที กัน timeout
    res.json({ ok: true });

    const data = body.event || body;

    console.log('📦 LARK DATA:', JSON.stringify(data, null, 2));

    // ================= URL =================
    const recordUrl =
      data.recordUrl && data.recordUrl.trim() !== ''
        ? data.recordUrl
        : null;

    console.log('🔗 RECORD URL:', recordUrl);

    // ================= SEND TO LINE =================
    if (data.line_user_id || data.line_group_id) {
      const target = data.line_user_id || data.line_group_id;

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
              {
                type: "text",
                text: data.type || "Report Ticket",
                weight: "bold",
                size: "lg"
              },

              { type: "separator", margin: "md" },

              {
                type: "text",
                text: `Ticket ID: ${data.ticket_id || '-'}`,
                size: "sm",
                wrap: true
              },
              {
                type: "text",
                text: `วันที่: ${data.ticketDate || '-'}`,
                size: "sm",
                wrap: true
              },

              { type: "separator", margin: "md" },

              {
                type: "text",
                text: `ประเภท/อุปกรณ์: ${data.title || '-'}`,
                size: "sm",
                wrap: true
              },
              {
                type: "text",
                text: `รายละเอียด/อาการ: ${data.symptom || '-'}`,
                size: "sm",
                wrap: true
              },

              { type: "separator", margin: "md" },

              {
                type: "text",
                text: `สาขา: ${data.branch || '-'}`,
                size: "sm"
              },
              {
                type: "text",
                text: `รหัสสาขา: ${data.branch_code || '-'}`,
                size: "sm"
              },

              { type: "separator", margin: "md" },

              {
                type: "text",
                text: `เบอร์โทร: ${data.phone || '-'}`,
                size: "sm",
                wrap: true
              },
              {
                type: "text",
                text: `สถานะ: ${data.status || '-'}`,
                size: "sm",
                wrap: true
              }
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
                    action: {
                      type: "uri",
                      label: "เปิดรายการ",
                      uri: recordUrl
                    }
                  }
                ]
              }
            : undefined
        }
      };

      await linePushFlex(target, flexMessage);
      console.log('✅ PUSH SUCCESS');
    }
  } catch (err) {
    console.error('❌ LARK ERROR:', err.message);

    // หมายเหตุ: ถ้าส่ง {ok:true} ไปแล้ว res.status(500) จะ error "headers already sent"
    if (!res.headersSent) {
      res.status(500).json({ error: 'server error' });
    }
  }
});

module.exports = router;
