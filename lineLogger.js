function logLineMessage({ userName, userId, groupName, groupId }) {
  console.log('\n===== LINE Message =====');
  console.log(`USER : ${userName || '-'}`);
  console.log(`ID : ${userId || '-'}`);

  // ถ้ามีกลุ่ม
  if (groupId) {
    console.log(
      `\n     |_____(Group  : ${groupName || '-'}\n              ID Group : ${groupId} )`
    );
  }

  console.log('===== End Function ======\n');
}

module.exports = { logLineMessage };
