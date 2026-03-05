const express = require('express');
const {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration,
} = require('botbuilder');

const ZAGBot = require('./bot'); // ✅ default импорт

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
  MicrosoftAppType: 'SingleTenant',
});

const bfa = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(bfa);

adapter.onTurnError = async (context, error) => {
  console.error('onTurnError:', error);
  await context.sendActivity('❌ Алдаа гарлаа. Дараа дахин оролдоно уу.');
};

const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.send('✅ ZAG Team Bot is running'));

const bot = new ZAGBot();

app.post('/api/messages', (req, res) => {
  console.log('POST /api/messages @', new Date().toISOString());
  adapter.process(req, res, async (context) => {
    await bot.run(context);
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Bot running on ${port}`));
