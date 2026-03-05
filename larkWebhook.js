// larkWebhook.js — แก้ไข: broadcast SSE + LINE notify ตาม flow
// Flow: User → Lark → LINE(แจ้ง) → Engineer edit Lark → LINE(แจ้ง admin) → Admin จบงาน → LINE(แจ้ง user)
const express = require('express');
const router  = express.Router();

const { LARK_ENCRYPT_KEY } = require('./env');
const { decryptLark }      = require('./larkCrypto');
const { linePushFlex }     = require('./lineService');

// ── FLEX builder helpers ──────────────────────────────────────
function headerBox(color, icon, title) {
  return {
    type: 'box', layout: 'vertical',
    paddingAll: '16px',
    backgroundColor: color,
    contents: [
      { type: 'text', text: `${icon} ${title}`, color: '#ffffff', weight: 'bold', size: 'lg', wrap: true }
    ]
  };
}

function kv(label, value, color = '#555555') {
  return {
    type: 'box', layout: 'horizontal', spacing: 'md',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#888888', flex: 2 },
      { type: 'text', text: String(value || '-'), size: 'sm', color, flex: 3, wrap: true, align: 'end' }
    ]
  };
}

function sep() { return { type: 'separator', margin: 'md' }; }

function actionBtn(label, uri) {
  if (!uri) return null;
  return {
    type: 'button', style: 'primary', margin: 'md',
    action: { type: 'uri', label, uri }
  };
}

// ── FLEX: New ticket (User → Lark → LINE) ────────────────────
function buildNewTicketFlex(d) {
  const btn = actionBtn('📋 เปิดรายการ', d.recordUrl);
  return {
    type: 'flex', altText: `🎫 Ticket ใหม่: ${d.ticket_id || ''}`,
    contents: {
      type: 'bubble',
      header: headerBox('#1a73e8', '🎫', 'Ticket ใหม่เข้ามาแล้ว!'),
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          kv('Ticket ID', d.ticket_id, '#1a73e8'),
          sep(),
          kv('แบรนด์', d.branch),
          kv('รหัสสาขา', d.branch_code),
          kv('SLA', d.sla),
          sep(),
          kv('ประเภท', d.type || d.title),
          kv('อาการ', d.symptom || d.detail),
          sep(),
          kv('ผู้แจ้ง', d.reporter),
          kv('เบอร์', d.phone),
          sep(),
          kv('สถานะ', d.status || 'ตรวจงาน', '#f59e0b'),
          kv('วันที่', d.ticketDate || d.sentDate),
        ]
      },
      footer: btn ? { type: 'box', layout: 'vertical', contents: [btn] } : undefined
    }
  };
}

// ── FLEX: Engineer submit work ────────────────────────────────
function buildEngineerFlex(d) {
  const btn = actionBtn('✅ ตรวจรับงาน', d.recordUrl);
  return {
    type: 'flex', altText: `🔧 ช่างส่งงาน: ${d.ticket_id || ''}`,
    contents: {
      type: 'bubble',
      header: headerBox('#16a34a', '🔧', 'ช่างส่งรายงานงาน'),
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          kv('Ticket ID', d.ticket_id, '#16a34a'),
          kv('ช่าง', d.engineerName || d.engineer_name),
          sep(),
          kv('รายละเอียดงาน', d.workDetail || d.work_detail),
          kv('อะไหล่ที่ใช้', d.partsUsed || d.parts_used),
          kv('ชั่วโมงทำงาน', d.workHours || d.work_hours),
          sep(),
          kv('สถานะ', d.status, '#16a34a'),
          kv('เวลาเสร็จ', d.completedAt || d.completed_at),
        ]
      },
      footer: btn ? { type: 'box', layout: 'vertical', contents: [btn] } : undefined
    }
  };
}

// ── FLEX: Admin closed ticket → notify user ───────────────────
function buildClosedFlex(d) {
  return {
    type: 'flex', altText: `✅ งานเสร็จสิ้น: ${d.ticket_id || ''}`,
    contents: {
      type: 'bubble',
      header: headerBox('#7c3aed', '✅', 'งานของคุณเสร็จสิ้นแล้ว!'),
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          kv('Ticket ID', d.ticket_id, '#7c3aed'),
          kv('แบรนด์', d.branch),
          sep(),
          kv('สถานะ', 'เสร็จสิ้น', '#16a34a'),
          kv('หมายเหตุ Admin', d.adminNote || d.admin_note),
          kv('ปิดโดย', d.closedBy || d.closed_by),
          kv('เวลาปิด', d.closedAt || d.closed_at),
        ]
      }
    }
  };
}

// ── WEBHOOK HANDLER ───────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  try {
    let body = req.body;

    console.log('\n📥 LARK RAW\n', JSON.stringify(body, null, 2));

    if (body?.encrypt && LARK_ENCRYPT_KEY) {
      body = decryptLark(LARK_ENCRYPT_KEY, body.encrypt);
      console.log('🔓 LARK DECRYPTED\n', JSON.stringify(body, null, 2));
    }

    if (body?.type === 'url_verification') {
      return res.json({ challenge: body.challenge });
    }

    res.json({ ok: true });

    const data = body?.event || body || {};
    const broadcast = req.app.locals.broadcast;

    // ─── Broadcast SSE ─────────────────────────────────────
    if (broadcast) {
      broadcast('ticket_updated', {
        recordId:   data.record_id  || data.ticket_id,
        ticketId:   data.ticket_id,
        status:     data.status     || null,
        brand:      data.branch     || null,
        updatedAt:  new Date().toISOString(),
        source:     'lark_webhook',
      });
    }

    const recordUrl = typeof data.recordUrl === 'string' && data.recordUrl.trim()
      ? data.recordUrl.trim() : null;

    // ─── Route ตาม event type ───────────────────────────────
    const eventType = data.event_type || data.type || 'new_ticket';

    if (eventType === 'engineer_submit' || data.workDetail || data.work_detail) {
      // ── Engineer ส่งงาน → แจ้ง Admin ──
      const adminTarget = data.admin_line_id || data.admin_group_id || data.line_group_id;
      if (adminTarget) {
        await linePushFlex(adminTarget, buildEngineerFlex({ ...data, recordUrl }));
        console.log('✅ PUSH engineer → admin');
      }
      return;
    }

    if (eventType === 'ticket_closed' || data.status === 'เสร็จสิ้น' && data.closedBy) {
      // ── Admin จบงาน → แจ้ง User ──
      const userTarget = data.line_user_id || data.line_group_id;
      if (userTarget) {
        await linePushFlex(userTarget, buildClosedFlex({ ...data, recordUrl }));
        console.log('✅ PUSH closed → user');
      }
      return;
    }

    // ─── Default: New ticket → แจ้ง Engineer/Admin ────────
    const target = data.line_user_id || data.line_group_id;
    if (!target) {
      console.log('ℹ️  No LINE target — skip push');
      return;
    }

    await linePushFlex(target, buildNewTicketFlex({ ...data, recordUrl }));
    console.log('✅ PUSH new ticket');

  } catch (err) {
    console.error('❌ LARK WEBHOOK ERROR:', err?.message || err);
    if (!res.headersSent) res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
