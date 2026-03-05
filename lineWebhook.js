const express = require('express');
const crypto = require('crypto');

const { LINE_CHANNEL_SECRET } = require('./env');
const { logLineMessage } = require('./lineLogger');
const { getUserProfileInGroup, getGroupSummary } = require('./lineLookup');

const router = express.Router();

function verifyLineSignature(req) {
  const signature = req.get('x-line-signature');

  if (!LINE_CHANNEL_SECRET) {
    return { ok: false, reason: 'MISSING_ENV_LINE_CHANNEL_SECRET' };
  }
  if (!signature) {
    return { ok: false, reason: 'MISSING_HEADER_X_LINE_SIGNATURE' };
  }
  if (!req.rawBody) {
    return { ok: false, reason: 'MISSING_RAW_BODY' };
  }

  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(req.rawBody)
    .digest('base64');

  return { ok: hash === signature, reason: hash === signature ? 'OK' : 'SIGNATURE_MISMATCH' };
}

router.post('/webhook', async (req, res) => {
  const v = verifyLineSignature(req);

  if (!v.ok) {
    console.error('\n============');
    console.error('Error (lineWebhook.js)');
    console.error('============');
    console.error(
      [
        `reason: ${v.reason}`,
        `hasSecret: ${!!LINE_CHANNEL_SECRET}`,
        `secretLen: ${(LINE_CHANNEL_SECRET || '').length}`,
        `hasSignatureHeader: ${!!req.get('x-line-signature')}`,
        `contentType: ${req.get('content-type') || '-'}`,
        `rawBodyLen: ${req.rawBody ? req.rawBody.length : 0}`
      ].join('\n')
    );
    console.error('============');
    console.error('(จบขั้นตอน Error)');
    console.error('❌❌❌❌❌\n');
    return res.status(401).send('invalid signature');
  }

  res.status(200).json({ ok: true });

  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];

    for (const ev of events) {
      if (ev.type !== 'message') continue;

      const source = ev.source || {};
      const userId = source.userId || '';
      const groupId = source.groupId || '';

      let userName = '';
      let groupName = '';

      if (groupId && userId) {
        try {
          const [profile, summary] = await Promise.all([
            getUserProfileInGroup(groupId, userId),
            getGroupSummary(groupId)
          ]);
          userName = profile?.displayName || '';
          groupName = summary?.groupName || '';
        } catch {
          // ดึงชื่อไม่ได้ก็ยัง log ID ได้
        }
      }

      logLineMessage({ userName, userId, groupName, groupId });
    }
  } catch (err) {
    console.error('\n============');
    console.error('Error (lineWebhook.js)');
    console.error('============');
    console.error(err?.message || err);
    console.error('============');
    console.error('(จบขั้นตอน Error)');
    console.error('❌❌❌❌❌\n');
  }
});

module.exports = router;
