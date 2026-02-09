// graph/sharepointSearch.js
const axios = require("axios");

const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

// ENV дээр байвал шууд ашиглана
const SP_SITE_ID = process.env.SP_SITE_ID || "";
const SP_DRIVE_ID = process.env.SP_DRIVE_ID || "";

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

// Query-г "safe" болгох: тэмдэгт цэвэрлэх + богиносгох + давхардал хасах
function normalizeQuery(q) {
  const raw = String(q || "");
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  // давхардлыг арилгана (гэрээ гэрээ -> гэрээ)
  const uniq = [];
  const seen = new Set();
  for (const t of tokens) {
    if (!seen.has(t)) {
      uniq.push(t);
      seen.add(t);
    }
    if (uniq.length >= 8) break; // хэт урт болгохгүй
  }

  // хамгийн багадаа 1 үг үлдээнэ
  return uniq.length ? uniq.join(" ") : raw.trim().slice(0, 50);
}

// OData function параметрт single quote орвол escape хийх хэрэгтэй ('' болгоно)
function escapeODataString(s) {
  return String(s || "").replace(/'/g, "''");
}

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
  if (SP_SITE_ID) {
    _siteId = SP_SITE_ID;
    return _siteId;
  }
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
  if (SP_DRIVE_ID) {
    _driveId = SP_DRIVE_ID;
    return _driveId;
  }
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
 * Narrow: Drive дотор хайх (/drives/{driveId}/root/search(q='...'))
 * ✅ 400 гарвал бот унахгүй, [] буцаана (оркестратор broad fallback руу орно)
 */
async function searchSharePoint(query, accessToken) {
  const driveId = await getDriveId(accessToken);

  const safe = normalizeQuery(query);
  const odata = escapeODataString(safe);

  // ⚠️ Анхаар: URL-д бүхэлд нь encode хийгдэх ёстой тул энд encodeURIComponent хэрэглэнэ
  const encodedQ = encodeURIComponent(odata);

  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodedQ}')`;
  console.log(`[SP] GET ${url}`);

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const items = (res.data?.value || [])
      .filter((i) => i?.name)
      .filter((i) => hasAllowedExt(i.name))
      .sort(
        (a, b) =>
          new Date(b?.lastModifiedDateTime || 0) -
          new Date(a?.lastModifiedDateTime || 0)
      )
      .slice(0, LIMIT);

    return items.map((i) => ({
      id: i.id,
      name: i.name,
      webUrl: i.webUrl,
      driveId: i.parentReference?.driveId || driveId,
      lastModifiedDateTime: i.lastModifiedDateTime,
    }));
  } catch (err) {
    const status = err?.response?.status;
    // ✅ 400 (Bad Request) бол narrow нь зарим query дээр эвдрэх тохиолдол — шууд [] буцаая
    if (status === 400) {
      console.warn("[SP] narrow search returned 400; returning [] to allow broad fallback.");
      return [];
    }
    console.error("[SP] searchSharePoint error:", err?.response?.data || err.message);
    throw err;
  }
}

/**
 * Broad: Graph /search/query (driveItem + listItem)
 * Narrow 0 үед fallback.
 */
async function searchSharePointBroad(query, accessToken) {
  const url = `https://graph.microsoft.com/v1.0/search/query`;
  const safe = normalizeQuery(query);

  const body = {
    requests: [{
      entityTypes: ["driveItem", "listItem"],
      query: { queryString: safe },
      from: 0,
      size: LIMIT,
      enableTopResults: true
    }]
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const hits = res.data?.value?.[0]?.hitsContainers?.[0]?.hits || [];
    const items = hits
      .map(h => h.resource || {})
      .map(r => ({
        id: r.id,
        name: r.name || r.title,
        webUrl: r.webUrl,
        driveId: r.parentReference?.driveId,
        lastModifiedDateTime: r.lastModifiedDateTime
      }))
      .filter(x => x.name && x.webUrl)
      .filter(x => hasAllowedExt(x.name))
      .slice(0, LIMIT);

    return items;
  } catch (err) {
    console.error("[SP] searchSharePointBroad error:", err?.response?.data || err.message);
    return [];
  }
}

module.exports = {
  searchSharePoint,
  searchSharePointBroad,
  getSiteId,
  getDriveId,
};
