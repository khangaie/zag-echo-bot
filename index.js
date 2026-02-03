// index.js
const express = require('express');
const {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} = require('botbuilder');

// ⚠️ IMPORT: bot.js нь default export (module.exports = ZAGBot;) тул энэ хэлбэрээр авна.
const ZAGBot = require('./bot');

// ---- Credentials (Single-tenant) ----
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
  MicrosoftAppType: 'SingleTenant',
});

// ---- Bot Framework Authentication + CloudAdapter ----
const bfa = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(bfa);

// (optional) Алдаа баригч – лог дээр шалтгааныг тод харуулна
adapter.onTurnError = async (context, error) => {
  console.error('onTurnError:', error);
  await context.sendActivity('❌ Алдаа гарлаа. Дараа дахин оролдоно уу.');
};

// ---- Express app ----
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

// Start
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Bot running on ${port}`));
``
