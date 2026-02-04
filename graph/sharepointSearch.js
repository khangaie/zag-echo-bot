const axios = require("axios");

// ENV-ээс уншдаг (байхгүй бол default-оор тохируулна)
const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

// Сонголтоор: зөвшөөрөх өргөтгөлүүд (csv) ба дээд лимит
// Ж: SP_FILE_TYPES="pdf,docx,xlsx"
const ALLOWED_EXTS = (process.env.SP_FILE_TYPES || "")
  .toLowerCase()
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const LIMIT = Number(process.env.SP_SEARCH_LIMIT || 10);

let _siteId;   // кэшлэнэ
let _driveId;  // кэшлэнэ

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
  // Сайтын ID-г hostname + site-path-аар авна
  const url = `https://graph.microsoft.com/v1.0/sites/${SP_HOST}:${SP_SITE_PATH}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  _siteId = res.data.id;
  return _siteId;
}

async function getDriveId(accessToken) {
  if (_driveId) return _driveId;
  const siteId = await getSiteId(accessToken);
  // Сайтын дор байгаа drives-аас "Documents"/"Shared Documents"-ыг сонгоно
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const drives = res.data?.value || [];
  const drive =
    drives.find(d => d.name === "Documents" || d.name === "Shared Documents") ||
    drives[0];

  if (!drive) throw new Error("❌ Энэ сайтын дор drive олдсонгүй.");
  _driveId = drive.id;
  return _driveId;
}

function hasAllowedExt(name) {
  if (ALLOWED_EXTS.length === 0) return true; // Хэрэв шүүлтүүр тогтоогоогүй бол бүгдийг зөвшөөрнө
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ALLOWED_EXTS.includes(ext);
}

async function searchSharePoint(query, accessToken) {
  const driveId = await getDriveId(accessToken);

  // Drive доторх хурдан хайлт
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodeURIComponent(query)}')`;

  // Оношийн жижиг лог (Log Stream дээр харагдана)
  console.log(`[SP] GET ${url}`);

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const items = (res.data?.value || [])
    .filter(i => i.name)                 // нэргүй элементүүдийг хаяна
    .filter(i => hasAllowedExt(i.name))  // өргөтгөлийн шүүлт (сонголттой)
    // Сүүлд өөрчлөгдсөн огноогоор буурахаар эрэмбэлнэ (байвал)
    .sort((a, b) => new Date(b.lastModifiedDateTime || 0) - new Date(a.lastModifiedDateTime || 0))
    .slice(0, LIMIT);

  return items.map(i => ({
    name: i.name,
