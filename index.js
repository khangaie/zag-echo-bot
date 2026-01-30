const restify = require('restify');
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { TeamsAIBot } = require('./bot');

const PORT = process.env.PORT || 8080;

// 🔐 Bot authentication (Azure App Service env ашиглана)
const botAuth = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(botAuth);

// ❗ Global error handler
adapter.onTurnError = async (context, error) => {
  console.error('Bot error:', error);
  await context.sendActivity('⚠️ Алдаа гарлаа. Түр хүлээгээрэй.');
};

const bot = new TeamsAIBot();

// 🌐 Restify server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// ✅ Health check (Azure шалгахад маш чухал)
server.get('/', (req, res) => {
  res.send('ZAG Teams Bot is running ✅');
});

// 🤖 Bot endpoint
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});

// ▶️ Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
