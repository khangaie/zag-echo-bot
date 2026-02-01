require('dotenv').config();
const express = require('express');
const { BotFrameworkAdapter } = require('botbuilder');
/**
* Adapter
*/
const adapter = new BotFrameworkAdapter({
 appId: process.env.MicrosoftAppId,
 appPassword: process.env.MicrosoftAppPassword
});
/**
* Global error handler
*/
adapter.onTurnError = async (context, error) => {
 console.error('❌ Bot error:', error);
 await context.sendActivity('⚠️ Bot дээр алдаа гарлаа. Админд мэдэгдлээ.');
};
/**
* Bot logic
*/
const botLogic = async (context) => {
 if (context.activity.type === 'message') {
   await context.sendActivity(`🧠 Та бичсэн: ${context.activity.text}`);
 }
};
/**
* Express app
*/
const app = express();
app.use(express.json());
app.post('/api/messages', (req, res) => {
 adapter.processActivity(req, res, botLogic);
});
/**
* Start server
*/
const port = process.env.PORT || 8080;
app.listen(port, () => {
 console.log(`✅ Bot is running on port ${port}`);
});
