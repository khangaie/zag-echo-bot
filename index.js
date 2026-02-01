const express = require('express');
const { BotFrameworkAdapter } = require('botbuilder');
// =======================
// Adapter
// =======================
const adapter = new BotFrameworkAdapter({
 appId: process.env.MicrosoftAppId,
 appPassword: process.env.MicrosoftAppPassword,
});
// Global error handler
adapter.onTurnError = async (context, error) => {
 console.error('❌ Bot error:', error);
 await context.sendActivity('⚠️ Системийн алдаа гарлаа. Дараа дахин оролдоно уу.');
};
// =======================
// Bot logic (temporary simple echo)
// =======================
const botLogic = async (context) => {
 if (context.activity.type === 'message') {
   await context.sendActivity(`Таны бичсэн: ${context.activity.text}`);
 }
};
// =======================
// Express app
// =======================
const app = express();
app.use(express.json());
// 🔎 Health check (Browser-оор шалгахад)
app.get('/', (req, res) => {
 res.status(200).send('✅ ZAG Teams Bot is running');
});
// 🤖 Bot endpoint (Teams энд POST илгээнэ)
app.post('/api/messages', (req, res) => {
 adapter.processActivity(req, res, botLogic);
});
// =======================
// Start server
// =======================
const port = process.env.PORT || 8080;
app.listen(port, () => {
 console.log(`🚀 Bot server listening on port ${port}`);
});
