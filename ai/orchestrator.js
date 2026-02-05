const { retrievePassages } = require('../graph/aiSearch');
const { searchSharePoint } = require('../graph/sharepointSearch');
const { getGraphToken }    = require('../graph/token');
const { askAI }            = require('../graph/askAI');

const uniqBy = (arr, key) => Array.from(new Map(arr.map(x => [key(x), x])).values());

async function answerQuestion(question) {
  const aiSnippets = await retrievePassages(question, 6);
  const token = await getGraphToken();
  const spFiles = await searchSharePoint(question, token);
  const spRefs  = spFiles.map(f => ({ fileName: f.name, url: f.webUrl, content: '', driveId: f.driveId }));

  const docs = uniqBy([...aiSnippets, ...spRefs], d => d.url || d.fileName).slice(0, 8);
  const answer = await askAI(question, docs);
  return { answer, docs };
}
module.exports = { answerQuestion };
