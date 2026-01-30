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
 console.error(error);
 await context.sendActivity('⚠️ Алдаа гарлаа. Дахин оролдоно уу.');
};
const bot = new TeamsAIBot();
// Restify server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
// Health check
server.get('/', (req, res, next) => {
 res.send(200, 'ZAG Copilot Bot is running');
 next();
});
// ✅ ЗӨВ messages endpoint
server.post('/api/messages', async (req, res) => {
 await adapter.process(req, res, async (context) => {
   await bot.run(context);
 });
});
// Start server
server.listen(PORT, () => {
 console.log(`Server started on port ${PORT}`);
});
