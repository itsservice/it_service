const express = require('express');
const crypto = require('crypto');

const { LINE_SECRET } = require('../config/env');
const { logLineMessage } = require('../utils/lineLogger');
const { getUserProfileInGroup, getGroupSummary } = require('../services/lineLookup');

const router = express.Router();

/**
 * Verify LINE signature (แนะนำให้เปิด ใช้จริงบน Render)
 */
function verifyLineSignature(req) {
  if (!LINE_SECRET) return false;

  const signature = req.get('x-line-signature');
  if (!signature) return false;

  // req.rawBody จะถูก set จาก app.js (ดูไฟล์แก้ด้านล่าง)
  const hash = crypto
    .createHmac('sha256', LINE_SECRET)
    .update(req.rawBody)
    .digest('base64');

  return hash === signature;
}

router.post('/webhook', async (req, res) => {
  try {
    // 1) verify signature (ถ้าไม่ต้องการ verify ให้คอมเมนต์ส่วนนี้)
    const ok = verifyLineSignature(req);
    if (!ok) {
      // ตอบ 401 และ log สาเหตุ
      console.error('\n===== LINE Message =====');
      console.error('Invalid signature (x-line-signature)');
      console.error('===== End Function ======\n');
      return res.status(401).send('invalid signature');
    }

    // 2) ตอบกลับเร็วกัน timeout
    res.status(200).json({ ok: true });

    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events : [];

    // 3) รองรับหลาย events ใน webhook เดียว
    for (const ev of events) {
      if (ev.type !== 'message') continue;

      const source = ev.source || {};
      const userId = source.userId || '';
      const groupId = source.groupId || ''; // ถ้ามาจาก group จะมี
      // roomId ก็มีได้ แต่คุณขอเฉพาะ group -> เอา group เป็นหลัก

      // default ถ้า lookup ไม่ได้
      let userName = '';
      let groupName = '';

      // 4) Lookup ชื่อ (optional แต่แนะนำ)
      // ถ้าเป็น group จะดึงชื่อ group + ชื่อ user ใน group ได้
      if (groupId && userId) {
        try {
          const [profile, summary] = await Promise.all([
            getUserProfileInGroup(groupId, userId),
            getGroupSummary(groupId)
          ]);
          userName = profile?.displayName || '';
          groupName = summary?.groupName || '';
        } catch (e) {
          // ถ้า bot ไม่มีสิทธิ์/ user block / ไม่เป็นสมาชิก -> จะดึงชื่อไม่ได้
          // ยัง log id ได้ตามปกติ
        }
      }

      // 5) log ตาม format ที่คุณต้องการ
      logLineMessage({
        userName,
        userId,
        groupName,
        groupId
      });
    }
  } catch (err) {
    // ถ้า error หลังตอบไปแล้วก็แค่ log
    console.error('\n===== LINE Message =====');
    console.error(`Error: ${err?.message || err}`);
    console.error('===== End Function ======\n');

    if (!res.headersSent) res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
