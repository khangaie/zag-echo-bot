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
        const text = await extractTextWithOCR(res.data);
        extractedTextMap[file.fileName] = text;
        ocrUsed = true;
      }
    } catch (e) {
      console.error('File process error:', e.message);
    }
  }

  return { extractedTextMap, ocrUsed };
}

module.exports = { processFiles };

