// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";
const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";
const LIMIT = Number(process.env.SP_SEARCH_LIMIT || 10);

const SP_LIBRARY_ROOT_FOLDER = process.env.SP_LIBRARY_ROOT_FOLDER || "ZAG-AI";
const SP_PROCESS_FOLDER = process.env.SP_PROCESS_FOLDER || "PROCESS-AI";
const SP_HR_FOLDER = process.env.SP_HR_FOLDER || "HR-AI";
const SP_HSE_FOLDER = process.env.SP_HSE_FOLDER || "HSE-AI";
const SP_PROJECT_FOLDER = process.env.SP_PROJECT_FOLDER || "PROJECT-AI";
const SP_CONTRACT_FOLDER = process.env.SP_CONTRACT_FOLDER || "CONTRACT-AI";

const ALLOWED_EXTS = (process.env.SP_FILE_TYPES || "")
  .toLowerCase()
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

let _siteId;
let _driveId;
const folderIdCache = new Map(); // `${driveId}::${path}` -> id|null

function hasAllowedExt(name) {
  if (ALLOWED_EXTS.length === 0) return true;
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ALLOWED_EXTS.includes(ext);
}
function encodePath(path) {
  const clean = String(path || "").replace(/^\/+|\/+$/g, "");
  if (!clean) return "";
  return clean.split("/").map(encodeURIComponent).join("/");
}
function normalizeQuery(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

async function withRetry(fn, retries = 3) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const status = e?.response?.status;
      const ra = Number(e?.response?.headers?.['retry-after'] || 0);
      if (status === 429 && attempt < retries) {
        const wait = ra > 0 ? ra * 1000 : 800 * Math.pow(2, attempt);
        console.warn(`[SP] 429 throttled. retrying in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        attempt++;
        continue;
      }
      throw e;
    }
  }
}

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
  if (SP_SITE_ID) return (_siteId = SP_SITE_ID);
  const url = `https://graph.microsoft.com/v1.0/sites/${SP_HOST}:${SP_SITE_PATH}`;
  const res = await withRetry(() => axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
  _siteId = res.data?.id;
  if (!_siteId) throw new Error("Site id not found.");
  return _siteId;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;
  if (SP_DRIVE_ID) return (_driveId = SP_DRIVE_ID);

  const siteId = await getSiteId(accessToken);
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  const res = await withRetry(() => axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
  const drives = Array.isArray(res.data?.value) ? res.data.value : [];
  const best =
    drives.find(d => d?.name === "Documents" || d?.name === "Shared Documents") ||
    drives.find(d => (d?.driveType || "").toLowerCase() === "documentlibrary") ||
    drives[0];
  if (!best?.id) throw new Error("Drive not found.");
  _driveId = best.id;
  console.log(`[SP] Using drive: ${best.name} (${best.id})`);
  return _driveId;
}

async function getFolderIdByPath(driveId, folderPath, accessToken) {
  const key = `${driveId}::${folderPath}`;
  if (folderIdCache.has(key)) return folderIdCache.get(key);

  const enc = encodePath(folderPath);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${enc}`;
  try {
    const res = await withRetry(() => axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
    const item = res.data;
    const id = item?.folder && item?.id ? item.id : null;
    folderIdCache.set(key, id);
    return id;
  } catch {
    folderIdCache.set(key, null);
    return null;
  }
}

async function searchByFolderId(driveId, folderId, q, accessToken) {
  if (!folderId) return [];
  const query = String(q || '').trim();
  if (!query) return [];

  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/search(q='${encodeURIComponent(query)}')?$top=${LIMIT}`;
  try {
    const res = await withRetry(() => axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } }));
    const items = Array.isArray(res.data?.value) ? res.data.value : [];
    return items
      .filter(i => i?.name && i?.webUrl)
      .filter(i => !i.folder)
      .filter(i => hasAllowedExt(i.name))
      .slice(0, LIMIT)
      .map(i => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl,
        driveId,
        lastModifiedDateTime: i.lastModifiedDateTime
      }));
  } catch (e) {
    const status = e?.response?.status || 0;
    const msg = e?.response?.data?.error?.message || e.message;
    console.warn(`[SP] searchByFolderId failed (${status}): ${msg}`);
    return [];
  }
}

function aliasToFolderName(folder) {
  const f = String(folder || '').toUpperCase();
  if (f === 'PROCESS-AI') return SP_PROCESS_FOLDER;
  if (f === 'HR-AI') return SP_HR_FOLDER;
  if (f === 'HSE-AI') return SP_HSE_FOLDER;
  if (f === 'PROJECT-AI') return SP_PROJECT_FOLDER;
  if (f === 'CONTRACT-AI') return SP_CONTRACT_FOLDER;
  return folder;
}

async function searchSharePoint(query, accessToken, folders = []) {
  const driveId = await getDriveId(accessToken);
  const q = normalizeQuery(query);

  const wanted = (Array.isArray(folders) && folders.length)
    ? folders.map(aliasToFolderName)
    : [SP_PROCESS_FOLDER, SP_HR_FOLDER, SP_HSE_FOLDER, SP_PROJECT_FOLDER, SP_CONTRACT_FOLDER];

  // ✅ burst guard: хамгийн ихдээ 2 folder хайна
  const pick = wanted.slice(0, 2);

  const paths = (name) => [name, `${SP_LIBRARY_ROOT_FOLDER}/${name}`];

  for (const folderName of pick) {
    for (const p of paths(folderName)) {
      const folderId = await getFolderIdByPath(driveId, p, accessToken);
      if (!folderId) continue;
      const hits = await searchByFolderId(driveId, folderId, q, accessToken);
      if (hits.length) return hits;
    }
  }
  return [];
}

async function searchSharePointBroad() { return []; }

module.exports = { searchSharePoint, searchSharePointBroad, getSiteId, getDriveId };
