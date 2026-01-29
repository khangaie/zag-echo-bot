const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MicrosoftAppId,
    authority: `https://login.microsoftonline.com/${process.env.MicrosoftAppTenantId}`,
    clientSecret: process.env.MicrosoftAppPassword
  }
});

async function getGraphToken() {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });
  return result.accessToken;
}

module.exports = { getGraphToken };
