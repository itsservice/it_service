// ======================================================
// 2) LARK WEBHOOK (Ticket + Daily Report)
// ======================================================
app.post('/lark/webhook', async (req, res) => {

  const body = req.body || {};

  console.log('\n📥 LARK WEBHOOK RECEIVED');
  console.log(JSON.stringify(body, null, 2));

  // ==================================================
  // ✅ URL VERIFICATION (สำคัญมาก)
  // ==================================================
  if (body.type === 'url_verification') {
    console.log('✅ LARK URL VERIFICATION');
    return res.status(200).send(body.challenge);
  }

  // ตอบ OK ให้ event ปกติทันที (กัน timeout)
  res.status(200).json({ ok: true });

  // ==================================================
  // DAILY REPORT
  // ==================================================
  if (body.type === 'daily_report') {
    const {
      time,
      pending_count,
      inprogress_count,
      line_user_id,
      line_group_id
    } = body;

    const target = line_user_id || line_group_id;
    if (!target) {
      console.error('❌ DAILY REPORT: no LINE target');
      return;
    }

    console.log('\n📊 DAILY REPORT');
    console.log(`⏰ Time        : ${time}`);
    console.log(`🟡 Pending    : ${pending_count}`);
    console.log(`🔵 InProgress : ${inprogress_count}`);
    console.log(`🎯 Send to    : ${target}`);

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
  if (typeof body.type === 'string' && body.type.startsWith('Ticket-')) {

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
    } = body;

    const target = line_user_id || line_group_id;
    if (!target) {
      console.error('❌ TICKET: no LINE target');
      return;
    }

    console.log('\n🎫 NEW TICKET');
    console.log(`🆔 ${ticket_id}`);
    console.log(`📅 ${ticketDate}`);
    console.log(`📌 ${title}`);
    console.log(`⚙️ ${symptom}`);
    console.log(`🏬 ${branch}`);
    console.log(`🏷️ ${branch_code}`);
    console.log(`📞 ${phone}`);
    console.log(`📊 ${status}`);
    console.log(`🎯 Send to ${target}`);

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
