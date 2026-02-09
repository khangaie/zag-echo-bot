// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

// Folder IDs (ENV дээр байгаа)
const SP_PROCESS_FOLDER = process.env.SP_PROCESS_FOLDER;
const SP_HR_FOLDER = process.env.SP_HR_FOLDER;
const SP_HSE_FOLDER = process.env.SP_HSE_FOLDER;
const SP_PROJECT_FOLDER = process.env.SP_PROJECT_FOLDER;

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

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
  if (SP_SITE_ID) return (_siteId = SP_SITE_ID);

  const url = `https://graph.microsoft.com/v1.0/sites/${SP_HOST}:${SP_SITE_PATH}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  _siteId = res.data?.id;
  return _siteId;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;
  if (SP_DRIVE_ID) return (_driveId = SP_DRIVE_ID);

  const siteId = await getSiteId(accessToken);
  const res = await axios.get(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  _driveId = res.data?.value?.[0]?.id;
  return _driveId;
}

/**
 * ✅ Folder‑based fallback (APP‑ONLY permission‑д зөв)
 */
async function listFolderFiles(folderId, accessToken) {
  if (!folderId) return [];

  const driveId = await getDriveId(accessToken);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children?$top=${LIMIT}`;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return (res.data?.value || [])
    .filter(i => i?.name)
    .filter(i => hasAllowedExt(i.name))
    .map(i => ({
      id: i.id,
      name: i.name,
      webUrl: i.webUrl,
      driveId
    }));
}

/**
 * ✅ Main search (App‑only friendly)
 */
async function searchSharePoint(query, accessToken) {
  const driveId = await getDriveId(accessToken);

  const safeQuery = String(query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");

  // 1️⃣ Narrow search
  try {
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodeURIComponent(safeQuery)}')`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const items = (res.data?.value || [])
      .filter(i => i?.name)
      .filter(i => hasAllowedExt(i.name))
      .slice(0, LIMIT);

    if (items.length > 0) {
      return items.map(i => ({
        id: i.id,
        name: i.name,
        webUrl: i.webUrl,
        driveId
      }));
    }
  } catch {
    // ignore
  }

  // 2️⃣ Folder‑based fallback (PROCESS → HR → HSE → PROJECT)
  return [
    ...(await listFolderFiles(SP_PROCESS_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HR_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HSE_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_PROJECT_FOLDER, accessToken)),
  ].slice(0, LIMIT);
}

module.exports = {
  searchSharePoint,
  getSiteId,
  getDriveId,
};
