// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint, searchSharePointBroad } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const { detectIntent } = require('./intentDetector');
const { resolveFolders } = require('./folderRouter');
const { contractCache, makeContractCacheKey } = require('./contractCache');

const THREAD_CTX = new Map(); // threadId -> { docs, lastQ }

const uniqBy = (arr, key) =>
  Array.from(new Map((arr || []).map(x => [key(x), x])).values());

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|\n[\]\\]/g, '\\$&');
}

function scoreDoc(question, content = '') {
  if (!content) return 0;
  const qTokens = (question || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const text = content.toLowerCase();
  return qTokens.reduce(
    (s, t) => s + (text.match(new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g')) || []).length,
    0
  );
}

function focusSnippet(question, content, max = 4000) {
  if (!content) return '';
  const q = (question || '').split(/\s+/).filter(Boolean).slice(0, 6);
  const idx =
    q.map(k => content.toLowerCase().indexOf(k.toLowerCase()))
      .filter(i => i >= 0)
      .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, idx - Math.floor(max / 2));
  return content.slice(start, start + max);
}

function rewriteQuery(question, history = [], pinned = []) {
  const prevQ = [...history].reverse().map(h => h?.text).find(Boolean) || '';
  const names = (pinned || []).map(d => d.fileName).filter(Boolean).slice(0, 3).join(' ');
  const joined = [question, prevQ, names].filter(Boolean).join(' ');
  return joined.length > 400 ? joined.slice(-400) : joined;
}

// ✅ Contract: keyword narrowing (SMC auto-filter)
function contractQueryNarrow(question, hasSMC) {
  const q = String(question || '').toLowerCase();
  // keep only useful tokens
  let base = q
    .replace(/т(эй|тай|тэй)/gi, ' ')
    .replace(/хийсэн|байгуулсан|чухал|заалт|ямар|юу|тухай/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // prefer "smc гэрээ" if smc mentioned
  if (hasSMC && !base.includes('smc')) base = `smc ${base}`;
  if (!base.includes('гэрээ') && /contract|гэрээ/i.test(q)) base = `${base} гэрээ`;
  return base.slice(0, 120);
}

async function answerQuestion(question, { threadId = 'default', history = [] } = {}) {
  const sticky = THREAD_CTX.get(threadId) || { docs: [], lastQ: '' };

  const intent = detectIntent(question);
  const domain = intent.domain || 'general';
  const needSteps = !!intent.needSteps;
  const hasSMC = !!intent.hasSMC;

  // ✅ CONTRACT PRE-INDEXED CACHE (0 Graph / 0 OCR)
  if (domain === 'contract') {
    const key = makeContractCacheKey(question, { domain, smc: hasSMC });
    const cached = contractCache.get(key);
    if (cached) {
      return { ...cached, domain, needSteps, folders: ['CONTRACT-AI'], ocrUsed: false };
    }
  }

  // 1) Prefer AI Search (0 Graph)
  const qForSearch = (domain === 'contract')
    ? contractQueryNarrow(question, hasSMC)
    : question;

  const aiSnippets = await retrievePassages(qForSearch, 8);
  let aiDocs = (aiSnippets || []).map(d => ({
    id: d.id,
    driveId: d.driveId,
    fileName: d.fileName || d.title || 'Source',
    url: d.webUrl || d.url,
    content: d.content || ''
  }));

  // ✅ SMC auto-filter (only keep SMC-related docs when smc in query)
  if (domain === 'contract' && hasSMC) {
    const filtered = aiDocs.filter(d => String(d.fileName || '').toLowerCase().includes('smc'));
    if (filtered.length) aiDocs = filtered;
  }

  // If AI search gives usable content, answer with 0 Graph / 0 OCR
  const aiRanked = aiDocs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content) }))
    .filter(d => (d.content || '').length > 80)
    .sort((a, b) => b._score - a._score);

  if (domain === 'contract' && aiRanked.length > 0) {
    const topDocs = aiRanked.slice(0, 5);
    const focusedMap = {};
    for (const d of topDocs) focusedMap[d.fileName] = focusSnippet(question, d.content, 4000);

    const ans = await askAI(question, topDocs, { needSteps: false, domain, smc: hasSMC });

    const payload = {
      ans,
      docs: topDocs,
      extractedTextMap: focusedMap,
      ocrUsed: false
    };

    // cache it
    const key = makeContractCacheKey(question, { domain, smc: hasSMC });
    contractCache.set(key, payload);

    THREAD_CTX.set(threadId, { docs: topDocs, lastQ: question });
    return { ...payload, domain, needSteps: false, folders: ['CONTRACT-AI'] };
  }

  // 2) Fallback: minimal SharePoint search (Graph) — but NO OCR for contract
  const token = await getGraphToken();

  const folders = resolveFolders(domain, question, hasSMC);

  // IMPORTANT: keep SP calls minimal, no broad fanout
  let spFiles = await searchSharePoint(rewriteQuery(qForSearch, history, sticky.docs), token, folders);
  if (!spFiles || spFiles.length === 0) {
    spFiles = await searchSharePointBroad(rewriteQuery(qForSearch, history, sticky.docs), token);
  }

  // ✅ OCR policy: contract => OFF
  const needOCR = domain !== 'contract';

  const toProcess = (spFiles || []).slice(0, 5).map(f => ({
    id: f.id,
    driveId: f.driveId,
    name: f.name,
    webUrl: f.webUrl
  }));

  let extractedTextMap = {};
  let ocrUsed = false;

  if (needOCR && toProcess.length > 0) {
    const r = await processFiles(toProcess, token);
    extractedTextMap = r.extractedTextMap || {};
    ocrUsed = !!r.ocrUsed;
  }

  const spDocs = (spFiles || []).slice(0, 5).map(f => ({
    id: f.id,
    driveId: f.driveId,
    fileName: f.name,
    url: f.webUrl,
    content: extractedTextMap[f.name] || '' // may be empty
  }));

  let docs = uniqBy([...aiDocs, ...spDocs], d => d.url || d.fileName);

  // ✅ Even if content empty, if files exist we still proceed (template answer)
  const ranked = docs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content || '') }))
    .sort((a, b) => b._score - a._score);

  let topDocs = ranked.slice(0, 5);
  if (topDocs.length === 0 && sticky.docs.length) topDocs = sticky.docs;
  if (topDocs.length === 0) topDocs = aiDocs.slice(0, 5);

  const focusedMap = {};
  for (const d of topDocs) focusedMap[d.fileName] = focusSnippet(question, d.content || '', 4000);

  const ans = await askAI(question, topDocs, { needSteps, domain, smc: hasSMC });

  const result = { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed, domain, needSteps, folders };

  // cache contract fallback result too
  if (domain === 'contract') {
    const key = makeContractCacheKey(question, { domain, smc: hasSMC });
    contractCache.set(key, { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed: false });
  }

  THREAD_CTX.set(threadId, { docs: topDocs, lastQ: question });
  return result;
}

module.exports = { answerQuestion };
