const axios = require('axios');

const SEARCH_ENDPOINT = process.env.SEARCH_ENDPOINT;
const SEARCH_KEY      = process.env.SEARCH_KEY;
const INDEX_NAME      = process.env.INDEX_NAME || 'process-docs';

async function retrievePassages(query, topK = 6, filter = '') {
  const url = `${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/search?api-version=2024-07-01`;
  const body = {
    search: query,
    top: topK,
    queryType: "semantic",
    semanticConfiguration: "default",
    filter: filter || undefined
  };
  const res = await axios.post(url, body, {
    headers: { 'api-key': SEARCH_KEY, 'Content-Type': 'application/json' }
  });
  return (res.data.value || []).map(d => ({
    fileName: d.fileName || d.title || '(doc)',
    url: d.url,
    content: d.chunk || d.content || '',
    path: d.path,
    driveId: d.driveId,
    id: d['@search.documentId']
  }));
}
module.exports = { retrievePassages };
