const express = require('express');
const {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  createBotFrameworkAuthenticationFromConfiguration
} = require('botbuilder');

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: process.env.MicrosoftAppId,
  MicrosoftAppPassword: process.env.MicrosoftAppPassword,
  MicrosoftAppTenantId: process.env.MicrosoftAppTenantId
});

const bfa = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(bfa);

const app = express();
app.use(express.json());

app.post('/api/messages', (req, res) => {
  adapter.process(req, res, async (context) => {
    await bot.run(context);
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Bot running on ${port}`));
``
