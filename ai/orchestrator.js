// ai/orchestrator.js (MINI-SAFE version for 2-step reply)
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint, searchSharePointBroad } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');
const { processFiles } = require('../graph/fileProcessor');
const { detectIntent } = require('./intentDetector');
const { resolveFolders } = require('./folderRouter');
const { contractCache, makeContractCacheKey } = require('./contractCache');

const THREAD_CTX = new Map();
const uniqBy = (arr, keyFn) =>
  Array.from(new Map((arr || []).map(x => [keyFn(x), x])).values());

function scoreDoc(question, content = '') {
  if (!content) return 0;
  const qTokens = String(question)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  const text = String(content).toLowerCase();
  return qTokens.reduce((sum, t) => sum + (text.includes(t) ? 1 : 0), 0);
}

function focusSnippet(question, content, max = 3000) {
  if (!content) return '';
  const idx = content.toLowerCase().indexOf(
    question.split(/\s+/)[0]?.toLowerCase()
  );
  const start = Math.max(0, (idx >= 0 ? idx : 0) - 500);
  return content.slice(start, start + max);
}

// ✅ MAIN
async function answerQuestion(
  question,
  { threadId = 'default', history = [], signal } = {}
) {
  if (signal?.aborted) throw new Error('Aborted');

  const sticky = THREAD_CTX.get(threadId) || { docs: [], lastQ: '' };
  const intent = detectIntent(question);
  const domain = intent.domain || 'general';
  const needSteps = !!intent.needSteps;

  // ✅ CONTRACT caching (маш хурдан)
  if (domain === 'contract') {
    const key = makeContractCacheKey(question, { domain });
    const cached = contractCache.get(key);
    if (cached) {
      return { ...cached, domain, needSteps: false, ocrUsed: false };
    }
  }

  // ✅ 1️⃣ FAST PATH — Azure AI Search (OCR, Graph БИШ)
  const aiSnippets = await retrievePassages(question, 8, { signal }).catch(() => []);
  let aiDocs = (aiSnippets || []).map(d => ({
    id: d.id,
    driveId: d.driveId,
    fileName: d.fileName || d.title || 'Source',
    url: d.webUrl || d.url,
    content: d.content || ''
  }));

  aiDocs = aiDocs
    .map(d => ({ ...d, _score: scoreDoc(question, d.content) }))
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 4);

  if (aiDocs.length) {
    const focusedMap = {};
    for (const d of aiDocs) {
      focusedMap[d.fileName] = focusSnippet(question, d.content);
    }

    const ans = await askAI(question, aiDocs, { needSteps, domain, signal });
    const payload = {
      ans,
      docs: aiDocs,
      extractedTextMap: focusedMap,
      ocrUsed: false,
      folders: resolveFolders(domain)
    };

    if (domain === 'contract') {
      contractCache.set(
        makeContractCacheKey(question, { domain }),
        payload
      );
    }

    THREAD_CTX.set(threadId, { docs: aiDocs, lastQ: question });
    return { ...payload, domain, needSteps };
  }

  // ✅ 2️⃣ SLOW PATH — SharePoint (зөвхөн шаардлагатай үед)
  if (signal?.aborted) throw new Error('Aborted');

  const token = await getGraphToken();
  const folders = resolveFolders(domain);

  let spFiles =
    (await searchSharePoint(question, token, folders).catch(() => [])) ||
    [];

  if (!spFiles.length) {
    spFiles = await searchSharePointBroad(question, token).catch(() => []);
  }

  const toProcess = spFiles.slice(0, 3).map(f => ({
    id: f.id,
    driveId: f.driveId,
    name: f.name,
    webUrl: f.webUrl
  }));

  let extractedTextMap = {};
  let ocrUsed = false;

  if (domain !== 'contract' && toProcess.length) {
    const r = await processFiles(toProcess, token, { signal }).catch(() => ({}));
    extractedTextMap = r.extractedTextMap || {};
    ocrUsed = !!r.ocrUsed;
  }

  const docs = uniqBy(
    toProcess.map(f => ({
      fileName: f.name,
      url: f.webUrl,
      content: extractedTextMap[f.name] || ''
    })),
    d => d.url
  );

  const focusedMap = {};
  for (const d of docs) {
    focusedMap[d.fileName] = focusSnippet(question, d.content);
  }

  const ans = await askAI(question, docs, { needSteps, domain, signal });

  const result = {
    ans,
    docs,
    extractedTextMap: focusedMap,
    ocrUsed,
    domain,
    needSteps,
    folders
  };

  THREAD_CTX.set(threadId, { docs, lastQ: question });
  return result;
}

module.exports = { answerQuestion };
