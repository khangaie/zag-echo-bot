// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";
const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

// UI: Documents > ZAG-AI > PROCESS-AI
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

const LIMIT = Number(process.env.SP_SEARCH_LIMIT || 25);

let _siteId;
let _driveId;

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
  const raw = String(q || "");
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  const uniq = [];
  const seen = new Set();
  for (const t of tokens) {
    if (!seen.has(t)) { uniq.push(t); seen.add(t); }
    if (uniq.length >= 6) break;
  }
  return uniq.length ? uniq.join(" ") : raw.trim().slice(0, 80);
}

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
  if (SP_SITE_ID) return (_siteId = SP_SITE_ID);

  const url = `https://graph.microsoft.com/v1.0/sites/${SP_HOST}:${SP_SITE_PATH}`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  _siteId = res.data?.id;
  if (!_siteId) throw new Error("Site id not found in Graph response.");
  return _siteId;
}

async function tryGetDriveById(driveId, accessToken) {
  if (!driveId) return null;
  try {
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}?$select=id,name,webUrl,driveType`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.data || null;
  } catch {
    return null;
  }
}

async function listSiteDrives(accessToken) {
  const siteId = await getSiteId(accessToken);
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  return Array.isArray(res.data?.value) ? res.data.value : [];
}

function pickBestDrive(drives = []) {
  let d = drives.find(x => x?.name === "Documents" || x?.name === "Shared Documents");
  if (d?.id) return d;

  d = drives.find(x =>
    (x?.webUrl || "").toLowerCase().includes("shared%20documents") ||
    (x?.webUrl || "").toLowerCase().includes("/documents")
  );
  if (d?.id) return d;

  d = drives.find(x => (x?.driveType || "").toLowerCase() === "documentlibrary");
  if (d?.id) return d;

  return drives[0] || null;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;

  const envDrive = await tryGetDriveById(SP_DRIVE_ID, accessToken);
  if (envDrive?.id) {
    _driveId = envDrive.id;
    return _driveId;
  }

  const drives = await listSiteDrives(accessToken);
  const best = pickBestDrive(drives);
  if (!best?.id) throw new Error("Drive not found under site.");
  _driveId = best.id;
  console.log(`[SP] Using drive: ${best.name} (${best.id})`);
  return _driveId;
}

function folderAliasToName(folder) {
  const f = String(folder || "").toUpperCase();
  if (f === "PROCESS-AI") return SP_PROCESS_FOLDER;
  if (f === "HR-AI") return SP_HR_FOLDER;
  if (f === "HSE-AI") return SP_HSE_FOLDER;
  if (f === "PROJECT-AI") return SP_PROJECT_FOLDER;
  if (f === "CONTRACT-AI") return SP_CONTRACT_FOLDER;
  return folder;
}

/**
 * ✅ path -> folder itemId авах
 */
async function getFolderIdByPath(driveId, folderPath, accessToken) {
  const enc = encodePath(folderPath);
  if (!enc) return null;

  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${enc}`;
  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const item = res.data;
    if (item?.folder && item?.id) return item.id;
    return null;
  } catch {
    return null;
  }
}

/**
 * ✅ Зөв endpoint: /items/{folderId}/search(q='...')
 */
async function searchByFolderId(driveId, folderId, q, accessToken) {
  if (!folderId) return [];
  const query = String(q || "").trim();
  if (!query) return [];

  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/search(q='${encodeURIComponent(query)}')?$top=${LIMIT}`;
  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const items = Array.isArray(res.data?.value) ? res.data.value : [];
    return items
      .filter(i => i?.name && i?.webUrl)
      .filter(i => !i.folder)
      .filter(i => hasAllowedExt(i.name))
      .map(i => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl,
        driveId,
        lastModifiedDateTime: i.lastModifiedDateTime
      }));
  } catch (err) {
    const status = err?.response?.status || 0;
    const msg = err?.response?.data?.error?.message || err.message;
    console.warn(`[SP] searchByFolderId failed (${status}): ${msg}`);
    return [];
  }
}

async function searchSharePoint(query, accessToken, folders = []) {
  const driveId = await getDriveId(accessToken);
  const q = normalizeQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 3);

  const wanted = (Array.isArray(folders) && folders.length)
    ? folders.map(folderAliasToName)
    : [SP_PROCESS_FOLDER, SP_HR_FOLDER, SP_HSE_FOLDER, SP_PROJECT_FOLDER, SP_CONTRACT_FOLDER];

  // ✅ 2 төрлийн боломжит path-г АЛБАГҮЙ шалгана (root дээр олон item байвал top=200-д багтахгүй гэдэг асуудлыг арилгана)
  const candidatePaths = (folderName) => [
    `${folderName}`,
    `${SP_LIBRARY_ROOT_FOLDER}/${folderName}`
  ];

  const collected = [];

  // 1) Full query
  for (const folderName of wanted) {
    for (const p of candidatePaths(folderName)) {
      const folderId = await getFolderIdByPath(driveId, p, accessToken);
      if (!folderId) continue;
      const hits = await searchByFolderId(driveId, folderId, q, accessToken);
      if (hits.length) collected.push(...hits.map(h => ({ ...h, _folder: folderName })));
    }
  }

  // 2) Fallback token search
  if (collected.length === 0) {
    for (const folderName of wanted) {
      for (const p of candidatePaths(folderName)) {
        const folderId = await getFolderIdByPath(driveId, p, accessToken);
        if (!folderId) continue;
        for (const t of tokens) {
          const hits = await searchByFolderId(driveId, folderId, t, accessToken);
          if (hits.length) collected.push(...hits.map(h => ({ ...h, _folder: folderName })));
        }
      }
    }
  }

  if (collected.length === 0) return [];

  // dedupe by id
  const map = new Map();
  for (const f of collected) if (!map.has(f.id)) map.set(f.id, f);
  const pool = Array.from(map.values());

  // score
  const scored = pool.map(f => {
    const name = String(f.name || "").toLowerCase();
    let score = 0;
    for (const t of q.split(/\s+/)) {
      if (t.length < 2) continue;
      if (name.includes(t)) score += 2;
    }
    return { ...f, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, LIMIT).map(({ _score, ...rest }) => rest);
}

async function searchSharePointBroad() {
  return [];
}

module.exports = {
  searchSharePoint,
  searchSharePointBroad,
  getSiteId,
  getDriveId,
};
