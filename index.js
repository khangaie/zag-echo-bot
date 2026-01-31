const restify = require('restify');
const { BotFrameworkAdapter } = require('botbuilder');
const { createBot } = require('./bot');
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
const adapter = new BotFrameworkAdapter({
 appId: process.env.MicrosoftAppId,
 appPassword: process.env.MicrosoftAppPassword
});
const bot = createBot(); // ✅ constructor БИШ
server.post('/api/messages', (req, res) => {
 adapter.processActivity(req, res, async (context) => {
   await bot.run(context);
 });
});
const port = process.env.PORT || 3978;
server.listen(port, () => {
 console.log(`🚀 Bot started on port ${port}`);
});
