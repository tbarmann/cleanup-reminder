// eslint-disable-next-line global-require
const token = process.env.SLACK_API_TOKEN || require('../.config').SLACK_API_TOKEN;
const AsciiTable = require('ascii-table');
const axios = require('axios');

const getBotDisplayName = (activeUserId) => {
  return `<@${activeUserId}>`;
};

const isMessageToBot = (message, activeUserId, botDMChannel) => {
  const botDisplayName = getBotDisplayName(activeUserId);
  return message.text.startsWith(botDisplayName) || message.channel === botDMChannel;
};

// fetches a list of all the group's users from Slack API and returns a promise
const getSlackUsers = () => {
  const url = `https://slack.com/api/users.list?token=${token}`;
  return axios.get(url)
    .then((response) => {
      const data = response.data.members.filter((record) => {
        return record.real_name !== undefined && record.profile.display_name.length > 0;
      });
      return data.map((record) => {
        return {
          id: record.id,
          real_name: record.real_name,
          display_name: record.profile.display_name
        };
      });
    });
};

const getDisplayNameById = (id, users) => {
  const userRecord = users.find((record) => record.id === id);
  return userRecord ? `@${userRecord.display_name}` : null;
};

const formatAsCode = (str) => {
  return '```' + str + '```';
};

const formatAsTable = (json, fieldsToInclude = []) => {
  let filteredData = json;
  const headings = fieldsToInclude.length > 0
    ? Object.keys(json[0]).filter((key) => fieldsToInclude.includes(key))
    : Object.keys(json[0]);

  if (fieldsToInclude.length) {
    filteredData = json.map((record) => {
      let tempObj = {};
      headings.forEach((heading) => {
        if (fieldsToInclude.includes(heading)) {
          tempObj[heading] = record[heading];
        }
      });
      return tempObj;
    });
  }

  const table = new AsciiTable();
  table.setHeading(...headings);
  filteredData.forEach((record) => table.addRow(...Object.values(record)));
  return formatAsCode(table.toString());
};

const parseSlackDisplayName = (messageText) => {
  const userIdPattern = /@([^'\s>]+)/;
  const found = messageText.match(userIdPattern);
  return found ? found[1] : null;
};

module.exports = {
  getBotDisplayName,
  isMessageToBot,
  getSlackUsers,
  getDisplayNameById,
  formatAsCode,
  formatAsTable,
  parseSlackDisplayName
};
