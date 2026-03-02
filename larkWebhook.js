const express = require('express');
const crypto = require('crypto');

const { LINE_CHANNEL_SECRET } = require('./env');
const { logLineMessage } = require('./lineLogger');
const { getUserProfileInGroup, getGroupSummary } = require('./lineLookup');

const router = express.Router();

function verifyLineSignature(req) {
  if (!LINE_CHANNEL_SECRET) return false;

  const signature = req.get('x-line-signature');
  if (!signature) return false;

  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(req.rawBody)
    .digest('base64');

  return hash === signature;
}

router.post('/webhook', async (req, res) => {
  try {
    const ok = verifyLineSignature(req);
    if (!ok) {
      console.error('\n===== LINE Message =====');
      console.error('Invalid signature (x-line-signature)');
      console.error('===== End Function ======\n');
      return res.status(401).send('invalid signature');
    }

    res.status(200).json({ ok: true });

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
        } catch {}
      }

      logLineMessage({ userName, userId, groupName, groupId });
    }
  } catch (err) {
    console.error('\n===== LINE Message =====');
    console.error(`Error: ${err?.message || err}`);
    console.error('===== End Function ======\n');
    if (!res.headersSent) res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
