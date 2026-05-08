// graph/token.js
const { ConfidentialClientApplication } = require("@azure/msal-node");

/**
 * Шаардлагатай ENV:
 *  - SP_CLIENT_ID       → SharePoint/Graph App registration → Application (client) ID
 *  - SP_CLIENT_SECRET   → Client secret VALUE
 *  - SP_TENANT_ID       → Directory (tenant) ID
 */

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.SP_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.SP_TENANT_ID}`,
    clientSecret: process.env.SP_CLIENT_SECRET,
  },
});

/**
 * Microsoft Graph-д зориулсан app-only token
 * Scope нь үргэлж: https://graph.microsoft.com/.default
 * (.default → App Registration-д өгсөн Application permissions-ийг ашиглана)
 */
async function getGraphToken() {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  if (!result || !result.accessToken) {
    throw new Error("Failed to acquire Graph access token");
  }
  return result.accessToken;
}

module.exports = { getGraphToken };
