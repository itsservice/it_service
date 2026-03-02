const axios = require('axios');
const { LINE_TOKEN } = require('../config/env');

const headers = {
  Authorization: `Bearer ${LINE_TOKEN}`
};

async function getUserProfileInGroup(groupId, userId) {
  // displayName จะได้ก็ต่อเมื่อ user ยังเป็นสมาชิก และ bot อยู่ใน group
  const url = `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`;
  const res = await axios.get(url, { headers, timeout: 15000 });
  return res.data; // { displayName, userId, pictureUrl, statusMessage }
}

async function getGroupSummary(groupId) {
  const url = `https://api.line.me/v2/bot/group/${groupId}/summary`;
  const res = await axios.get(url, { headers, timeout: 15000 });
  return res.data; // { groupId, groupName, pictureUrl }
}

module.exports = { getUserProfileInGroup, getGroupSummary };
