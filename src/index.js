const Tabletop = require('tabletop');
const isThisWeek = require('date-fns/is_this_week');
const addWeeks = require('date-fns/add_weeks');
const startOfWeek = require('date-fns/start_of_week');
const isSameDay = require('date-fns/is_same_day');
const isBefore = require('date-fns/is_before');
const AsciiTable = require('ascii-table');
const SlackBot = require('slackbots');
const token = require('../.config').SLACK_API_TOKEN;
const googleSpreadsheetKey = require('../.config').GOOGLE_SPREADSHEET_KEY;
const axios = require('axios');
const RtmClient = require('@slack/client').RtmClient;
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;


let botId;  // gets populated when authenticated
let botName; // gets populated when authenticated
const botDMChannel = 'DCW1MEP9Q';
let users = []; // gets populated whenever a message to the bot is received

const rtm = new RtmClient(token, {
  logLevel: 'error',
  dataStore: false
});

rtm.start();

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
  botId = rtmStartData.self.id; 
  botName = rtmStartData.self.name;
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});

rtm.on(RTM_EVENTS.MESSAGE, (message) => {
  const botDisplayName = `<@${botId}>`;
  if (message.subtype !== 'message_deleted' && isMessageToBot(message)) {
    console.log(message);
    fetchUserLookupTable()
      .then(() => {
        const {command, userId} = parseMessage(message.text.replace(botDisplayName, ''), message.user);
        process(command, message.channel, userId);
      });
  }
});

const isMessageToBot = (message) => {
  const botDisplayName = `<@${botId}>`;
  return message.text.startsWith(botDisplayName) || message.channel === botDMChannel;
}


// fetches a list of all the group's users from Slack API and stores display name and user id
// in global array 'users'
const fetchUserLookupTable = () => {
  const url = `https://slack.com/api/users.list?token=${token}`;
  return axios.get(url)
    .then((response) => {
      const data = response.data.members.filter((record) =>
        record.real_name !== undefined && record.profile.display_name.length > 0);
      users = data.map((record) => {
        return {id: record.id, real_name: record.real_name, display_name: record.profile.display_name};
      });
    });
};

const getDisplayNameById = (id)  => {
  console.log('id: ', id);
  const userRecord = users.find((record) => record.id === id);
  return userRecord ? userRecord.display_name : null;
}

const parseMessage = (messageText, messageUser) => {
  const thisCommand = commands.find((entry) => messageText.indexOf(entry.command) !== -1);
  const command = thisCommand ? thisCommand.command : null;
  const userIdPattern = /@[^'\s>]+/
  const found = messageText.match(userIdPattern);
  const userId = found && found.length > 0
    ? getDisplayNameById(found[0].substring(1)) || found[0].substring(1)
    : getDisplayNameById(messageUser);
  return {command, userId: `@${userId}`};
}

const formatAsCode = (str) => {
  return `\`\`\`${str}\`\`\``;
}

const commands = [
  {command: 'today', example: 'Who has lunch clean-up duty today?'},
  {command: 'this', example: 'Who has lunch clean-up duty this week?'},
  {command: 'next', example: 'Who has lunch clean-up duty next week?'},
  {command: 'turn', example: 'When is my (or @dude\'s) turn for lunch clean-up duty?'},
  {command: 'schedule', example: 'Show the whole schedule'},
  {command: 'help', example: 'This screen'},
];

const getCurrentCleaner = (schedule) => {
  return schedule.find((record) => isThisWeek(record.weekOf));
}

const getNextWeeksCleaner = (schedule) => {
  const today = new Date();
  const startOfThisWeek = startOfWeek(today, {weekStartsOn: 1});
  const startOfNextWeek = addWeeks(startOfThisWeek, 1);
  return schedule.find((record) => isSameDay(record.weekOf, startOfNextWeek));
}

const getScheduleByUser = (schedule, user) => {
  const today = new Date();
  return schedule.filter((record) => record.slack === user && !isBefore(record.weekOf, today));
}

const getSchedule = (schedule) => {
  const today = new Date();
  return schedule.filter((record) => !isBefore(record.weekOf, today));
}

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
    })
  }

  const table = new AsciiTable();
  table.setHeading(...headings);
  filteredData.forEach((record) => table.addRow(...Object.values(record)));
  return formatAsCode(table.toString());
}

const getCommands = () => {
  return `Here is a list of commands I understand:\n${formatAsTable(commands)}`;
}

const process = (command, channel, slackId) => {
  const options = {
    key: googleSpreadsheetKey,
    callback: outputMessage(command, channel, slackId),
    simpleSheet: false
  };
  Tabletop.init(options);
}

const outputMessage = (command, channel, slackId = null) => (data) => {
  const schedule = data.cleanupSchedule.elements;
  const message = buildMessage(command, schedule, slackId);
  rtm.sendMessage(message, channel);
}

const buildMessage = (command, schedule, slackId = null) => {
  let record;
  switch (command) {
    case 'today':
    case 'this':
      record = getCurrentCleaner(schedule);
      return `The person with lunch duty this week is ${record.name}`;
    case 'next':
      record = getNextWeeksCleaner(schedule);
      return `The person with lunch duty next week is ${record.name}`;
    case 'turn':
      if (!slackId) {
        return 'No slack name given.';
      }
      const records = getScheduleByUser(schedule, slackId);
      return records.length === 0
        ? `I can't find @${getDisplayNameById(slackId.substring(1))} on the schedule!`
        : `${slackId} is scheduled for clean-up duty for these weeks: \n` +  formatAsTable(getScheduleByUser(schedule, slackId), ['name', 'weekOf']);
    case 'schedule':
      return 'Here is the entire clean up schedule: \n' + formatAsTable(getSchedule(schedule), ['name', 'weekOf']);
    case 'help':
      return getCommands();
    default:
      return `Sorry, I don't understand what you're asking.\n${getCommands()}`;
  }
}


