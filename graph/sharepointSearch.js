const axios = require('axios');

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

  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const hits =
    response.data.value[0]?.hitsContainers[0]?.hits || [];

  return hits.map(h => ({
    fileName: h.resource.name,
    folder: h.resource.parentReference?.path || 'Unknown',
    url: h.resource.webUrl,
    content: h.resource?.summary || ''
  }));
}

module.exports = { searchSharePoint };
