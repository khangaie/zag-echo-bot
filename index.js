const restify = require('restify');
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');
const { TeamsAIBot } = require('./bot');

const PORT = process.env.PORT || 8080;

const botAuth = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(botAuth);

adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  await context.sendActivity('⚠️ Алдаа гарлаа. Дахин оролдоно уу.');
};

const bot = new TeamsAIBot();

const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.get('/', (_, res) => {
  res.send('ZAG Teams Bot API running');
});

server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

