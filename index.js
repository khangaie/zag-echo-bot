const restify = require('restify');
const {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication
} = require('botbuilder');

const { TeamsAIBot } = require('./bot');

const PORT = process.env.PORT || 8080;

/**
 * 🔐 Bot authentication (Azure App Service ENV дээрээс уншина)
 */
const botAuth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
  MicrosoftAppType: process.env.MicrosoftAppType || 'SingleTenant'
});

const adapter = new CloudAdapter(botAuth);

/**
 * ❌ Error handler
 */
adapter.onTurnError = async (context, error) => {
  console.error('❌ Bot error:', error);
  await context.sendActivity('⚠️ Алдаа гарлаа. Дахин оролдоно уу.');
};

const bot = new TeamsAIBot();

/**
 * 🌐 Restify server
 */
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

/**
 * ❤️ Health check
 */
server.get('/', (_req, res, next) => {
  res.send('ZAG Teams Bot API is running');
  next();
});

/**
 * 🤖 Bot endpoint
 */
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await bot.run(context);
  });
});

/**
 * ▶️ Listen
 */
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
