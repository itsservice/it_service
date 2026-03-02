const axios = require('axios');
const { LINE_CHANNEL_ACCESS_TOKEN } = require('./env');

const headers = {
  Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
};

async function getUserProfileInGroup(groupId, userId) {
  const url = `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`;
  const res = await axios.get(url, { headers, timeout: 15000 });
  return res.data;
}

async function getGroupSummary(groupId) {
  const url = `https://api.line.me/v2/bot/group/${groupId}/summary`;
  const res = await axios.get(url, { headers, timeout: 15000 });
  return res.data;
}

module.exports = { getUserProfileInGroup, getGroupSummary };
