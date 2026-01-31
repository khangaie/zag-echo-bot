const axios = require('axios');
const { extractTextWithOCR } = require('../ocr/azureRead');
async function processFiles(files, accessToken) {
 const extractedTextMap = {};
 let ocrUsed = false;
 if (!accessToken) {
   throw new Error('processFiles: accessToken байхгүй');
 }
 for (const file of files) {
   try {
     const res = await axios.get(file.webUrl, {
       headers: {
         Authorization: `Bearer ${accessToken}`
       },
       responseType: 'arraybuffer'
     });
     if (file.name.toLowerCase().endsWith('.pdf')) {
       const text = await extractTextWithOCR(res.data);
       extractedTextMap[file.name] = text;
       ocrUsed = true;
     }
   } catch (e) {
     console.error('File process error:', e.message);
   }
 }
 return { extractedTextMap, ocrUsed };
}
module.exports = { processFiles };
