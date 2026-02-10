// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

// Танай Documents library дотор folder бүтэц: Shared Documents / ZAG-AI / PROCESS-AI ...
const SP_LIBRARY_ROOT_FOLDER = process.env.SP_LIBRARY_ROOT_FOLDER || "ZAG-AI";

// Folder env-үүд (folder NAME байна)
const SP_PROCESS_FOLDER = process.env.SP_PROCESS_FOLDER || "PROCESS-AI";
const SP_HR_FOLDER = process.env.SP_HR_FOLDER || "HR-AI";
const SP_HSE_FOLDER = process.env.SP_HSE_FOLDER || "HSE-AI";
const SP_PROJECT_FOLDER = process.env.SP_PROJECT_FOLDER || "PROJECT-AI";
const SP_CONTRACT_FOLDER = process.env.SP_CONTRACT_FOLDER || "CONTRACT-AI";

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
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  _siteId = res.data?.id;
  if (!_siteId) throw new Error("Site id not found in Graph response.");
  return _siteId;
}

// ✅ SP_DRIVE_ID баталгаажуулалт
async function isValidDriveId(driveId, accessToken) {
  if (!driveId) return false;
  try {
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}?$select=id,name,driveType`;
    await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    return true;
  } catch {
    return false;
  }
}

async function discoverDriveIdFromSite(accessToken) {
  const siteId = await getSiteId(accessToken);
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const drives = res.data?.value || [];

  // SharePoint дээр ихэвчлэн "Documents" эсвэл "Shared Documents" байдаг [1](https://learn.microsoft.com/en-us/graph/api/driveitem-list-children?view=graph-rest-1.0)
  const drive =
    drives.find((d) => d.name === "Documents" || d.name === "Shared Documents") ||
    drives[0];

  if (!drive?.id) throw new Error("Drive not found under site.");
  return drive.id;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;

  // 1) ENV driveId байгаа бол эхлээд drive мөн эсэхийг шалгана
  if (SP_DRIVE_ID) {
    const ok = await isValidDriveId(SP_DRIVE_ID, accessToken);
    if (ok) return (_driveId = SP_DRIVE_ID);
    console.warn(`[SP] SP_DRIVE_ID is not a valid drive id, will discover from site.`);
  }

  // 2) Буруу байвал site->drives‑оос автоматаар олно
  _driveId = await discoverDriveIdFromSite(accessToken);
  return _driveId;
}

/**
 * Folder listing by PATH: /root:/{path}:/children
 * Энэ endpoint нь зөв: /drives/{drive-id}/root:/{path-relative-to-root}:/children [2](https://stackoverflow.com/questions/62515341/get-all-files-in-a-folder-using-microsoft-graph-api)[1](https://learn.microsoft.com/en-us/graph/api/driveitem-list-children?view=graph-rest-1.0)
 */
async function listFolderFiles(folderName, accessToken) {
  const driveId = await getDriveId(accessToken);

  const tries = [
    `${folderName}`,                         // PROCESS-AI
    `${SP_LIBRARY_ROOT_FOLDER}/${folderName}`// ZAG-AI/PROCESS-AI
  ];

  for (const p of tries) {
    const enc = encodePath(p);
    if (!enc) continue;

    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${enc}:/children?$top=${LIMIT}`;
    console.log(`[SP] LIST ${url}`);

    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

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

      return items;
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error?.message || err.message;
      console.warn(`[SP] listFolderFiles try failed (${status}) for "${p}" : ${msg}`);
      // дараагийн path-аа оролдоно
    }
  }

  return [];
}

async function searchSharePoint(query, accessToken) {
  const q = normalizeQuery(query);
  const tokens = q.split(/\s+/).filter(Boolean);

  // folder pool
  const pool = [
    ...(await listFolderFiles(SP_PROCESS_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HR_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_HSE_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_PROJECT_FOLDER, accessToken)),
    ...(await listFolderFiles(SP_CONTRACT_FOLDER, accessToken)),
  ];

  if (!pool.length) return [];

  // filename based scoring
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

// orchestrator-д зориулж үлдээнэ
async function searchSharePointBroad() {
  return [];
}

module.exports = {
  searchSharePoint,
  searchSharePointBroad,
  getSiteId,
  getDriveId,
};
