// eslint-disable-next-line global-require
const token = process.env.SLACK_API_TOKEN || require('../.config').SLACK_API_TOKEN;
const isTuesday = require('date-fns/is_tuesday');
const isFriday = require('date-fns/is_friday');
const {WebClient} = require('@slack/client');

const {formatAsCode} = require('./slackHelpers');
const {
  getCleanupSchedule,
  getCleanupMessages,
  getCurrentCleaner,
  getNextWeeksCleaner
} = require('./cleanupHelpers');

const web = new WebClient(token);
const today = new Date();

const debugSlackUser = '@tim';
const DEBUG = true;

const sendReminderTo = (recipient, messageText) => {
  web.chat.postMessage({channel: recipient, text: messageText, as_user: 'cleanupbot'})
    .then(() => {
      if (DEBUG) {
        web.chat.postMessage({channel: debugSlackUser, text: messageText});
      }
    })
    .catch((error) => {
      if (DEBUG) {
        web.chat.postMessage({channel: debugSlackUser, text: formatAsCode(JSON.stringify(error))});
      }
    });
};

if (isTuesday(today) || isFriday(today)) {
  Promise.all([
    getCleanupSchedule(),
    getCleanupMessages()
  ])
    .then(([schedule, messages]) => {
      const currentCleaner = getCurrentCleaner(schedule);
      if (currentCleaner && messages && messages.length > 0) {
        const {dayOfReminder, duties, nextWeekReminder} = messages[0];
        sendReminderTo(currentCleaner.slack, `${dayOfReminder}\n${duties}`);

        if (isFriday(today)) {
          const nextWeeksCleaner = getNextWeeksCleaner(schedule);
          if (nextWeeksCleaner && nextWeekReminder) {
            sendReminderTo(nextWeeksCleaner.slack, nextWeekReminder);
          }
        }
      }
    });
} else {
  if (DEBUG) {
    const messageText = "Running reminderService.js. Not Tuesday or Friday. Nothing to do.";
    web.chat.postMessage({channel: debugSlackUser, text: messageText, as_user: 'cleanupbot'});
  }
}
