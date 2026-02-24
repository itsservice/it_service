// ======================================================
// 2) LARK WEBHOOK (Ticket + Daily Report)
// ======================================================
app.post('/lark/webhook', async (req, res) => {

  const body = req.body || {};

  console.log('\n📥 LARK WEBHOOK RECEIVED');
  console.log(JSON.stringify(body, null, 2));

  // ==================================================
  // ✅ URL VERIFICATION
  // ==================================================
  if (body.type === 'url_verification') {
    console.log('✅ LARK URL VERIFICATION');
    return res.send(body.challenge);
  }

  // ==================================================
  // 🔐 OPTIONAL: VERIFY TOKEN (เปิดใช้ตอน PROD)
  // ==================================================
  if (process.env.LARK_VERIFICATION_TOKEN) {
    if (body.token !== process.env.LARK_VERIFICATION_TOKEN) {
      console.error('❌ INVALID LARK TOKEN');
      return res.status(403).send('Invalid token');
    }
  }

  // ตอบกลับ Lark ทันที (กัน timeout)
  res.status(200).json({ ok: true });

  // ==================================================
  // 🔄 รองรับ payload จริงของ Lark (event.callback)
  // ==================================================
  const data = body.event || body;

  // ==================================================
  // DAILY REPORT
  // ==================================================
  if (data.type === 'daily_report') {

    const {
      time,
      pending_count,
      inprogress_count,
      line_user_id,
      line_group_id
    } = data;

    const target = line_user_id || line_group_id;
    if (!target) {
      console.error('❌ DAILY REPORT: no LINE target');
      return;
    }

    console.log('\n📊 DAILY REPORT');

    const msg =
`📋 รายงานงานคงเหลือ
⏰ รอบเวลา : ${time}

🟡 รอดำเนินการ : ${pending_count}
🔵 อยู่ระหว่างดำเนินการ : ${inprogress_count}`;

    try {
      await linePush(target, msg);
      console.log('✅ DAILY REPORT SENT');
    } catch (err) {
      console.error('❌ DAILY REPORT ERROR', err.response?.data || err.message);
    }

    return;
  }

  // ==================================================
  // TICKET
  // ==================================================
  if (typeof data.type === 'string' && data.type.startsWith('Ticket-')) {

    const {
      ticket_id,
      ticketDate,
      title,
      symptom,
      branch,
      branch_code,
      phone,
      status,
      line_user_id,
      line_group_id
    } = data;

    const target = line_user_id || line_group_id;
    if (!target) {
      console.error('❌ TICKET: no LINE target');
      return;
    }

    console.log('\n🎫 NEW TICKET');

    const msg =
`🆔 Ticket ID : ${ticket_id}
📅 วันที่ : ${ticketDate}

📌 หัวข้อ : ${title}
⚙️ อาการ : ${symptom}

🏬 สาขา : ${branch}
🏷️ รหัสสาขา : ${branch_code}

📞 Phone : ${phone}
📊 Status : ${status}`;

    try {
      await linePush(target, msg);
      console.log('✅ TICKET SENT');
    } catch (err) {
      console.error('❌ TICKET ERROR', err.response?.data || err.message);
    }

    return;
  }

  console.warn('⚠️ UNKNOWN LARK PAYLOAD TYPE');
});
