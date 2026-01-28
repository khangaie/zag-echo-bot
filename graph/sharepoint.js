const axios = require('axios');

/**
 * Microsoft Graph access token авах (Client Credentials)
 */
async function getGraphToken() {
  const tenantId = process.env.MicrosoftAppTenantId;
  const clientId = process.env.MicrosoftAppId;
  const clientSecret = process.env.MicrosoftAppPassword;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure AD app environment variables дутуу байна');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await axios.post(tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data.access_token;
}

/**
 * SharePoint дээр текст хайх
 * @param {string} query - Хэрэглэгчийн асуулт
 */
async function searchSharePoint(query) {
  const accessToken = await getGraphToken();

  const url = 'https://graph.microsoft.com/v1.0/search/query';

  const body = {
    requests: [
      {
        entityTypes: ['driveItem'],
        query: {
          queryString: query
        },
        from: 0,
        size: 5
      }
    ]
  };

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

module.exports = {
  searchSharePoint
};
