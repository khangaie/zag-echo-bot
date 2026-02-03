// index.js
const express = require('express');
const {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} = require('botbuilder');

// 1) Танай бот классыг импортлоно (дор байгаа bot.js–ийн классын нэр ZAGBot)
const { ZAGBot } = require('./bot');

// 2) Credentials (Single‑tenant тохиргоо)
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
  MicrosoftAppType: 'SingleTenant',
});

// 3) Bot Framework Authentication + CloudAdapter
const bfa = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(bfa);

// (заавал биш) Алдаа баригч – лог дээр шалтгааныг тод харуулах
adapter.onTurnError = async (context, error) => {
  console.error('onTurnError:', error);
  await context.sendActivity('❌ Алдаа гарлаа. Дараа дахин оролдоно уу.');
};

// 4) Экспресс апп
const app = express();
app.use(express.json());

// Health check
app.get('/', (_req, res) => res.send('✅ ZAG Team Bot is running'));

// Танай ботын instance
const bot = new ZAGBot();

// Bot endpoint
app.post('/api/messages', (req, res) => {
  console.log('POST /api/messages @', new Date().toISOString());
  adapter.process(req, res, async (context) => {
    await bot.run(context);
  });
});

// 5) Start
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Bot running on ${port}`));
``
