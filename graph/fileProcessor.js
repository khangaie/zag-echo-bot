// graph/fileProcessor.js
const axios = require('axios');
const { extractTextWithOCR } = require('../ocr/azureRead');

async function downloadFileSmart(item, accessToken) {
  if (item.driveId && item.id) {
    const url = `https://graph.microsoft.com/v1.0/drives/${item.driveId}/items/${item.id}/content`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return res.data;
  }
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
    try {
      const buffer = await downloadFileSmart(file, accessToken);
      const name = file.name || file.fileName || 'unknown';

      if (String(name).toLowerCase().endsWith('.pdf')) {
        try {
          extractedTextMap[name] = await extractTextWithOCR(buffer);
          ocrUsed = true;
        } catch (e) {
          // ✅ OCR 400 гарлаа ч bot унахгүй
          console.warn(`[OCR] failed for ${name}: ${e.response?.data?.error?.message || e.message}`);
          extractedTextMap[name] = '';
        }
      } else {
        extractedTextMap[name] = '';
      }
    } catch (e) {
      console.warn(`[File] download/extract failed: ${e.message}`);
      // нэг файл дээр алдаа гарлаа ч бусдыг үргэлжлүүлнэ
    }
  }

  return { extractedTextMap, ocrUsed };
}

module.exports = { processFiles };
