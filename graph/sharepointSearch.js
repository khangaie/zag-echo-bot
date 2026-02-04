const axios = require("axios");

// Хост, сайтын замыг ENV-ээс унших боломж нээе; байхгүй бол таны өгөхөөр default.
const SP_HOST = process.env.SP_SITE_HOSTNAME || "zagengineering.sharepoint.com";
const SP_SITE_PATH = process.env.SP_SITE_PATH || "/sites/ZAG-AI";

let _siteId;
let _driveId;

async function getSiteId(accessToken) {
  if (_siteId) return _siteId;
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
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  // "Documents" эсвэл "Shared Documents" гэж нэрлэгдсэн санг сонгоно
  const drive =
    res.data.value.find(d => d.name === "Documents" || d.name === "Shared Documents")
    || res.data.value[0];
  if (!drive) throw new Error("No drives found under the site.");
  _driveId = drive.id;
  return _driveId;
}

async function searchSharePoint(query, accessToken) {
  const driveId = await getDriveId(accessToken);
  // Drive дотор шууд хайх (илүү хурдан, яг энэ сайт руу хязгаарлагдана)
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root/search(q='${encodeURIComponent(query)}')`;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
  });

  const items = res.data.value || [];
  return items.map(i => ({ name: i.name, url: i.webUrl }));
}

module.exports = { searchSharePoint };
