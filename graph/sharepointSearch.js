const { Client } = require('@microsoft/microsoft-graph-client');
const { getGraphToken } = require('./token');
async function searchSharePoint(query) {
 const accessToken = await getGraphToken();
 const client = Client.init({
   authProvider: (done) => done(null, accessToken),
 });
 const result = await client
   .api('/search/query')
   .post({
     requests: [
       {
         entityTypes: ['driveItem'],
         query: {
           queryString: query,
         },
         from: 0,
         size: 5,
       },
     ],
   });
 const hits =
   result.value?.[0]?.hitsContainers?.[0]?.hits || [];
 return hits.map((h) => ({
   title: h.resource.name,
   url: h.resource.webUrl,
   summary: h.resource.name,
 }));
}
module.exports = {
 searchSharePoint,
};
