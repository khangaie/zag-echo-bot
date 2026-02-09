// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

// Folder env-үүд (ID эсвэл PATH байж болно)
const SP_PROCESS_FOLDER = process.env.SP_PROCESS_FOLDER || "";
const SP_HR_FOLDER = process.env.SP_HR_FOLDER || "";
const SP_HSE_FOLDER = process.env.SP_HSE_FOLDER || "";
const SP_PROJECT_FOLDER = process.env.SP_PROJECT_FOLDER || "";

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

// "A/B C" -> "A/B%20C" (segment-ээр encode)
function encodePath(path) {
  const clean = String(path || "").replace(/^\/+|\/+$/g, "");
  if (!clean) return "";
  return clean.split("/").map(encodeURIComponent).join("/");
}

// Query-г богино, safe болгох
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
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    _siteId = res.data?.id;
    if (!_siteId) throw new Error("Site id not found in Graph response.");
    return _siteId;
  } catch (err) {
    console.error("[SP] getSiteId error:", err?.response?.data || err.message);
    throw err;
  }
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;
  if (SP_DRIVE_ID) return (_driveId = SP_DRIVE_ID);

  const siteId = await getSiteId(accessToken);
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  try {
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
  } catch (err) {
    console.error("[SP] getDriveId error:", err?.response?.data || err.message);
    throw err;
  }
}

/**
 * Folder listing:
 * - env нь GUID бол: /items/{id}/children
 * - env нь name/path бол: /root:/{path}:/children
 * 400/403 гарвал бот унахгүй, [] буцаана.
 */
async function listFolderFiles(folderIdOrPath, accessToken) {
  if (!folderIdOrPath) return [];
  const driveId = await getDriveId(accessToken);

  let url;
  if (isGuidLike(folderIdOrPath)) {
    url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderIdOrPath}/children?$top=${LIMIT}`;
  } else {
    const p = encodePath(folderIdOrPath);
    if (!p) return [];
    url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${p}:/children?$top=${LIMIT}`;
  }

  console.log(`[SP] LIST ${url}`);

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return (res.data?.value || [])
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
  } catch (err) {
    const status = err?.response?.status;
    console.warn(`[SP] listFolderFiles failed (${status}) for "${folderIdOrPath}"`);
    return [];
  }
}

/**
 * Narrow search: /root/search(q='...')
 * 400 гарвал [] буцаана (дараа нь folder fallback ажиллана)
 */
async function searchSharePoint(query, accessToken) {
  const driveId = await getDriveId(accessToken);
  const safe = normalizeQuery(query);
  const encodedQ = encodeURIComponent(safe);

  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodedQ}')`;
  console.log(`[SP] GET ${url}`);

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });

    const items = (res.data?.value || [])
      .filter((i) => i?.name && i?.webUrl)
      .filter((i) => hasAllowedExt(i.name))
      .sort(
        (a, b) =>
          new Date(b?.lastModifiedDateTime || 0) -
          new Date(a?.lastModifiedDateTime || 0)
      )
      .slice(0, LIMIT);

    if (items.length) {
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl,
        driveId: i.parentReference?.driveId || driveId,
        lastModifiedDateTime: i.lastModifiedDateTime,
      }));
    }
  } catch (err) {
    const status = err?.response?.status;
    if (status === 400) {
      console.warn("[SP] narrow search returned 400; continue with folder fallback.");
    } else {
      console.error("[SP] searchSharePoint error:", err?.response?.data || err.message);
    }
  }

  // Folder fallback (PROCESS → HR → HSE → PROJECT)
  const fallback = [
    ...(await listFolderFiles(SP_PROCESS_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HR_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HSE_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_PROJECT_FOLDER, accessToken)),
  ];

  return fallback.slice(0, LIMIT);
}

// App-only дээр /search/query нь “region required / topResults …” 400 өгдөг тул stub.
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
