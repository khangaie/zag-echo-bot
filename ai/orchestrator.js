// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch'); // INDEX_NAME env ашиглана [1](https://teams.microsoft.com/l/meeting/details?eventId=AAMkADhhMDZmOWU3LTg3NTAtNDU0Yi04YWJiLWJjODQzYmFhNzU3OQFRAAgI3mHuAjAAAEYAAAAAvq_S3HMDy02p86tJmhG3lAcA5DT40VE1k0Ck9Q8rrVakbwAAAAABDQAA5DT40VE1k0Ck9Q8rrVakbwAE6f2d7QAAEA%3d%3d)
const { searchSharePoint, searchSharePointBroad } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const { detectIntent } = require('./intentDetector');
const { resolveFolders } = require('./folderRouter');
const { contractCache, makeContractCacheKey } = require('./contractCache');

const THREAD_CTX = new Map();

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

  const text = String(content || '').toLowerCase();
  return qTokens.reduce(
    (s, t) => s + (text.match(new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g')) || []).length,
    0
  );
}

function focusSnippet(question, content, max = 4000) {
  if (!content) return '';
  const q = (question || '').split(/\s+/).filter(Boolean).slice(0, 6);
  const idx =
    q.map(k => String(content).toLowerCase().indexOf(k.toLowerCase()))
      .filter(i => i >= 0)
      .sort((a, b) => a - b)[0] ?? 0;

  const start = Math.max(0, idx - Math.floor(max / 2));
  return String(content).slice(start, start + max);
}

function rewriteQuery(question, history = [], pinned = []) {
  const prevQ = [...history].reverse().map(h => h?.text).find(Boolean) || '';
  const names = (pinned || []).map(d => d.fileName).filter(Boolean).slice(0, 3).join(' ');
  const joined = [question, prevQ, names].filter(Boolean).join(' ');
  return joined.length > 400 ? joined.slice(-400) : joined;
}

// ✅ Company extractor: "scm ХХК", "smc llc", "SMC"
function extractCompany(question = '') {
  const q = String(question || '').toLowerCase();

  // SCM/SMC гэх товчлол дангаараа орсон эсэх
  if (q.includes('smc')) return 'smc';
  if (q.includes('scm')) return 'scm';

  // "xxx ХХК" хэлбэр
  const m = q.match(/([a-zа-яё]+)\s*ххк/i);
  if (m && m[1]) return m[1].toLowerCase();

  // "xxx llc" хэлбэр
  const m2 = q.match(/([a-zа-яё]+)\s*llc/i);
  if (m2 && m2[1]) return m2[1].toLowerCase();

  return '';
}

function isProcessDocName(name = '') {
  const n = String(name || '').toLowerCase();
  return n.includes('процесс') || n.includes('process') || n.includes('п_гэрээ');
}

function contractQueryNarrow(question, company) {
  let q = String(question || '').toLowerCase();
  q = q
    .replace(/хийсэн|байгуулсан|чухал|заалт|ямар|юу|өг/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (company && !q.includes(company)) q = `${company} ${q}`;
  if (!q.includes('гэрээ') && (q.includes('contract') || company)) q = `${q} гэрээ`;
  return q.slice(0, 140);
}

async function answerQuestion(question, { threadId = 'default', history = [] } = {}) {
  const sticky = THREAD_CTX.get(threadId) || { docs: [], lastQ: '' };

  const intent = detectIntent(question);
  const domain = intent.domain || 'general';
  const needSteps = !!intent.needSteps;
  const company = extractCompany(question);

  // ✅ CONTRACT CACHE (0 Graph / 0 OCR on repeats)
  if (domain === 'contract') {
    const key = makeContractCacheKey(question, { domain, company });
    const cached = contractCache.get(key);
    if (cached) {
      return { ...cached, domain, needSteps: false, folders: ['CONTRACT-AI'], ocrUsed: false };
    }
  }

  // ✅ Prefer AI Search (0 Graph burst) — use narrowed query for contract
  const qForSearch = domain === 'contract' ? contractQueryNarrow(question, company) : question;
  let aiSnippets = await retrievePassages(qForSearch, 10); // INDEX_NAME env [1](https://teams.microsoft.com/l/meeting/details?eventId=AAMkADhhMDZmOWU3LTg3NTAtNDU0Yi04YWJiLWJjODQzYmFhNzU3OQFRAAgI3mHuAjAAAEYAAAAAvq_S3HMDy02p86tJmhG3lAcA5DT40VE1k0Ck9Q8rrVakbwAAAAABDQAA5DT40VE1k0Ck9Q8rrVakbwAE6f2d7QAAEA%3d%3d)
  let aiDocs = (aiSnippets || []).map(d => ({
    id: d.id,
    driveId: d.driveId,
    fileName: d.fileName || d.title || 'Source',
    url: d.webUrl || d.url,
    content: d.content || ''
  }));

  // ✅ CONTRACT guard: never use process docs as contract evidence
  if (domain === 'contract') {
    aiDocs = aiDocs.filter(d => !isProcessDocName(d.fileName));
    if (company) {
      const filtered = aiDocs.filter(d => String(d.fileName || '').toLowerCase().includes(company));
      if (filtered.length) aiDocs = filtered;
    }
  }

  // Rank AI docs
  const aiRanked = aiDocs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content) }))
    .filter(d => (d.content || '').length > 80)
    .sort((a, b) => b._score - a._score);

  // ✅ If AI Search has enough info: answer with 0 Graph / 0 OCR
  if (aiRanked.length > 0) {
    const topDocs = aiRanked.slice(0, 5);
    const focusedMap = {};
    for (const d of topDocs) focusedMap[d.fileName] = focusSnippet(question, d.content, 4000);

    const ans = await askAI(question, topDocs, { needSteps, domain, company });

    const payload = { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed: false, folders: resolveFolders(domain) };

    // cache contract result
    if (domain === 'contract') {
      const key = makeContractCacheKey(question, { domain, company });
      contractCache.set(key, payload);
    }

    THREAD_CTX.set(threadId, { docs: topDocs, lastQ: question });
    return { ...payload, domain, needSteps, folders: payload.folders };
  }

  // ✅ Fallback: SharePoint search (Graph) — keep minimal; OCR OFF for contract
  const token = await getGraphToken();
  const folders = resolveFolders(domain);

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

  // ✅ CONTRACT: drop process docs even in fallback
  if (domain === 'contract') {
    docs = docs.filter(d => !isProcessDocName(d.fileName));
    if (company) {
      const filtered = docs.filter(d => String(d.fileName || '').toLowerCase().includes(company));
      if (filtered.length) docs = filtered;
    }
  }

  const ranked = docs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content || '') }))
    .sort((a, b) => b._score - a._score);

  let topDocs = ranked.slice(0, 5);
  if (topDocs.length === 0 && sticky.docs.length) topDocs = sticky.docs;
  if (topDocs.length === 0) topDocs = aiDocs.slice(0, 5);

  const focusedMap = {};
  for (const d of topDocs) focusedMap[d.fileName] = focusSnippet(question, d.content || '', 4000);

  const ans = await askAI(question, topDocs, { needSteps, domain, company });

  const result = { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed, domain, needSteps, folders };

  if (domain === 'contract') {
    const key = makeContractCacheKey(question, { domain, company });
    contractCache.set(key, { ans, docs: topDocs, extractedTextMap: focusedMap, ocrUsed: false, folders });
  }

  THREAD_CTX.set(threadId, { docs: topDocs, lastQ: question });
  return result;
}

module.exports = { answerQuestion };
