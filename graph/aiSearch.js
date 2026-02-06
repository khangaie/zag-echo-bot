// graph/aiSearch.js
const axios = require('axios');

const SEARCH_ENDPOINT = process.env.SEARCH_ENDPOINT;
const SEARCH_KEY      = process.env.SEARCH_KEY;
const INDEX_NAME      = process.env.INDEX_NAME || 'process-docs';

/**
 * Энгийн (семантикгүй) хайлт.
 * Семантик тохиргоо байхгүй орчинд 400 гарахаас сэргийлж queryType/semanticConfiguration-ийг илгээхгүй.
 * Алдаа тохиолдвол [] буцааж, бот унахгүй.
 */
async function retrievePassages(query, topK = 6, filter = '') {
  const url = `${SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/search?api-version=2024-07-01`;

  // ЭНГИЙН хайлтын бие — queryType/semanticConfiguration байхгүй!
  const body = {
    search: query,
    top: topK,
    filter: filter || undefined
  };

  try {
    const res = await axios.post(url, body, {
      headers: { 'api-key': SEARCH_KEY, 'Content-Type': 'application/json' }
    });

    const rows = Array.isArray(res.data?.value) ? res.data.value : [];
    return rows.map(d => ({
      fileName: d.fileName || d.title || '(doc)',
      url: d.url,
      content: d.chunk || d.content || '',
      path: d.path,
      driveId: d.driveId,
      id: d['@search.documentId']
    }));
  } catch (e) {
    const status = e.response?.status;
    const msg = e.response?.data?.error?.message || e.message;
    console.error(`[AI Search] retrievePassages error ${status}: ${msg} (index=${INDEX_NAME})`);
    // Эвдрэлгүй fallback — RAG тал хоосон байвал бот SP-ийн үр дүнгээр хариулж чадна
    return [];
  }
}

module.exports = { retrievePassages };
