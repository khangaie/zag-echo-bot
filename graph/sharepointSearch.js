// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";
const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

// UI дээр Documents > ZAG-AI > PROCESS-AI харагдаж байгаа тул энэ бол "library root" folder нэр
const SP_LIBRARY_ROOT_FOLDER = process.env.SP_LIBRARY_ROOT_FOLDER || "ZAG-AI";

// Folder env-үүд (нэр хэлбэрээр)
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

const LIMIT = Number(process.env.SP_SEARCH_LIMIT || 10);

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
    if (!seen.has(t)) {
      uniq.push(t);
      seen.add(t);
    }
    if (uniq.length >= 6) break;
  }
  return uniq.length ? uniq.join(" ") : raw.trim().slice(0, 50);
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

async function rootHasFolder(driveId, folderName, accessToken) {
  try {
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/children?$top=200`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const items = res.data?.value || [];
    return items.some(i => i?.folder && i?.name === folderName);
  } catch {
    return false;
  }
}

async function listFolderByPath(driveId, path, accessToken) {
  const enc = encodePath(path);
  if (!enc) return { ok: false, status: 0, items: [] };

  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${enc}:/children?$top=${LIMIT}`;
  try {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const items = (res.data?.value || [])
      .filter(i => i?.name && i?.webUrl)
      .filter(i => hasAllowedExt(i.name))
      .slice(0, LIMIT)
      .map(i => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl,
        driveId,
        lastModifiedDateTime: i.lastModifiedDateTime,
      }));
    return { ok: true, status: 200, items };
  } catch (err) {
    const status = err?.response?.status || 0;
    const msg = err?.response?.data?.error?.message || err.message;
    return { ok: false, status, msg, items: [] };
  }
}

async function listFolderFiles(folderName, accessToken) {
  const driveId = await getDriveId(accessToken);

  // 1) root:/PROCESS-AI гэж оролдоно
  let r = await listFolderByPath(driveId, folderName, accessToken);
  if (r.ok) return r.items;

  // 2) 404 бол root дээр ZAG-AI байгаа эсэхийг шалгаад prefix нэмнэ
  const hasZagRoot = await rootHasFolder(driveId, SP_LIBRARY_ROOT_FOLDER, accessToken);
  if (hasZagRoot) {
    r = await listFolderByPath(driveId, `${SP_LIBRARY_ROOT_FOLDER}/${folderName}`, accessToken);
    if (r.ok) return r.items;
  }

  console.warn(`[SP] listFolderFiles failed (${r.status}) for "${folderName}": ${r.msg || "unknown"}`);
  return [];
}

function folderAliasToName(folder) {
  // Router-оос ирэх нэрүүдийг энд canonical нэртэй тааруулна
  const f = String(folder || "").toUpperCase();
  if (f === "PROCESS-AI") return SP_PROCESS_FOLDER;
  if (f === "HR-AI") return SP_HR_FOLDER;
  if (f === "HSE-AI") return SP_HSE_FOLDER;
  if (f === "PROJECT-AI") return SP_PROJECT_FOLDER;
  if (f === "CONTRACT-AI") return SP_CONTRACT_FOLDER;
  return folder;
}

/**
 * Folder-aware SharePoint search (filename scoring).
 * @param {string} query
 * @param {string} accessToken
 * @param {string[]} folders - e.g. ['PROCESS-AI','HR-AI']
 */
async function searchSharePoint(query, accessToken, folders = []) {
  const q = normalizeQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean);

  const wanted = Array.isArray(folders) && folders.length
    ? folders.map(folderAliasToName)
    : [SP_PROCESS_FOLDER, SP_HR_FOLDER, SP_HSE_FOLDER, SP_PROJECT_FOLDER, SP_CONTRACT_FOLDER];

  // ✅ Зөвхөн route болсон фолдерууд дээр листлэнэ
  const pools = [];
  for (const fn of wanted) {
    const items = await listFolderFiles(fn, accessToken);
    pools.push(...items.map(x => ({ ...x, _folder: fn })));
  }

  if (!pools.length) return [];

  const scored = pools.map(f => {
    const name = (f.name || "").toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (t.length < 2) continue;
      if (name.includes(t)) score += 2;
    }
    // folder name жижиг бонус
    if ((f._folder || "").toLowerCase().includes(tokens[0] || "")) score += 1;
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
