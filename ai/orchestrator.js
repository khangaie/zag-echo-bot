// ai/orchestrator.js
const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint } = require('../graph/sharepointSearch');
const { getGraphToken } = require('../graph/token');
const { askAI } = require('../graph/askAI');

// simple uniq by key
const uniqBy = (arr, key) =>
  Array.from(new Map((arr || []).map(x => [key(x), x])).values());

/**
 * End-to-end orchestrator:
 * 1) Azure AI Search-аас (BM25/semantic таны одоогийн хувилбар) хэсэглэлүүдийг авна
 * 2) SharePoint Graph search-аас файлууд (id+driveId-тэй) авч ирнэ
 * 3) Нэгтгээд askAI() руу дамжуулж Copilot-Шиг хариултыг бэлдэнэ
 *
 * NOTE: Хэрэв runtime OCR хэрэгтэй бол дараа нь processFiles() дуудаж болно.
 */
async function answerQuestion(question) {
  // 1) AI Search
  const aiSnippets = await retrievePassages(question, 6);

  // 2) SharePoint search (Graph)
  const token = await getGraphToken();
  const spFiles = await searchSharePoint(question, token);

  // 3) SP файлуудыг id+driveId-тэйгээр зөв дамжуулах (403-оос зайлсхийхэд ЧУХАЛ)
  const spRefs = (spFiles || []).map(f => ({
    id: f.id,                    // <-- Graph /content таталтад хэрэгтэй
    driveId: f.driveId,          // <-- Graph /content таталтад хэрэгтэй
    fileName: f.name,
    url: f.webUrl,
    content: ''                  // runtime OCR хийж дүүргэж болно
  }));

  // 4) Нэгтгэж top 8 авна (давхардалгүй)
  const docs = uniqBy([...(aiSnippets || []), ...spRefs], d => d.url || d.fileName)
                 .slice(0, 8);

  // 5) AI-аас structured хариулт
  const ans = await askAI(question, docs);

  // таны одоогийн bot.js { ans, docs }-ыг хэрэглэж байгаа тул энэ бүтэц хэвээр
  return { ans, docs };
}

module.exports = { answerQuestion };
