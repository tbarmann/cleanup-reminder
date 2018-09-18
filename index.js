const Tabletop = require('tabletop');
const isThisWeek = require('date-fns/is_this_week');
const addWeeks = require('date-fns/add_weeks');
const startOfWeek = require('date-fns/start_of_week');
const isSameDay = require('date-fns/is_same_day');
const isBefore = require('date-fns/is_before');
const AsciiTable = require('ascii-table');

const googleSpreadsheetKey = '1xoR5reJgK4NlFLid2C1v8gpOPGV1WirgC3We8DTUkIw';

const commands = [
  {command: 'today', description: 'Who has lunch clean-up duty today'},
  {command: 'this', description: 'Who has lunch clean-up duty this week'},
  {command: 'next', description: 'Who has lunch clean-up duty next week'},
  {command: 'turn', description: 'When is my turn (or @dude\'s turn) for lunch clean-up duty'},
  {command: 'list', description: 'Show the whole schedule'},    
  {command: 'help', description: 'This screen'},
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
  return table.toString();
}

const getCommands = () => {
  return `Here is a list of commands I understand:\n${formatAsTable(commands)}`;
}

const process = (command, slackId) => {
  const options = {
    key: googleSpreadsheetKey,
    callback: outputMessage(command, slackId),
    simpleSheet: false
  };
  Tabletop.init(options);
}

const outputMessage = (command, slackId = null) => (data) => {
  const schedule = data.cleanupSchedule.elements;
  console.log(buildMessage(command, schedule, slackId));
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
        ? `I can't find ${slackId} on the schedule!`
        : `${slackId} is scheduled for clean-up duty for these weeks: \n` +  formatAsTable(getScheduleByUser(schedule, slackId), ['name', 'weekOf']);
    case 'list':
      return 'Here is the entire clean up schedule: \n' + formatAsTable(getSchedule(schedule), ['name', 'weekOf']);
    case 'help':
      return getCommands();
    default:
      return `Sorry, I don't understand what you're asking.\n${getCommands()}`;
  }
}

process('today');
process('next');
process('me');
process('list');
process('xxelp');


