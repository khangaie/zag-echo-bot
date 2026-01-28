const axios = require('axios');

/**
 * SharePoint / OneDrive дээрээс текстээр хайна
 * @param {string} accessToken - Microsoft Graph access token
 * @param {string} query - хэрэглэгчийн асуулт
 */
async function searchSharePoint(accessToken, query) {
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

    return response.data.value[0];
}

module.exports = {
    searchSharePoint
};
