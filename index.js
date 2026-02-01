const express = require('express');
const { BotFrameworkAdapter } = require('botbuilder');
const ZAGBot = require('./bot');
const adapter = new BotFrameworkAdapter({
 appId: process.env.MicrosoftAppId,
 appPassword: process.env.MicrosoftAppPassword
});
adapter.onTurnError = async (context, error) => {
 console.error(error);
 await context.sendActivity('⚠️ Системийн алдаа гарлаа.');
};
const bot = new ZAGBot();
const app = express();
app.use(express.json());
app.get('/', (_, res) => {
 res.send('✅ ZAG Teams Bot is running');
});
app.post('/api/messages', (req, res) => {
 adapter.processActivity(req, res, (context) => bot.run(context));
});
const port = process.env.PORT || 8080;
app.listen(port, () => {
 console.log(`🚀 Bot running on port ${port}`);
});
