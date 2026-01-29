const axios = require('axios');

async function searchSharePoint(query, accessToken) {
  const url = 'https://graph.microsoft.com/v1.0/search/query';

  const payload = {
    requests: [
      {
        entityTypes: ['driveItem'], // ✅ lowercase
        query: {
          queryString: query
        },
        from: 0,
        size: 5
      }
    ]
  };

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
}

module.exports = { searchSharePoint };
