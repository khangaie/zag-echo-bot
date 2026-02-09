// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const uniqBy = (arr, key) =>
  Array.from(new Map((arr || []).map(x => [key(x), x])).values());

/** энгийн keyword score — асуултын түлхүүрүүд хэд давтагдсанаар эрэмбэлнэ */
function scoreDoc(question, content = '') {
  if (!content) return 0;
  const qTokens = (question || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
  const text = content.toLowerCase();
  let s = 0;
  for (const t of qTokens) {
    const m = text.match(new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g'));
    s += m ? m.length : 0;
  }
  return s;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** асуулттай холбоотой "фокус" хэсгийг тасдаж авах */
function focusSnippet(question, content, max = 4000) {
  if (!content) return '';
  const q = (question || '').split(/\s+/).filter(Boolean).slice(0, 6);
  const idx = q
    .map(k => content.toLowerCase().indexOf(k.toLowerCase()))
    .filter(i => i >= 0)
    .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, idx - Math.floor(max / 2));
  return content.slice(start, start + max);
}

async function answerQuestion(question) {
  // ---------------- 1) AI Search (семантик/эсвэл энгийн) ----------------
  const aiSnippets = await retrievePassages(question, 6);
  const aiDocs = (aiSnippets || []).map(d => ({
    id: d.id,
    driveId: d.driveId,
    fileName: d.fileName || d.title || 'Source',
    url: d.webUrl || d.url,
    content: d.content || '' // AI Search өөрөө өгдөг chunk
  }));

  // ---------------- 2) SharePoint search (Graph) ----------------
  const token = await getGraphToken();
  const spFiles = await searchSharePoint(question, token);
  // SP илэрцүүдэд контент хоосон тул бүгдийг processFiles-рээр уншина
  const toProcess = (spFiles || []).map(f => ({
    id: f.id,
    driveId: f.driveId,
    name: f.name,
    webUrl: f.webUrl
  }));

  let extractedTextMap = {};
  let ocrUsed = false;

  if (toProcess.length > 0) {
    // processFiles: docx/pdf/pptx/xlsx бүгдийг уншина (танай төслийн fileProcessor.js-тай нийцнэ)
    const r = await processFiles(toProcess, token);
    extractedTextMap = r.extractedTextMap || {};
    ocrUsed = !!r.ocrUsed;
  }

  const spDocs = (spFiles || []).map(f => {
    const text = extractedTextMap[f.name] || '';
    return {
      id: f.id,
      driveId: f.driveId,
      fileName: f.name,
      url: f.webUrl,
      content: text
    };
  });

  // ---------------- 3) Merge + Dedup + Rank ----------------
  let docs = uniqBy([...aiDocs, ...spDocs], d => d.url || d.fileName);

  // контентгүй баримтыг арилгаж, оноогоор эрэмбэлээд TOP-K сонгоно
  const scored = docs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content) }))
    .filter(d => (d.content || '').length > 100)   // хоосон/богино текстүүдийг хаяна
    .sort((a, b) => b._score - a._score);

  const topK = scored.slice(0, 5);
  // Хэрэв оноо бүгд 0 байвал—AI Search chunks-оо fallback болгон үлдээнэ
  const topDocs = topK.length ? topK : aiDocs.slice(0, 5);

  // ---------------- 4) Focused extractedTextMap ----------------
  // processStepExtractor зөв ажиллаж, flowchart "сонин" харагдахгүй байхаар
  // хамгийн хамааралтай баримтуудын ФОКУС хэсгийг л өгнө.
  const focusedMap = {};
  for (const d of topDocs) {
    focusedMap[d.fileName] = focusSnippet(question, d.content, 4000);
  }

  // ---------------- 5) Асуултад баримтаар суурилсан хариу ----------------
  const ans = await askAI(question, topDocs);

  // UI-д ашиглах extractedTextMap-ийг focused хувилбараар буцаана
  return { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed };
}

module.exports = { answerQuestion };
