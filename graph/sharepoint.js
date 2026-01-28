const axios = require('axios');
const { getGraphToken } = require('./token');

async function searchSharePoint(query) {
  const token = await getGraphToken();

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
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

module.exports = { searchSharePoint };
