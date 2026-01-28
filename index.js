const restify = require('restify');
require('dotenv').config();

const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { TeamsAIBot } = require('./bot');

// Create server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(process.env.PORT || 3978, () => {
  console.log(`Bot server running on ${server.url}`);
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
const bot = new TeamsAIBot();

// Messages endpoint
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});

// Health check
server.get('/', (req, res, next) => {
  res.send('ZAG Teams Bot API is running');
  next();
});

