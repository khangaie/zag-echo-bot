// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

// Танай Documents library дотор "ZAG-AI" гэж root folder байна (Documents > ZAG-AI > PROCESS-AI)
const SP_LIBRARY_ROOT_FOLDER = process.env.SP_LIBRARY_ROOT_FOLDER || "ZAG-AI";

// Folder env-үүд (ID эсвэл NAME/PATH байж болно)
const SP_PROCESS_FOLDER = process.env.SP_PROCESS_FOLDER || "";
const SP_HR_FOLDER = process.env.SP_HR_FOLDER || "";
const SP_HSE_FOLDER = process.env.SP_HSE_FOLDER || "";
const SP_PROJECT_FOLDER = process.env.SP_PROJECT_FOLDER || "";
const SP_CONTRACT_FOLDER = process.env.SP_CONTRACT_FOLDER || "";

const ALLOWED_EXTS = (process.env.SP_FILE_TYPES || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const LIMIT = Number(process.env.SP_SEARCH_LIMIT || 10);

let _siteId;
let _driveId;

function hasAllowedExt(name) {
  if (ALLOWED_EXTS.length === 0) return true;
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ALLOWED_EXTS.includes(ext);
}

function isGuidLike(s) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(s || ""));
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
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  _siteId = res.data?.id;
  if (!_siteId) throw new Error("Site id not found in Graph response.");
  return _siteId;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;
  if (SP_DRIVE_ID) return (_driveId = SP_DRIVE_ID);

  const siteId = await getSiteId(accessToken);
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const drives = res.data?.value || [];
  const drive =
    drives.find((d) => d.name === "Documents" || d.name === "Shared Documents") ||
    drives[0];

  if (!drive) throw new Error("❌ Энэ сайтын дор drive олдсонгүй.");
  _driveId = drive.id;
  return _driveId;
}

/**
 * Folder listing (ID эсвэл PATH):
 * - GUID бол: /items/{id}/children
 * - NAME/PATH бол: /root:/{path}:/children
 * NAME/PATH дээр 2 оролдлого хийнэ:
 *   1) path өөрөө
 *   2) SP_LIBRARY_ROOT_FOLDER + "/" + path   (танайх ZAG-AI/PROCESS-AI)
 */
async function listFolderFiles(folderIdOrPath, accessToken) {
  if (!folderIdOrPath) return [];
  const driveId = await getDriveId(accessToken);

  const tryUrls = [];

  if (isGuidLike(folderIdOrPath)) {
    tryUrls.push(`https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderIdOrPath}/children?$top=${LIMIT}`);
  } else {
    const p1 = encodePath(folderIdOrPath);
    if (p1) tryUrls.push(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${p1}:/children?$top=${LIMIT}`);

    // Хэрэв "PROCESS-AI" гэх мэт ганц сегмент бол ZAG-AI/PROCESS-AI гэж оролдож үзнэ
    const p2 = encodePath(`${SP_LIBRARY_ROOT_FOLDER}/${folderIdOrPath}`);
    if (p2 && p2 !== p1) {
      tryUrls.push(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${p2}:/children?$top=${LIMIT}`);
    }
  }

  for (const url of tryUrls) {
    console.log(`[SP] LIST ${url}`);
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const items = (res.data?.value || [])
        .filter((i) => i?.name && i?.webUrl)
        .filter((i) => hasAllowedExt(i.name))
        .slice(0, LIMIT)
        .map((i) => ({
          id: i.id,
          name: i.name,
          webUrl: i.webUrl,
          driveId,
          lastModifiedDateTime: i.lastModifiedDateTime,
        }));

      // Амжилттай бол шууд буцаана
      return items;
    } catch (err) {
      const status = err?.response?.status;
      // Дараагийн URL-аа оролдоно
      console.warn(`[SP] listFolderFiles try failed (${status}) for "${folderIdOrPath}"`);
    }
  }

  return [];
}

/**
 * App-only дээр root/search заримдаа 400 өгдөг тул:
 * 1) folder-оос list хийнэ
 * 2) query-тэй нь нэрээр нь оноо өгч эрэмбэлээд буцаана
 */
async function searchSharePoint(query, accessToken) {
  const q = normalizeQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean);

  // 1) Folder-уудаас жагсаалт авна
  const pools = [
    ...(await listFolderFiles(SP_PROCESS_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HR_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HSE_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_PROJECT_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_CONTRACT_FOLDER, accessToken)),
  ];

  if (!pools.length) return [];

  // 2) Query token-уудаар filename дээр score өгч эрэмбэлнэ
  const scored = pools.map(f => {
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

// Orchestrator эвдрэхгүй байлгахын тулд stub
async function searchSharePointBroad() {
  return [];
}

module.exports = {
  searchSharePoint,
  searchSharePointBroad,
  listFolderFiles,
  getSiteId,
  getDriveId,
};
