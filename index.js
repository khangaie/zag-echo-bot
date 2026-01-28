const path = require('path');
const restify = require('restify');
require('dotenv').config(); // ← ЗӨВХӨН ИНГЭЖ ҮЛДЭЭ

const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { EchoBot } = require('./bot');

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// Start server
server.listen(process.env.PORT || 3978, () => {
  console.log(`${server.name} listening on ${server.url}`);
});

// Root test endpoint
server.get('/', (req, res, next) => {
  res.send('ZAG Teams Bot API is running');
  return next();
});

// Bot auth
const botFrameworkAuthentication =
  new ConfigurationBotFrameworkAuthentication(process.env);

// Adapter
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  await context.sendActivity('⚠️ Алдаа гарлаа.');
};

// Bot
const bot = new EchoBot();

// Messages endpoint
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});
