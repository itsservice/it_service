// ══════════════════════════════════════════════════════════════
// FILE: app-line-patches.js
// INSTRUCTIONS: Apply these changes to your existing app.js
// ══════════════════════════════════════════════════════════════

// ── STEP 1: Add require at top of app.js ─────────────────────
// ADD this line after other requires:
const lineNotify = require('./lineNotify');

// ══════════════════════════════════════════════════════════════
// ── STEP 2: POST /api/tickets — after creating ticket ────────
// ══════════════════════════════════════════════════════════════
// FIND this block in app.js:
//   const t = await createTicket({ brand, reporter, phone, ...
//   const log = addLog({ action:'create_ticket', ...
//   broadcast('ticket_created', { ticket:t });
//   res.json({ ok:true, ticket:t, log });
//
// ADD right before res.json:
//
//   // LINE: Notify brand group + admin group
//   lineNotify.notifyNewTicket(t).catch(e => console.error('[LINE notifyNewTicket]', e.message));

// ══════════════════════════════════════════════════════════════
// ── STEP 3: PATCH /api/tickets/:rid/assign ───────────────────
// ══════════════════════════════════════════════════════════════
// FIND this block:
//   const t = await updateTicket(req.params.rid, {
//     engineerName: engineerName||'',
//     ...
//   });
//   const log = addLog({ ...assign... });
//   broadcast('ticket_updated', ...);
//   res.json({ ok:true, ticket:t });
//
// ADD right before res.json:
//
//   // LINE: Notify assigned engineer
//   const { getAllUsers } = require('./users');
//   const engUser = getAllUsers().find(u => u.name === engineerName);
//   lineNotify.notifyAssigned(t, engUser?.line_user_id).catch(e => console.error('[LINE notifyAssigned]', e.message));

// ══════════════════════════════════════════════════════════════
// ── STEP 4: PATCH /api/tickets/:rid/engineer-submit ──────────
// ══════════════════════════════════════════════════════════════
// FIND this block:
//   const t = await updateTicket(req.params.rid, fields);
//   invalidateCache();
//   broadcast('ticket_updated', ...);
//   res.json({ ok:true, ticket:t });
//
// ADD right before res.json:
//
//   // LINE: Notify admin that engineer submitted work
//   lineNotify.notifyWorkSubmitted(t).catch(e => console.error('[LINE notifyWorkSubmitted]', e.message));

// ══════════════════════════════════════════════════════════════
// ── STEP 5: PATCH /api/tickets/:rid/close ────────────────────
// ══════════════════════════════════════════════════════════════
// FIND this block (close/done):
//   const t = await updateTicket(req.params.rid, { status: 'เสร็จสิ้น ✅', ...
//   OR
//   status === 'done'
//   broadcast('ticket_updated', ...);
//   res.json({ ok:true, ticket:t });
//
// ADD right before res.json:
//
//   // LINE: Notify brand group + reporter that ticket is closed
//   lineNotify.notifyTicketClosed(t).catch(e => console.error('[LINE notifyTicketClosed]', e.message));

// ══════════════════════════════════════════════════════════════
// ── STEP 6: (Optional) REASSIGNMENT ROUTE ────────────────────
// ══════════════════════════════════════════════════════════════
// If you add a reassignment route, use:
//
// app.patch('/api/tickets/:rid/reassign', requireAuth(['superadmin','admin','manager']), async (req, res) => {
//   try {
//     const { newEngineerName } = req.body || {};
//     if (!newEngineerName) return res.json({ ok: false, error: 'Missing newEngineerName' });
//
//     const oldTicket = await getTicket(req.params.rid);
//     const oldEngineerName = oldTicket?.engineerName;
//
//     const t = await updateTicket(req.params.rid, {
//       engineerName: newEngineerName,
//       assignedTo: newEngineerName,
//       status: 'อยู่ระหว่างดำเนินการ ⚙️'
//     });
//
//     addLog({ user: req.user, action: 'reassign', ticketId: req.params.rid,
//       detail: `เปลี่ยนช่าง ${oldEngineerName} → ${newEngineerName}` });
//
//     // LINE: Notify both old and new engineers
//     const { getAllUsers } = require('./users');
//     const allUsers = getAllUsers();
//     const oldEng = allUsers.find(u => u.name === oldEngineerName);
//     const newEng = allUsers.find(u => u.name === newEngineerName);
//     lineNotify.notifyReassigned(t, oldEng?.line_user_id, newEng?.line_user_id)
//       .catch(e => console.error('[LINE notifyReassigned]', e.message));
//
//     broadcast('ticket_updated', { recordId: req.params.rid, engineerName: newEngineerName });
//     res.json({ ok: true, ticket: t });
//   } catch (e) { res.json({ ok: false, error: e.message }); }
// });

// ══════════════════════════════════════════════════════════════
// ── STEP 7: PATCH /api/tickets/:rid/status ───────────────────
// ══════════════════════════════════════════════════════════════
// For status changes that trigger LINE (revision):
// ADD inside the status route, after updateTicket:
//
//   if (status.includes('revision') || status.includes('แก้ไข')) {
//     const engUser = getAllUsers().find(u => u.name === t.engineerName);
//     lineNotify.notifyRevision(t, engUser?.line_user_id).catch(e => console.error('[LINE notifyRevision]', e.message));
//   }

// ══════════════════════════════════════════════════════════════
// ENVIRONMENT VARIABLES TO ADD IN RENDER:
// ══════════════════════════════════════════════════════════════
// Required (already have):
//   LINE_CHANNEL_ACCESS_TOKEN = your LINE bot token
//   LINE_ADMIN_GROUP_ID = main admin group
//
// Optional (per-brand groups):
//   LINE_GROUP_DUNKIN = group ID for Dunkin' notifications
//   LINE_GROUP_GREYHOUND_CAFE = group ID for Greyhound Cafe
//   LINE_GROUP_GREYHOUND_ORIGINAL = group ID for Greyhound Original
//   LINE_GROUP_AU_BON_PAIN = group ID for Au Bon Pain
//   LINE_GROUP_FUNKY_FRIES = group ID for Funky Fries
//
// User LINE IDs:
//   Store line_user_id in each user record (users.js)
//   When creating users in admin, add their LINE User ID
//   Bot can get User IDs via !userid command in LINE chat

// ══════════════════════════════════════════════════════════════
// HOW TO GET LINE GROUP IDs:
// ══════════════════════════════════════════════════════════════
// 1. Add the LINE bot to each brand's LINE group
// 2. Type !groupid in the group
// 3. Bot will reply with the Group ID
// 4. Copy the Group ID to Render environment variables
//
// HOW TO GET LINE User IDs:
// 1. User sends !userid in private chat with bot
// 2. Bot replies with User ID
// 3. Store in user profile (admin > edit user > LINE User ID field)
