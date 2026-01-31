const axios = require('axios');
/**
* SharePoint дээр файл хайх
*/
async function searchSharePoint({ query, accessToken }) {
 if (!accessToken) {
   throw new Error('accessToken байхгүй');
 }
 const endpoint = 'https://graph.microsoft.com/v1.0/search/query';
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
 const res = await axios.post(endpoint, body, {
   headers: {
     Authorization: `Bearer ${accessToken}`,
     'Content-Type': 'application/json'
   }
 });
 const hits =
   res.data?.value?.[0]?.hitsContainers?.[0]?.hits || [];
 return hits.map(h => ({
   name: h.resource.name,
   webUrl: h.resource.webUrl
 }));
}
module.exports = {
 searchSharePoint
};
