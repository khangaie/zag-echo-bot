const axios = require("axios");

async function searchSharePoint(query, accessToken) {
  const url = "https://graph.microsoft.com/v1.0/search/query";

  const payload = {
    requests: [
      {
        entityTypes: ["driveItem"],
        query: {
          queryString: query
        },
        fields: [],         // 🔥 Заавал байх
        size: 5             // 🔥 OK
      }
    ]
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const hits = res.data?.value?.[0]?.hitsContainers?.[0]?.hits || [];
  return hits.map(h => ({
    name: h.resource?.name,
    url: h.resource?.webUrl
  }));
}

module.exports = { searchSharePoint };
