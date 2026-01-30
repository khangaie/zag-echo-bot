const axios = require('axios');
/**
* SharePoint site + library доторх файлуудыг хайна
* Application permission (client credentials) ашиглана
*/
async function searchSharePointFiles({
 accessToken,
 siteId,
 query,
 fileTypes = ['pdf']
}) {
 const files = [];
 if (!siteId) {
   throw new Error('❌ siteId is required');
 }
 console.log('🔎 SharePoint search:', query);
 // Site дээр search хийх
 const searchUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/search(q='${encodeURIComponent(
   query
 )}')`;
 const res = await axios.get(searchUrl, {
   headers: {
     Authorization: `Bearer ${accessToken}`
   }
 });
 const items = res.data?.value || [];
 for (const item of items) {
   // File биш бол алгасна
   if (!item.file || !item.name) continue;
   const ext = item.name.split('.').pop().toLowerCase();
   if (!fileTypes.includes(ext)) continue;
   // driveId + itemId заавал хэрэгтэй
   const driveId = item.parentReference?.driveId;
   const itemId = item.id;
   if (!driveId || !itemId) {
     console.warn('⚠️ Missing driveId/itemId for:', item.name);
     continue;
   }
   files.push({
     id: itemId,
     driveId,
     fileName: item.name
   });
 }
 console.log(`📄 Found ${files.length} files`);
 return files;
}
module.exports = { searchSharePointFiles };
