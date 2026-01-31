const express = require('express');
const { BotFrameworkAdapter } = require('botbuilder');
// ==================
// Adapter
// ==================
const adapter = new BotFrameworkAdapter({
   appId: process.env.MicrosoftAppId,
   appPassword: process.env.MicrosoftAppPassword
});
// Global error handler
adapter.onTurnError = async (context, error) => {
   console.error('Bot error:', error);
   await context.sendActivity('⚠️ Bot дээр алдаа гарлаа.');
};
// ==================
// Bot logic (test)
// ==================
const botLogic = async (context) => {
   if (context.activity.type === 'message') {
       await context.sendActivity(`Та бичсэн: ${context.activity.text}`);
   }
};
// ==================
// Express app
// ==================
const app = express();
app.use(express.json());
// 🔴 ЭНД л чиний алдаа байсан
app.post('/api/messages', async (req, res) => {
   await adapter.process(req, res, botLogic);
});
// ==================
// Start server
// ==================
const port = process.env.PORT || 3978;
app.listen(port, () => {
   console.log(`✅ Bot is running on port ${port}`);
});
