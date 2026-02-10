// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint, searchSharePointBroad } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');

const { detectIntent } = require('./intentDetector');
const { resolveFolders } = require('./folderRouter');

const THREAD_CTX = new Map(); // threadId -> { docs, lastQ }

const uniqBy = (arr, key) =>
  Array.from(new Map((arr || []).map(x => [key(x), x])).values());

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|\n[\]\\]/g, '\\$&');
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

async function answerQuestion(question, { threadId = 'default', history = [] } = {}) {
  const sticky = THREAD_CTX.get(threadId) || { docs: [], lastQ: '' };

  // ✅ intent
  const intent = detectIntent(question); // { domain, needSteps }
  const domain = intent.domain || 'general';
  const needSteps = !!intent.needSteps;

  // ✅ folder routing
  const folders = resolveFolders(domain);

  const token = await getGraphToken();

  // AI Search (optional)
  const aiSnippets = await retrievePassages(question, 6);
  const aiDocs = (aiSnippets || []).map(d => ({
    id: d.id,
    driveId: d.driveId,
    fileName: d.fileName || d.title || 'Source',
    url: d.webUrl || d.url,
    content: d.content || ''
  }));

  // ✅ SharePoint search зөвхөн route болсон фолдерууд
  let spFiles = await searchSharePoint(
    rewriteQuery(question, history, sticky.docs),
    token,
    folders
  );

  if (!spFiles || spFiles.length === 0) {
    spFiles = await searchSharePointBroad(
      rewriteQuery(question, history, sticky.docs),
      token
    );
  }

  const toProcess = (spFiles || []).map(f => ({
    id: f.id,
    driveId: f.driveId,
    name: f.name,
    webUrl: f.webUrl
  }));

  let extractedTextMap = {};
  let ocrUsed = false;

  if (toProcess.length > 0) {
    const r = await processFiles(toProcess, token);
    extractedTextMap = r.extractedTextMap || {};
    ocrUsed = !!r.ocrUsed;
  }

  const spDocs = (spFiles || []).map(f => ({
    id: f.id,
    driveId: f.driveId,
    fileName: f.name,
    url: f.webUrl,
    content: extractedTextMap[f.name] || ''
  }));

  let docs = uniqBy([...aiDocs, ...spDocs], d => d.url || d.fileName);

  const ranked = docs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content) }))
    .filter(d => (d.content || '').length > 100)
    .sort((a, b) => b._score - a._score);

  let topDocs = ranked.slice(0, 5);
  if (topDocs.length === 0 && sticky.docs.length) topDocs = sticky.docs;
  if (topDocs.length === 0) topDocs = aiDocs.slice(0, 5);

  const focusedMap = {};
  for (const d of topDocs) {
    focusedMap[d.fileName] = focusSnippet(question, d.content, 4000);
  }

  // ✅ askAI (Copilot structured)
  const ans = await askAI(question, topDocs, { needSteps, domain });

  THREAD_CTX.set(threadId, { docs: topDocs, lastQ: question });

  return {
    ans,
    domain,
    needSteps,
    folders,
    docs: topDocs,
    extractedTextMap: focusedMap,
    ocrUsed
  };
}

module.exports = { answerQuestion };
