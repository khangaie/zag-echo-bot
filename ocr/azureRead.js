// ocr/azureRead.js
const axios = require('axios');

// Глобаль timeout-ыг ENV-ээс удирдана
axios.defaults.timeout = Number(process.env.HTTP_TIMEOUT_MS || 30000);

/**
 * Document Intelligence (хуучнаар Form Recognizer) prebuilt-layout ашиглан
 * PDF-ээс текст гаргана. ENV:
 *  - AZURE_DI_ENDPOINT (ж: https://<your-di>.cognitiveservices.azure.com)
 *  - AZURE_DI_KEY
 *  - AZURE_DI_API_VERSION=2023-10-31-preview (optional)
 *  - AZURE_DI_ROUTE=documentintelligence (optional)
 */
async function extractTextWithOCR(buffer) {
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  const key = process.env.AZURE_DI_KEY;
  const route = process.env.AZURE_DI_ROUTE || 'documentintelligence';
  const apiVersion = process.env.AZURE_DI_API_VERSION || '2023-10-31-preview';

  if (!endpoint || !key) {
    throw new Error('AZURE_DI_* env дутуу байна (AZURE_DI_ENDPOINT/AZURE_DI_KEY).');
  }

  const submitUrl = `${endpoint}/${route}/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
  const submit = await axios.post(submitUrl, buffer, {
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/pdf' }
  });

  const opLoc = submit.headers['operation-location'];
  if (!opLoc) throw new Error('Document Intelligence: operation-location header алга.');

  const started = Date.now();
  const timeoutMs = 120000; // 2 минут дээд
  while (Date.now() - started < timeoutMs) {
    await new Promise(r => setTimeout(r, 1500));
    const poll = await axios.get(opLoc, { headers: { 'Ocp-Apim-Subscription-Key': key } });
    const st = String(poll.data?.status || '').toLowerCase();
    if (st === 'succeeded') {
      const content = poll.data.analyzeResult?.content || '';
      return Array.isArray(content) ? content.join('\n') : String(content);
    }
    if (st === 'failed') {
      throw new Error(`Document Intelligence analyze failed: ${JSON.stringify(poll.data)}`);
    }
  }
  throw new Error('Document Intelligence analyze timeout.');
}

module.exports = { extractTextWithOCR };
