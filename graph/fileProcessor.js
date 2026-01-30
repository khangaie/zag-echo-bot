const axios = require('axios');
const { runOCR } = require('../ocr/azureRead');

/**
 * Text хангалттай эсэхийг шалгана
 */
function isScanned(text) {
  return !text || text.trim().length < 200;
}

/**
 * SharePoint-оос файл байтаар татах
 */
async function downloadFile(downloadUrl, accessToken) {
  const res = await axios.get(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    responseType: 'arraybuffer'
  });
  return Buffer.from(res.data);
}

/**
 * Нэг файлын текстийг гаргаж авах
 */
async function extractTextFromFile(file, accessToken) {
  let text = file.content || '';
  let usedOCR = false;

  // 👉 scanned эсэхийг шалгаад OCR дуудах
  if (isScanned(text)) {
    try {
      const buffer = await downloadFile(file.downloadUrl, accessToken);
      text = await runOCR(buffer);
      usedOCR = true;
    } catch (err) {
      console.error('OCR failed:', err.message);
    }
  }

  return {
    text,
    usedOCR
  };
}

/**
 * Бүх document-уудыг боловсруулах
 */
async function processDocuments(documents, accessToken) {
  const results = [];
  let ocrUsedAny = false;
  let totalTextLength = 0;

  for (const doc of documents) {
    const { text, usedOCR } = await extractTextFromFile(doc, accessToken);

    if (text && text.trim().length > 0) {
      totalTextLength += text.length;
      ocrUsedAny = ocrUsedAny || usedOCR;

      results.push({
        title: doc.name,
        text,
        webUrl: doc.webUrl
      });
    }
  }

  // 👉 Confidence score логик
  let confidence = 60;
  if (ocrUsedAny) confidence += 20;
  if (totalTextLength > 2000) confidence += 10;
  if (confidence > 95) confidence = 95;

  return {
    documents: results,
    confidence
  };
}

module.exports = {
  processDocuments
};
