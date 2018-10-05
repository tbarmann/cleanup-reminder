const isThisWeek = require('date-fns/is_this_week');
const addWeeks = require('date-fns/add_weeks');
const startOfWeek = require('date-fns/start_of_week');
const isSameDay = require('date-fns/is_same_day');
const isBefore = require('date-fns/is_before');
const Tabletop = require('../vendor/tabletop');
const key = process.env.GOOGLE_SPREADSHEET_KEY || require('../.config').GOOGLE_SPREADSHEET_KEY;
const {formatAsTable, formatAsCode, getBotDisplayName} = require('./slackHelpers');

const commands = [
  {command: 'today', example: 'Who has lunch clean-up duty today?'},
  {command: 'this', example: 'Who has lunch clean-up duty this week?'},
  {command: 'next', example: 'Who has lunch clean-up duty next week?'},
  {command: 'turn', example: 'When is my (or @dude\'s) turn for lunch clean-up duty?'},
  {command: 'schedule', example: 'Show the whole schedule'},
  {command: 'help', example: 'This screen'},
];

const getCleanupSchedule = () => new Promise((resolve, reject) => {
  const options = {
    key,
    callback: (response) => resolve(response.cleanupSchedule.elements),
    simpleSheet: false,
    debug: false
  };
  Tabletop.init(options);
});

const getCurrentCleaner = (schedule) => {
  return schedule.find((record) => isThisWeek(record.weekOf));
};

const getNextWeeksCleaner = (schedule) => {
  const today = new Date();
  const startOfThisWeek = startOfWeek(today, {weekStartsOn: 1});
  const startOfNextWeek = addWeeks(startOfThisWeek, 1);
  return schedule.find((record) => isSameDay(record.weekOf, startOfNextWeek));
};

const getScheduleByUser = (schedule, user) => {
  const today = new Date();
  return schedule.filter((record) => record.slack === user && !isBefore(record.weekOf, today));
};

const getSchedule = (schedule) => {
  const today = new Date();
  return schedule.filter((record) => !isBefore(record.weekOf, today));
};


const getCommands = () => {
  return `Here is a list of commands I understand:\n${formatAsTable(commands)}`;
};

const buildMessage = (command, schedule, slackName) => {
  if (!slackName) {
    return 'I can\'t find that user on Slack!';
  }
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
      const records = getScheduleByUser(schedule, slackName);
      return records.length === 0
        ? `I can't find ${slackName} on the schedule!`
        : `${slackName} is scheduled for clean-up duty for these weeks: \n` +  formatAsTable(getScheduleByUser(schedule, slackName), ['name', 'weekOf']);
    case 'schedule':
      return 'Here is the entire clean up schedule: \n' + formatAsTable(getSchedule(schedule), ['name', 'weekOf']);
    case 'help':
      return getCommands();
    default:
      return `Sorry, I don't understand what you're asking.\n${getCommands()}`;
  }
};

const getCommandFromMessage = (message) => {
  const commandRecord = commands.find((entry) => message.text.indexOf(entry.command) !== -1);
  return commandRecord ? commandRecord.command : null;
};

module.exports = {
  commands,
  getCleanupSchedule,
  getCurrentCleaner,
  getNextWeeksCleaner,
  getScheduleByUser,
  getSchedule,
  getCommands,
  buildMessage,
  getCommandFromMessage
};