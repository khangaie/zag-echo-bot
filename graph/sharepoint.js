const axios = require('axios');

async function searchSharePoint(query, accessToken) {
  const url = 'https://graph.microsoft.com/v1.0/search/query';

  const payload = {
    requests: [
      {
        entityTypes: ['driveItem'],
        query: {
          queryString: query,
          queryTemplate: '{searchTerms}'
        },
        from: 0,
        size: 5
      }
    ]
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const hits =
      res.data?.value?.[0]?.hitsContainers?.[0]?.hits || [];

    return hits.map(h => ({
      fileName: h.resource?.name,
      url: h.resource?.webUrl,
      folder: h.resource?.parentReference?.path || '',
      content: h.resource?.summary || ''
    }));
  } catch (err) {
    console.error(
      'SharePoint Graph error:',
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = { searchSharePoint };
