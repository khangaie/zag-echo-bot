// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const uniqBy = (arr, key) => Array.from(new Map((arr || []).map(x => [key(x), x])).values());

// энгийн нэр-адилсын оноо (диакритикгүй, lower-case)
function scoreByTitle(query, name) {
  const q = String(query).toLowerCase();
  const n = String(name || '').toLowerCase();
  let s = 0;
  ['гэрээ', 'байгуулах', 'процесс', 'гэрээ байгуулах'].forEach(w => { if (q.includes(w) && n.includes(w)) s += 2; });
  // яг “гэрээ байгуулах процесс” орсон бол илүү оноо
  if (n.includes('гэрээ байгуулах') && n.includes('процесс')) s += 4;
  // яг бүрэн таарах эсвэл ихэнх хэсэг нь таарах
  if (n.includes(q)) s += 3;
  return s;
}

function pickBestPdfByTitle(question, spFiles = []) {
  const pdfs = (spFiles || []).filter(f => {
    const name = (f.name || f.fileName || '').toLowerCase();
    return name.endsWith('.pdf') || (f.fileType === 'pdf');
  });
  if (pdfs.length === 0) return null;
  const sorted = pdfs
    .map(f => ({ f, s: scoreByTitle(question, f.name || f.fileName) }))
    .sort((a, b) => b.s - a.s);
  return sorted[0]?.f || null;
}

async function answerQuestion(question) {
  // 1) AI Search (optional) + 2) SharePoint
  const aiSnippets = await retrievePassages(question, 6);
  const token = await getGraphToken();
  const spFiles = await searchSharePoint(question, token);

  // 3) Нэр таарсан PDF-ээ илүүцгүй OCR-лож documents-д контенттойгоор оруулах
  const chosen = pickBestPdfByTitle(question, spFiles);
  let docs = [];
  let extractedTextMap = {};
  let ocrUsed = false;

  if (chosen) {
    // OCR run
    const { extractedTextMap: m, ocrUsed: used } = await processFiles(
      [{
        id: chosen.id,
        driveId: chosen.driveId, // sharepointSearch.js аль хэдийн өгдөг
        name: chosen.name,
        webUrl: chosen.webUrl
      }],
      token
    );
    extractedTextMap = m || {};
    ocrUsed = !!used;

    const content = extractedTextMap[chosen.name] || '';
    docs = [{
      fileName: chosen.name,
      url: chosen.webUrl,
      content,
      driveId: chosen.driveId
    }];
  } else {
    // OCR хийх сонголтгүй бол урьдын адил refs + AI snippets-ийг нэгтгэнэ
    const spRefs = (spFiles || []).map(f => ({
      fileName: f.name,
      url: f.webUrl,
      content: '',
      driveId: f.driveId
    }));
    docs = uniqBy([...(aiSnippets || []), ...spRefs], d => d.url || d.fileName).slice(0, 8);
  }

  const ans = await askAI(question, docs);
  return { ans, docs, extractedTextMap, ocrUsed };
}

module.exports = { answerQuestion };
