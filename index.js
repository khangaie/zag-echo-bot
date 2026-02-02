const express = require("express");
const { BotFrameworkAdapter } = require("botbuilder");
const ZAGBot = require("./bot");
const adapter = new BotFrameworkAdapter({
 appId: process.env.MicrosoftAppId,
 appPassword: process.env.MicrosoftAppPassword
 // ❌ tenantId
 // ❌ appType
 // ❌ oauthScope
});
adapter.onTurnError = async (context, error) => {
 console.error("ADAPTER ERROR:", error);
 await context.sendActivity("⚠️ Системийн алдаа гарлаа.");
};
const bot = new ZAGBot();
const app = express();
app.use(express.json());
app.get("/", (req, res) => {
 res.send("✅ ZAG Teams Bot is running");
});
app.post("/api/messages", (req, res) => {
 adapter.processActivity(req, res, (context) => bot.run(context));
});
const port = process.env.PORT || 8080;
app.listen(port, () => {
 console.log(`🚀 Bot running on port ${port}`);
});
