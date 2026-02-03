const express = require("express");
const { BotFrameworkAdapter } = require("botbuilder");
const ZAGBot = require("./bot");

// 1) ENV‑ээ логлож шалгах (SECRET‑ийг бүтнээр нь бүү хэвлэ)
console.log("AppId:", JSON.stringify(process.env.MicrosoftAppId));
console.log(
  "AppPassword(len):",
  process.env.MicrosoftAppPassword ? process.env.MicrosoftAppPassword.length : 0
);
console.log("TenantId:", JSON.stringify(process.env.MicrosoftAppTenantId));

// 2) Adapter‑аа дараа нь үүсгэнэ
const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword,
});

// 3) Дараах хэсгүүд тань хэвээрэй…
adapter.onTurnError = async (context, error) => {
  console.error("ADAPTER ERROR:", error);
  await context.sendActivity("❌ Системийн алдаа гарлаа. Админд мэдэгдлээ.");
};

const bot = new ZAGBot();
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ ZAG Team Bot is running");
});

app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Bot running on port ${port}`));;
