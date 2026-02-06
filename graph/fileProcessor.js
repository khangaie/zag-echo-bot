// graph/fileProcessor.js
const axios = require('axios');
const { extractTextWithOCR } = require('../ocr/azureRead'); // таны OCR функц

function isValidUrl(u) {
  try { new URL(u); return true; } catch { return false; }
}

/**
 * files: [{ id, driveId, name, webUrl, ... }]
 * accessToken: Graph token (app-only эсвэл delegated)
 * PDF үед OCR, бусад үед placeholder text (хэрэв та DOCX/XLSX extractor нэмбэл энд оруулна)
 */
async function processFiles(files, accessToken) {
  const extractedTextMap = {};
  let ocrUsed = false;

  for (const file of (files || [])) {
    try {
      const buffer = await downloadFileSmart(file, accessToken);
      const fileName = file.name || '';

      if (fileName.toLowerCase().endsWith('.pdf')) {
        // PDF → OCR
        extractedTextMap[fileName] = await extractTextWithOCR(buffer);
        ocrUsed = true;
      } else {
        // PDF биш → одоогоор placeholder (дараа нь DOCX/XLSX extractor нэмэх боломжтой)
        extractedTextMap[fileName] = '[Downloaded non-PDF file]';
      }
    } catch (e) {
      console.error('File error:', e.message);
    }
  }

  return { extractedTextMap, ocrUsed };
}

async function downloadFileSmart(item, accessToken) {
  // 1) GRAPH /content (илүү найдвартай, auth-той → 403 үгүй)
  if (item.driveId && item.id) {
    const url = `https://graph.microsoft.com/v1.0/drives/${item.driveId}/items/${item.id}/content`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  }

  // 2) webUrl fallback (public/shared линк үед)
  if (item.webUrl && isValidUrl(item.webUrl)) {
    const res = await axios.get(item.webUrl, { responseType: 'arraybuffer' });
    return res.data;
  }

  throw new Error('Invalid URL and no Graph identifiers to download content.');
}

module.exports = { processFiles };
