const axios = require("axios");
const { extractTextWithOCR } = require("../ocr/azureRead"); // ⚠ зөв зам
const { getGraphToken } = require("./token");
async function processFiles(files) {
 const extractedTextMap = {};
 let ocrUsed = false;
 // 🔑 Graph access token ЭНДЭЭС авна
 const accessToken = await getGraphToken();
 for (const file of files) {
   try {
     // 1️⃣ SharePoint file татах
     const res = await axios.get(file.downloadUrl, {
       headers: {
         Authorization: `Bearer ${accessToken}`,
       },
       responseType: "arraybuffer",
     });
     // 2️⃣ PDF бол OCR
     if (file.name.toLowerCase().endsWith(".pdf")) {
       const text = await extractTextWithOCR(res.data);
       extractedTextMap[file.name] = text;
       ocrUsed = true;
     }
   } catch (e) {
     console.error("File process error:", e.response?.status, e.message);
   }
 }
 return { extractedTextMap, ocrUsed };
}
module.exports = { processFiles };
