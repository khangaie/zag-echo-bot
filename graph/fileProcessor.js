const axios = require('axios');
const { extractTextWithOCR } = require('../ocr/azureRead');

async function downloadFileSmart(item, accessToken) {

  // 1) GRAPH /content FIRST (auth required → 403 байхгүй)
  if (item.driveId && item.id) {
    const url = `https://graph.microsoft.com/v1.0/drives/${item.driveId}/items/${item.id}/content`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.data;
  }

  // 2) webUrl fallback
  if (item.webUrl) {
    const res = await axios.get(item.webUrl, { responseType: 'arraybuffer' });
    return res.data;
  }

  throw new Error('Invalid file. Missing id/driveId.');
}

async function processFiles(files, accessToken) {
  const extractedTextMap = {};
  let ocrUsed = false;

  for (const file of files) {
    const buffer = await downloadFileSmart(file, accessToken);
    if (file.name.toLowerCase().endsWith('.pdf')) {
      extractedTextMap[file.name] = await extractTextWithOCR(buffer);
      ocrUsed = true;
    } else {
      extractedTextMap[file.name] = '';
    }
  }

  return { extractedTextMap, ocrUsed };
}

module.exports = { processFiles };
