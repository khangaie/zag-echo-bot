// graph/fileProcessor.js
const axios = require('axios');
const { extractTextWithOCR } = require('../ocr/azureRead'); // таны OCR функцийн замыг тааруул

function isValidUrl(u) {
  try { new URL(u); return true; } catch { return false; }
}

/**
 * files: [{ id, driveId, name, webUrl, ... }]
 * accessToken: Graph token (app-only эсвэл delegated)
 * PDF байх үед OCR хийж, бусад үед зүгээр текст буцаах жишээ
 */
async function processFiles(files, accessToken) {
  const extractedTextMap = {};
  let ocrUsed = false;

  for (const file of files) {
    try {
      const buffer = await downloadFileSmart(file, accessToken);

      // content-type мэдэх боломжгүй үед өргөтгөлөөр ялгая
      const fileName = file.name || '';
      if (fileName.toLowerCase().endsWith('.pdf')) {
        extractedTextMap[fileName] = await extractTextWithOCR(buffer);
        ocrUsed = true;
      } else {
        // PDF биш бол энгийн text (хэрэв задлах шаардлагатай бол өөрийн парсер оруул)
        extractedTextMap[fileName] = '[Downloaded non-PDF file]';
      }
    } catch (e) {
      console.error('File error:', e.message);
    }
  }

  return { extractedTextMap, ocrUsed };
}

async function downloadFileSmart(item, accessToken) {
  // 1) webUrl хүчинтэй бол шууд татах
  if (item.webUrl && isValidUrl(item.webUrl)) {
    const res = await axios.get(item.webUrl, { responseType: 'arraybuffer' });
    return res.data;
  }

  // 2) Graph content fallback
  if (item.driveId && item.id) {
    const url = `https://graph.microsoft.com/v1.0/drives/${item.driveId}/items/${item.id}/content`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  }

  throw new Error('Invalid URL and no Graph identifiers to download content.');
}

module.exports = { processFiles };
``
