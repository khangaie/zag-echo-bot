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
    if (!seen.has(t)) { uniq.push(t); seen.add(t); }
    if (uniq.length >= 6) break;
  }
  return uniq.length ? uniq.join(" ") : raw.trim().slice(0, 50);
}

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
  if (SP_SITE_ID) return (_siteId = SP_SITE_ID);

  const url = `https://graph.microsoft.com/v1.0/sites/${SP_HOST}:${SP_SITE_PATH}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
  // 1) name нь Documents / Shared Documents
  let d = drives.find(x => x?.name === "Documents" || x?.name === "Shared Documents");
  if (d?.id) return d;

  // 2) webUrl дээр Shared Documents / Documents гэсэн мөр байвал (локализациас үл хамаарна)
  d = drives.find(x => (x?.webUrl || "").toLowerCase().includes("shared%20documents") ||
                       (x?.webUrl || "").toLowerCase().includes("/documents"));
  if (d?.id) return d;

  // 3) хамгийн эхний documentLibrary
  d = drives.find(x => (x?.driveType || "").toLowerCase() === "documentlibrary");
  if (d?.id) return d;

  // 4) fallback
  return drives[0] || null;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;

  // ENV-д driveId байгаа бол эхлээд шалгая
  const envDrive = await tryGetDriveById(SP_DRIVE_ID, accessToken);
  if (envDrive?.id) {
    _driveId = envDrive.id;
    return _driveId;
  }

  // Үгүй бол site->drives-оос зөвхийг сонгоно
  const drives = await listSiteDrives(accessToken);
  const best = pickBestDrive(drives);
  if (!best?.id) throw new Error("Drive not found under site.");
  _driveId = best.id;
  console.log(`[SP] Using drive: ${best.name} (${best.id})`);
  return _driveId;
}

// root children-ээс folder байгаа эсэхийг шалгах (404 үед оношлоход маш хэрэгтэй)
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
  console.log(`[SP] LIST ${url}`);

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
        lastModifiedDateTime: i.lastModifiedDateTime
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

  // 1) эхлээд шууд root:/PROCESS-AI
  let r = await listFolderByPath(driveId, folderName, accessToken);
  if (r.ok) return r.items;

  // 2) 404 бол root дээр ZAG-AI байгаа эсэхийг шалгаад тэгээд prefix нэмнэ
  const hasZagRoot = await rootHasFolder(driveId, SP_LIBRARY_ROOT_FOLDER, accessToken);
  if (hasZagRoot) {
    r = await listFolderByPath(driveId, `${SP_LIBRARY_ROOT_FOLDER}/${folderName}`, accessToken);
    if (r.ok) return r.items;
  }

  console.warn(`[SP] listFolderFiles failed (${r.status}) for "${folderName}" : ${r.msg || "unknown"}`);
  return [];
}

async function searchSharePoint(query, accessToken) {
  const q = normalizeQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean);

  const pool = [
    ...(await listFolderFiles(SP_PROCESS_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HR_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HSE_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_PROJECT_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_CONTRACT_FOLDER, accessToken)),
  ];

  if (!pool.length) return [];

  const scored = pool.map(f => {
    const name = (f.name || "").toLowerCase();
    let score = 0;
    for (const t of tokens) {
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
