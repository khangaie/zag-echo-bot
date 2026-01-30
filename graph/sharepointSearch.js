const axios = require('axios');

async function searchSharePoint(query, accessToken) {
  const siteId = process.env.SHAREPOINT_SITE_ID;

  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/search(q='${encodeURIComponent(query)}')`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return res.data.value.map(item => ({
    fileName: item.name,
    url: item.webUrl,
    folder: item.parentReference?.path || '',
  }));
}

module.exports = { searchSharePoint };
