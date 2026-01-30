const axios = require('axios');
const pdfParse = require('pdf-parse');
const { readWithAzureVision } = require('./azureRead');
/**
* SharePoint-оос олдсон файлуудыг уншиж текст гаргана
* @param {Array} files - sharepointSearch.js-оос ирсэн файлууд
* @param {string} accessToken - Microsoft Graph Application Token
*/
async function processFiles(files, accessToken) {
 const extractedTextMap = {};
 let ocrUsed = false;
 for (const file of files) {
   try {
     if (!file.driveId || !file.itemId) {
       console.warn('⚠️ driveId / itemId байхгүй файл алгаслаа');
       continue;
     }
     // 1️⃣ SharePoint file download
     const downloadUrl =
       `https://graph.microsoft.com/v1.0/drives/${file.driveId}/items/${file.itemId}/content`;
     const fileRes = await axios.get(downloadUrl, {
       headers: {
         Authorization: `Bearer ${accessToken}`
       },
       responseType: 'arraybuffer'
     });
     const buffer = Buffer.from(fileRes.data);
     const fileName = (file.fileName || '').toLowerCase();
     let text = '';
     // 2️⃣ PDF
     if (fileName.endsWith('.pdf')) {
       try {
         const pdfData = await pdfParse(buffer);
         if (pdfData.text && pdfData.text.trim().length > 50) {
           // 👉 Text-based PDF
           text = pdfData.text;
         } else {
           // 👉 Scanned PDF → OCR
           text = await readWithAzureVision(buffer, 'application/pdf');
           ocrUsed = true;
         }
       } catch (e) {
         // 👉 PDF parse алдаа → OCR руу шууд
         text = await readWithAzureVision(buffer, 'application/pdf');
         ocrUsed = true;
       }
     }
     // 3️⃣ Image (jpg, png)
     else if (
       fileName.endsWith('.png') ||
       fileName.endsWith('.jpg') ||
       fileName.endsWith('.jpeg')
     ) {
       text = await readWithAzureVision(buffer, 'image');
       ocrUsed = true;
     }
     // 4️⃣ Бусад файлыг одоохондоо алгасна
     else {
       console.log(`ℹ️ Алгассан файл: ${fileName}`);
       continue;
     }
     if (text && text.trim()) {
       extractedTextMap[fileName] = text;
     }
   } catch (err) {
     console.error(
       '❌ File processing error:',
       file.fileName,
       err.response?.status,
       err.message
     );
   }
 }
 return {
   extractedTextMap,
   ocrUsed
 };
}
module.exports = { processFiles };
