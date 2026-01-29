const restify = require('restify');
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { TeamsAIBot } = require('./bot');

const PORT = process.env.PORT || 8080;

// Bot authentication
const botAuth = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(botAuth);

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  await context.sendActivity('⚠️ Алдаа гарлаа. Дахин оролдоно уу.');
};

const bot = new TeamsAIBot();

// Restify server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// ✅ HEALTH CHECK — ЭНЭ Л ГОЛ АСУУДАЛ БАЙСАН
server.get('/', async (req, res) => {
  res.send('ZAG Teams Bot API is running');
});

// Bot endpoint
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});

// Listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
