const axios = require("axios");

// ENV-ээс уншдаг (байхгүй бол default-оор тохируулна)
const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

// Сонголтоор: зөвшөөрөх өргөтгөлүүд (csv) ба дээд лимит
// Ж: SP_FILE_TYPES="pdf,docx,xlsx"
const ALLOWED_EXTS = (process.env.SP_FILE_TYPES || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const LIMIT = Number(process.env.SP_SEARCH_LIMIT || 10);

let _siteId;   // кэшлэнэ
let _driveId;  // кэшлэнэ

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;

  // Сайтын ID-г hostname + site-path-аар авна
  const url = `https://graph.microsoft.com/v1.0/sites/${SP_HOST}:${SP_SITE_PATH}`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    _siteId = res.data?.id;
    if (!_siteId) {
      throw new Error("Site id not found in Graph response.");
    }
    return _siteId;
  } catch (err) {
    console.error("[SP] getSiteId error:", err?.response?.data || err.message);
    throw err;
  }
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;

  const siteId = await getSiteId(accessToken);

  // Сайтын дор байгаа drives-аас "Documents"/"Shared Documents"-ыг сонгоно
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const drives = res.data?.value || [];
    const drive =
      drives.find((d) => d.name === "Documents" || d.name === "Shared Documents") ||
      drives[0];

    if (!drive) {
      throw new Error("❌ Энэ сайтын дор drive олдсонгүй.");
    }

    _driveId = drive.id;
    return _driveId;
  } catch (err) {
    console.error("[SP] getDriveId error:", err?.response?.data || err.message);
    throw err;
  }
}

function hasAllowedExt(name) {
  if (ALLOWED_EXTS.length === 0) return true; // Хэрэв шүүлтүүр тогтоогоогүй бол бүгдийг зөвшөөрнө
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ALLOWED_EXTS.includes(ext);
}

/**
 * Drive дотор хайх (Graph: /drives/{driveId}/root/search(q='...'))
 * Анхаар: query-г URL-д оруулахдаа encodeURIComponent хийж байна.
 */
async function searchSharePoint(query, accessToken) {
  const driveId = await getDriveId(accessToken);

  // Drive доторх хурдан хайлт
  const encodedQ = encodeURIComponent(query);
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodedQ}')`;

  // Оношийн жижиг лог (App Service Log Stream дээр харагдана)
  console.log(`[SP] GET ${url}`);

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const items = (res.data?.value || [])
      .filter((i) => i?.name)                 // нэргүй элементүүдийг хаяна
      .filter((i) => hasAllowedExt(i.name))   // өргөтгөлийн шүүлт (сонголттой)
      // Сүүлд өөрчлөгдсөн огноогоор буурахаар эрэмбэлнэ (байвал)
      .sort(
        (a, b) =>
          new Date(b?.lastModifiedDateTime || 0) -
          new Date(a?.lastModifiedDateTime || 0)
      )
      .slice(0, LIMIT);

    // Илүү аюулгүй, UI-д хэрэгтэй талбарууд
    return items.map((i) => ({
      id: i.id,
      name: i.name,
      webUrl: i.webUrl, // шууд нээж болох холбоос
      size: i.size,
      fileType:
        (i.file && i.file?.mimeType) ||
        (i.name.includes(".") ? i.name.split(".").pop().toLowerCase() : undefined),
      lastModified: i.lastModifiedDateTime,
      created: i.createdDateTime,
      path: i.parentReference?.path, // /drives/{id}/root:/... хэлбэртэй
      driveId: i.parentReference?.driveId || driveId,
    }));
  } catch (err) {
    console.error("[SP] searchSharePoint error:", err?.response?.data || err.message);
    throw err;
  }
}

module.exports = {
  searchSharePoint,
  getSiteId,
  getDriveId,
};
