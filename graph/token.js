// graph/token.js
const { ConfidentialClientApplication } = require("@azure/msal-node");

/**
 * Шаардлагатай ENV:
 *  - MicrosoftAppId            → App registration → Application (client) ID
 *  - MicrosoftAppPassword      → Client secret VALUE (expiry OK эсэхээ шалга)
 *  - MicrosoftAppTenantId      → Directory (tenant) ID  (SingleTenant үед заавал)
 *
 *  Public Azure (global) authority:
 *    https://login.microsoftonline.com/<tenantId>
 *  National cloud ашиглаж байвал authority-г өөрчилнө (ж: Azure China гэх мэт).
 */

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MicrosoftAppId,
    authority: `https://login.microsoftonline.com/${process.env.MicrosoftAppTenantId}`,
    clientSecret: process.env.MicrosoftAppPassword,
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
