// scripts/ingestSharePointToSearch.js
// Usage:
//   node scripts/ingestSharePointToSearch.js --folders PROCESS-AI,HSE-AI --ext pdf,docx --max 50

const axios = require('axios');
const { getGraphToken }    = require('../graph/token');            // app-only token [3](https://zagengineering.sharepoint.com/sites/ZAG-AI/Shared%20Documents/ZAG-AI/PROCESS-AI/%d0%a5%d1%83%d1%83%d0%bb%d1%8c%20%d0%b3%d1%8d%d1%80%d1%8d%d1%8d?web=1)
const { getDriveId }       = require('../graph/sharepointSearch');  // site drive id cache [4](https://zagengineering-my.sharepoint.com/personal/khangai_e_zag_mn/Documents/Microsoft%20Copilot%20Chat%20Files/bot.js)
const { extractTextWithOCR } = require('../ocr/azureRead');         // DI OCR [1](https://zagengineering-my.sharepoint.com/personal/khangai_e_zag_mn/Documents/Microsoft%20Copilot%20Chat%20Files/main_zag-teams-bot-api.yml)
const path = require('path');

const SEARCH_ENDPOINT = process.env.SEARCH_ENDPOINT;
const SEARCH_KEY      = process.env.SEARCH_KEY;
const INDEX_NAME      = process.env.INDEX_NAME || 'process-docs';   // [2](https://zagengineering.sharepoint.com/sites/ZAG-AI472-HSE-AI/Shared%20Documents/HSE-AI?web=1)

function parseArg(name, def='') {
  const m = process.argv.find(a => a.startsWith(`--${name}=`));
  return m ? m.split('=').slice(1).join('=').trim() : def;
}
const foldersCSV = parseArg('folders', process.env.SP_PROCESS_FOLDER || 'PROCESS-AI'); // [2](https://zagengineering.sharepoint.com/sites/ZAG-AI472-HSE-AI/Shared%20Documents/HSE-AI?web=1)
const allowExts  = parseArg('ext', process.env.SP_FILE_TYPES || 'pdf,docx,xlsx').toLowerCase().split(',').map(s => s.trim()).filter(Boolean); // [2](https://zagengineering.sharepoint.com/sites/ZAG-AI472-HSE-AI/Shared%20Documents/HSE-AI?web=1)
const maxFiles   = parseArg('max', '50')|0 || 50;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function hasAllowedExt(name) {
  const ext = (name.split('.').pop()||'').toLowerCase();
  return allowExts.length === 0 || allowExts.includes(ext);
}
function chunkText(text, chunkSize=1800, overlap=200) {
  const out = [];
  const clean = (text||'').replace(/\r/g,' ');
  for (let i=0; i<clean.length; i += (chunkSize - overlap)) {
    out.push(clean.slice(i, i+chunkSize));
    if (out.length >= 30) break; // хамгаалах
  }
  return out;
}

async function listFilesInFolder(driveId, folderPath, token) {
  // /drives/{driveId}/root:/sites/ZAG-AI/PROCESS-AI:/children
  const enc = encodeURI(folderPath.replace(/^\/+/, ''));
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${enc}:/children?$select=id,name,webUrl,parentReference,file,folder,size,lastModifiedDateTime`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }});
  // зөвхөн файлууд
  return (res.data.value||[]).filter(i => !!i.file && i.name).filter(i => hasAllowedExt(i.name));
}

async function downloadFile(driveId, itemId, token) {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`;
  const res = await axios.get(url, { responseType: 'arraybuffer', headers: { Authorization: `Bearer ${token}` }});
  return Buffer.from(res.data);
}

async function upsertDocs(docs) {
  if (!docs.length) return;
  const url = `${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/index?api-version=2024-07-01`;
  const payload = { value: docs.map(d => ({ "@search.action": "mergeOrUpload", ...d })) };
  await axios.post(url, payload, {
    headers: { 'api-key': SEARCH_KEY, 'Content-Type': 'application/json' }
  });
}

(async () => {
  const token   = await getGraphToken();                 // app-only ok for ingestion [3](https://zagengineering.sharepoint.com/sites/ZAG-AI/Shared%20Documents/ZAG-AI/PROCESS-AI/%d0%a5%d1%83%d1%83%d0%bb%d1%8c%20%d0%b3%d1%8d%d1%80%d1%8d%d1%8d?web=1)
  const driveId = await getDriveId(token);               // "Documents"/"Shared Documents" drive id  [4](https://zagengineering-my.sharepoint.com/personal/khangai_e_zag_mn/Documents/Microsoft%20Copilot%20Chat%20Files/bot.js)

  const folders = foldersCSV.split(',').map(s => s.trim()).filter(Boolean);
  let total = 0;

  for (const folder of folders) {
    console.log(`[INGEST] Listing ${folder} ...`);
    const items = await listFilesInFolder(driveId, `/sites/ZAG-AI/${folder}`, token); // сайтын замыг ENV-ээс өөрчилж болно
    const take = items.slice(0, Math.max(1, Math.min(maxFiles, items.length)));

    for (const it of take) {
      try {
        const fileName = it.name;
        console.log(`[INGEST] ${fileName}`);
        const buf = await downloadFile(driveId, it.id, token);

        let fullText = '';
        const ext = (fileName.split('.').pop()||'').toLowerCase();
        if (ext === 'pdf') {
          fullText = await extractTextWithOCR(buf);      // DI OCR [1](https://zagengineering-my.sharepoint.com/personal/khangai_e_zag_mn/Documents/Microsoft%20Copilot%20Chat%20Files/main_zag-teams-bot-api.yml)
          // бага зэргийн амьсгаа
          await sleep(200);
        } else {
          // PDF бус файлуудад энд өөрийн парсер нэмж болно
          fullText = ''; // одоохондоо хоосон үлдээнэ (дараа нь хэрэгжүүлж болно)
        }

        const chunks = chunkText(fullText);
        const docs = (chunks.length? chunks : ['']).map((ch, idx) => ({
          id: `${it.id}-${idx}`,
          fileName,
          url: it.webUrl,
          siteId: process.env.SP_SITE_ID || '',
          driveId,
          path: it.parentReference?.path || '',
          content: fullText.slice(0, 4000),   // ерөнхий контент
          chunk: ch,                          // RAG-д ашиглах хэсэг
          acl: []                             // дараа нь OBO/ACL шүүлтэд ашиглана
        }));

        await upsertDocs(docs);
        total += docs.length;
      } catch (e) {
        console.error(`[INGEST] Error on ${it?.name}:`, e.message);
      }
    }
  }

  console.log(`[INGEST] Done. Upserted chunks: ${total}`);
})().catch(e => {
  console.error('[INGEST] Fatal:', e);
  process.exit(1);
});
