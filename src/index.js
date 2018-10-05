const token = require('../.config').SLACK_API_TOKEN;
const {RTMClient} = require('@slack/client');
const {
  commands,
  getCleanupSchedule,
  buildMessage,
  getCommandFromMessage
} = require('./cleanupHelpers');

const {
  getBotDisplayName,
  isMessageToBot,
  getDisplayNameById,
  getSlackUsers,
  parseSlackDisplayName
} = require('./slackHelpers');


const botDMChannel = 'DCW1MEP9Q';   // can't find a way to get bot's channel id dynamically
let botUserId;                      // assigned after authenticated
const rtm = new RTMClient(token);

rtm.start();

rtm.on('authenticated', () => botUserId = rtm.activeUserId);

rtm.on('message', (message) => {
  if (message.subtype !== 'message_deleted' &&
      message.subtype !== 'message_changed' &&
      isMessageToBot(message, botUserId, botDMChannel)) {
    // remove bot's name if present from the message text
    const botDisplayName = getBotDisplayName(botUserId);
    const cleanedMessage = {...message, text: message.text.replace(botDisplayName, '')};
    handleMessage(cleanedMessage);
  }
});

const handleMessage = (message) => {
  Promise.all([
    getSlackUsers(),
    getCleanupSchedule()
  ])
    .then(([users, schedule]) => {
      const command = getCommandFromMessage(message);
      // subject is either the slack user mentioned in the message,
      // or the message sender if no one is mentioned
      const messageSubjectId = parseSlackDisplayName(message.text) || message.user;
      const messageSubjectDisplayName = getDisplayNameById(messageSubjectId, users);
      const response = buildMessage(command, schedule, messageSubjectDisplayName);
      rtm.sendMessage(response, message.channel);
    })
    .catch((error) => {
      console.log(error);
      const response = 'Sorry. Something has gone terribly wrong.';
      rtm.sendMessage(response, message.channel);
    });
};

