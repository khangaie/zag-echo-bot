// scripts/ingestSharePointToSearch.js
// Usage:
//   node scripts/ingestSharePointToSearch.js --folders=PROCESS-AI,HSE-AI --ext=pdf,docx --max=50

const axios = require('axios');
const { getGraphToken } = require('../graph/token');            // app-only token
const { getDriveId }    = require('../graph/sharepointSearch'); // drive id
const { extractTextWithOCR } = require('../ocr/azureRead');     // OCR for PDF
const path = require('path');

const {
  SEARCH_ENDPOINT,
  SEARCH_KEY,
  INDEX_NAME = 'process-docs',
  SP_PROCESS_FOLDER,
  SP_FILE_TYPES,
  SP_SITE_ID
} = process.env;

// --name=value И БОЛОН --name value хэлбэр хоёрыг дэмжинэ
function parseArg(name, def = '') {
  const i = process.argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const cur = process.argv[i];
  if (cur.includes('=')) return cur.split('=').slice(1).join('=').trim();
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next.trim() : def;
}

const foldersCSV = parseArg('folders', SP_PROCESS_FOLDER || 'PROCESS-AI');
const allowExts = parseArg('ext', (SP_FILE_TYPES || 'pdf,docx,xlsx'))
  .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
const maxFiles = parseInt(parseArg('max', '50'), 10) || 50;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function hasAllowedExt(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return allowExts.length === 0 || allowExts.includes(ext);
}
function chunkText(text, chunkSize = 1800, overlap = 200) {
  const out = [];
  const clean = String(text || '').replace(/\r/g, ' ');
  for (let i = 0; i < clean.length; i += (chunkSize - overlap)) {
    out.push(clean.slice(i, i + chunkSize));
    if (out.length >= 30) break; // хамгаалалт
  }
  return out;
}

function listChildrenUrl(driveId, folderPath) {
  const enc = encodeURI(folderPath.replace(/^\/+/, '')); // "sites/ZAG-AI/PROCESS-AI"
  return `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${enc}:/children`;
}
function downloadContentUrl(driveId, itemId) {
  return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
}

async function listFilesInFolder(driveId, folderPath, token) {
  const url = listChildrenUrl(driveId, folderPath);
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  return (res.data.value || [])
    .filter(i => !!i.file && i.name)
    .filter(i => hasAllowedExt(i.name));
}

async function downloadFile(driveId, itemId, token) {
  const url = downloadContentUrl(driveId, itemId);
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { Authorization: `Bearer ${token}` }
  });
  return Buffer.from(res.data);
}

async function upsertDocs(docs) {
  if (!docs.length) return;
  if (!SEARCH_ENDPOINT || !SEARCH_KEY) {
    throw new Error('SEARCH_ENDPOINT and SEARCH_KEY env vars are required');
  }
  const url = `${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/index?api-version=2024-07-01`;
  const payload = { value: docs.map(d => ({ '@search.action': 'mergeOrUpload', ...d })) };
  await axios.post(url, payload, {
    headers: { 'api-key': SEARCH_KEY, 'Content-Type': 'application/json' }
  });
}

(async () => {
  const token = await getGraphToken();     // app-only token
  const driveId = await getDriveId(token); // drive id for the site library

  const folders = foldersCSV.split(',').map(s => s.trim()).filter(Boolean);
  let total = 0;

  for (const folder of folders) {
    console.log(`[INGEST] Listing ${folder} ...`);
    const spPath = `/sites/ZAG-AI/${folder}`; // Хэрэв өөр site нэртэй бол ENV-ээс уншуулж өөрчилж болно
    const items = await listFilesInFolder(driveId, spPath, token);
    const take = items.slice(0, Math.max(1, Math.min(maxFiles, items.length)));

    for (const it of take) {
      try {
        const fileName = it.name;
        console.log(`[INGEST] ${fileName}`);
        const buf = await downloadFile(driveId, it.id, token);

        let fullText = '';
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (ext === 'pdf') {
          fullText = await extractTextWithOCR(buf);
          await sleep(200);
        } else {
          // TODO: docx/xlsx extractor нэмэх боломжтой
          fullText = '';
        }

        const chunks = chunkText(fullText);
        const docs = (chunks.length ? chunks : ['']).map((ch, idx) => ({
          id: `${it.id}-${idx}`,
          fileName,
          url: it.webUrl,
          siteId: SP_SITE_ID || '',
          driveId,
          path: (it.parentReference && it.parentReference.path) || '',
          content: String(fullText).slice(0, 4000),
          chunk: ch,
          acl: []
        }));

        await upsertDocs(docs);
        total += docs.length;
      } catch (e) {
        console.error(`[INGEST] Error on ${it && it.name}:`, e.message);
      }
    }
  }

  console.log(`[INGEST] Done. Upserted chunks: ${total}`);
})().catch(e => {
  console.error('[INGEST] Fatal:', e);
  process.exit(1);
});
