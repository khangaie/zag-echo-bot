const express = require("express");
const { BotFrameworkAdapter } = require("botbuilder");
const ZAGBot = require("./bot");
// ===============================
// Bot Framework Adapter
// ===============================
const adapter = new BotFrameworkAdapter({
 appId: process.env.MicrosoftAppId,
 appPassword: process.env.MicrosoftAppPassword,
});
// Global error handler
adapter.onTurnError = async (context, error) => {
 console.error("ADAPTER ERROR:", error);
 await context.sendActivity("❌ Системийн алдаа гарлаа. Админд мэдэгдлээ.");
};
// ===============================
// Bot instance
// ===============================
const bot = new ZAGBot();
// ===============================
// Express app
// ===============================
const app = express();
app.use(express.json());
// Health check
app.get("/", (req, res) => {
 res.send("✅ ZAG Teams Bot is running");
});
// ===============================
// Bot endpoint (IMPORTANT)
// ===============================
app.post("/api/messages", (req, res) => {
 adapter.processActivity(req, res, async (context) => {
   await bot.run(context);
 });
});
// ===============================
// Start server
// ===============================
const port = process.env.PORT || 8080;
app.listen(port, () => {
 console.log(`🚀 Bot running on port ${port}`);
});
