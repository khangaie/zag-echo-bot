const { extractTextFromPdf } = require("../ocr/azureRead");

async function processFiles(files) {
  const extractedTextMap = {};
  let ocrUsed = false;

  for (const file of files) {
    if (file.mimeType === "application/pdf") {
      if (file.isScanned) {
        extractedTextMap[file.id] =
          await extractTextFromPdf(file.buffer);
        ocrUsed = true;
      } else {
        extractedTextMap[file.id] = file.text;
      }
    }
  }

  return { extractedTextMap, ocrUsed };
}

module.exports = { processFiles };
