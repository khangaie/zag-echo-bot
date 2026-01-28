const axios = require('axios');

/**
 * SharePoint дээр текст хайх
 * @param {string} accessToken - Microsoft Graph access token
 * @param {string} query - Хэрэглэгчийн асуулт
 */
async function searchSharePoint(accessToken, query) {
  if (!accessToken) {
    throw new Error('GRAPH_TOKEN байхгүй байна');
  }

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
