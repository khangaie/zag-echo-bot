const axios = require('axios');

/**
 * Search SharePoint / OneDrive documents via Microsoft Graph
 * @param {string} query
 * @param {string} accessToken
 */
async function searchSharePoint(query, accessToken) {
  const url = 'https://graph.microsoft.com/v1.0/search/query';

  const payload = {
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

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const hits =
      response.data?.value?.[0]?.hitsContainers?.[0]?.hits || [];

    return hits.map(h => ({
      fileName: h.resource?.name || 'Unknown',
      path: h.resource?.parentReference?.path || '',
      url: h.resource?.webUrl || '',
      summary: h.resource?.summary || ''
    }));
  } catch (err) {
    console.error('Graph search error:', err.response?.data || err.message);
    throw new Error('SharePoint хайлт амжилтгүй боллоо');
  }
}

module.exports = { searchSharePoint };
