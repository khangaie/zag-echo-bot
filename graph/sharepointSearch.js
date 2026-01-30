const axios = require("axios");
const { getGraphToken } = require("./token");
async function searchSharePointFiles(query) {
 const accessToken = await getGraphToken();
 const url = `https://graph.microsoft.com/v1.0/search/query`;
 const body = {
   requests: [
     {
       entityTypes: ["driveItem"],
       query: {
         queryString: query,
       },
       from: 0,
       size: 5,
     },
   ],
 };
 const res = await axios.post(url, body, {
   headers: {
     Authorization: `Bearer ${accessToken}`,
     "Content-Type": "application/json",
   },
 });
 // driveItem → хэрэгтэй хэлбэрт оруулах
 return res.data.value[0].hitsContainers[0].hits.map((h) => ({
   name: h.resource.name,
   downloadUrl: h.resource["@microsoft.graph.downloadUrl"],
   webUrl: h.resource.webUrl,
 }));
}
module.exports = { searchSharePointFiles };
