// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const uniqBy = (arr, key) =>
  Array.from(new Map((arr || []).map(x => [key(x), x])).values());

async function answerQuestion(question) {
  // 1) AI Search
  const aiSnippets = await retrievePassages(question, 6);

  // 2) SharePoint search
  const token = await getGraphToken();
  const spFiles = await searchSharePoint(question, token);

  // 3) SharePoint files must include id + driveId
  const spRefs = (spFiles || []).map(f => ({
    id: f.id,
    driveId: f.driveId,
    fileName: f.name,
    url: f.webUrl,
    content: ''
  }));

  // 4) Merge
  let docs = uniqBy(
    [...(aiSnippets || []), ...spRefs],
    d => d.url || d.fileName
  ).slice(0, 5);

  // 5) PDFs selected for OCR
  const pdfTargets = docs
    .filter(d => d.fileName && d.fileName.toLowerCase().endsWith('.pdf'))
    .map(d => ({
      id: d.id,
      driveId: d.driveId,
      name: d.fileName,
      webUrl: d.url
    }));

  let extractedTextMap = {};
  let ocrUsed = false;

  if (pdfTargets.length > 0) {
    const r = await processFiles(pdfTargets, token);
    extractedTextMap = r.extractedTextMap;
    ocrUsed = r.ocrUsed;

    // merge OCR text back into docs
    docs = docs.map(d => ({
      ...d,
      content: extractedTextMap[d.fileName] || d.content
    }));
  }

  // 6) AI structured answer
  const ans = await askAI(question, docs);

  return { ans, docs, extractedTextMap, ocrUsed };
}

module.exports = { answerQuestion };
