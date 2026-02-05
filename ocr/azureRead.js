const axios = require('axios');

async function extractTextWithOCR(buffer) {
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  const key      = process.env.AZURE_DI_KEY;
  const route    = process.env.AZURE_DI_ROUTE || 'documentintelligence';

  const analyze = await axios.post(
    `${endpoint}/${route}/documentModels/prebuilt-layout:analyze?api-version=2023-10-31-preview`,
    buffer,
    { headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/pdf' } }
  );
  const opLoc = analyze.headers['operation-location'];

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const poll = await axios.get(opLoc, { headers: { 'Ocp-Apim-Subscription-Key': key } });
    if (poll.data.status === 'succeeded') {
      const content = poll.data.analyzeResult?.content || '';
      return Array.isArray(content) ? content.join('\n') : String(content);
    }
  }
  return '';
}

module.exports = { extractTextWithOCR };
