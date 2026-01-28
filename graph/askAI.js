const { searchSharePoint } = require('./sharepointSearch');
const { askOpenAI } = require('./aiclient');

function confidenceScore(docs) {
  if (docs.length >= 4) return 90;
  if (docs.length === 3) return 80;
  if (docs.length === 2) return 70;
  return 60;
}

async function askCopilot(question, accessToken) {
  // 1️⃣ SharePoint хайлт
  const documents = await searchSharePoint(question, accessToken);

  if (documents.length === 0) {
    return `
Энэ асуултад холбогдох баримт SharePoint-д олдсонгүй.

🟦 Санал болгох асуултууд:
- Аль хэлтсийн процесс вэ?
- Ямар нэртэй баримт вэ?
- Илүү тодорхой түлхүүр үг өгнө үү
`;
  }

  // 2️⃣ AI асуулт
  const answer = await askOpenAI(question, documents);

  // 3️⃣ Citation
  const citations = documents.map((d, i) =>
    `${i + 1}. ${d.fileName}\n   ${d.url}`
  ).join('\n');

  return `
${answer}

📎 Ашигласан баримтууд:
${citations}

🧠 Эх сурвалж:
"ZAG компанийн дотоод SharePoint баримтад үндэслэв."

🧠 Confidence score: ${confidenceScore(documents)}%
`;
}

module.exports = { askCopilot };
