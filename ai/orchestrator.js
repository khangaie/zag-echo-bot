// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint, searchSharePointBroad } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const THREAD_CTX = new Map(); // threadId -> { docs, lastQ }
const uniqBy = (arr, key) =>
  Array.from(new Map((arr || []).map(x => [key(x), x])).values());

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function scoreDoc(question, content = '') {
  if (!content) return 0;
  const qTokens = (question || '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(t => t.length > 1);
  const text = content.toLowerCase();
  return qTokens.reduce((s, t) => s + (text.match(new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g')) || []).length, 0);
}
function focusSnippet(question, content, max = 4000) {
  if (!content) return '';
  const q = (question || '').split(/\s+/).filter(Boolean).slice(0, 6);
  const idx = q.map(k => content.toLowerCase().indexOf(k.toLowerCase()))
              .filter(i => i >= 0).sort((a,b)=>a-b)[0] ?? 0;
  const start = Math.max(0, idx - Math.floor(max/2));
  return content.slice(start, start + max);
}
function rewriteQuery(question, history = [], pinned = []) {
  // өнгөрсөн асуулт, өмнөх баримтын нэршлүүдийг query-д шингээнэ
  const prevQ = [...history].reverse().map(h => h?.text).find(Boolean) || '';
  const names = (pinned || []).map(d => d.fileName).filter(Boolean).slice(0, 3).join(' ');
  const joined = [question, prevQ, names].filter(Boolean).join(' ');
  return joined.length > 400 ? joined.slice(-400) : joined; // Graph query урт хязгаар
}

async function answerQuestion(question, { threadId = 'default', history = [] } = {}) {
  const sticky = THREAD_CTX.get(threadId) || { docs: [], lastQ: '' };
  const token = await getGraphToken();

  // 1) AI Search
  const aiSnippets = await retrievePassages(question, 6);
  const aiDocs = (aiSnippets || []).map(d => ({
    id: d.id, driveId: d.driveId,
    fileName: d.fileName || d.title || 'Source',
    url: d.webUrl || d.url,
    content: d.content || ''
  }));

  // 2) SharePoint search — narrow
  let spFiles = await searchSharePoint(rewriteQuery(question, history, sticky.docs), token);
  if (!spFiles || spFiles.length === 0) {
    // 2b) fallback — өргөн Graph Search (/search/query)
    spFiles = await searchSharePointBroad(rewriteQuery(question, history, sticky.docs), token);
  }

  // 3) Бүх SP илэрцээс текст гаргах
  const toProcess = (spFiles || []).map(f => ({ id: f.id, driveId: f.driveId, name: f.name, webUrl: f.webUrl }));
  let extractedTextMap = {}, ocrUsed = false;
  if (toProcess.length > 0) {
    const r = await processFiles(toProcess, token);
    extractedTextMap = r.extractedTextMap || {};
    ocrUsed = !!r.ocrUsed;
  }
  const spDocs = (spFiles || []).map(f => ({
    id: f.id, driveId: f.driveId, fileName: f.name, url: f.webUrl,
    content: extractedTextMap[f.name] || ''
  }));

  // 4) Merge + Dedup
  let docs = uniqBy([...aiDocs, ...spDocs], d => d.url || d.fileName);

  // 5) Rank; контентгүй бол sticky/context fallback
  const ranked = docs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content) }))
    .filter(d => (d.content || '').length > 100)
    .sort((a,b)=> b._score - a._score);

  let topDocs = ranked.slice(0, 5);
  if (topDocs.length === 0 && sticky.docs.length) {
    topDocs = sticky.docs; // өмнөх баримтын хүрээнд хариулна
  }
  if (topDocs.length === 0) {
    topDocs = aiDocs.slice(0, 5); // хамгийн сүүлчийн fallback
  }

  // 6) Focus map — LLM-д зөвхөн хамааралтай хэсгийг дамжуулна
  const focusedMap = {};
  for (const d of topDocs) focusedMap[d.fileName] = focusSnippet(question, d.content, 4000);

  // 7) Хариулт
  const ans = await askAI(question, topDocs);

  // 8) Sticky context хадгална
  THREAD_CTX.set(threadId, { docs: topDocs, lastQ: question });

  return { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed };
}

module.exports = { answerQuestion };
