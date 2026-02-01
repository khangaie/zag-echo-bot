const axios = require('axios');
const { extractTextWithOCR } = require('../ocr/azureRead');
async function processFiles(files, accessToken) {
 const extractedTextMap = {};
 let ocrUsed = false;
 for (const file of files) {
   try {
     const res = await axios.get(file.url, {
       headers: { Authorization: `Bearer ${accessToken}` },
       responseType: 'arraybuffer'
     });
     if (file.fileName.toLowerCase().endsWith('.pdf')) {
       extractedTextMap[file.fileName] =
         await extractTextWithOCR(res.data);
       ocrUsed = true;
     }
   } catch (e) {
     console.error('File error:', e.message);
   }
 }
 return { extractedTextMap, ocrUsed };
}
module.exports = { processFiles };
