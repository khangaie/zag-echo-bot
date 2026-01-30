const axios = require("axios");

const SITE_ID =
  "zagengineering.sharepoint.com,4ffeaa0c-8ee5-474b-844f-82344651c399,a91eeb81-1e30-4f71-968d-96e1d034da50";

async function searchSharePoint(query, accessToken) {
  const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/drive/search(q='${encodeURIComponent(
    query
  )}')`;

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return res.data.value.map((item) => ({
      fileName: item.name,
      url: item.webUrl,
      lastModified: item.lastModifiedDateTime,
    }));
  } catch (err) {
    console.error(
      "SharePoint search error:",
      err.response?.data || err.message
    );
    throw err;
  }
}

module.exports = { searchSharePoint };
