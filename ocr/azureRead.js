const axios = require('axios');
axios.defaults.timeout = Number(process.env.HTTP_TIMEOUT_MS || 30000);

function trimSlash(s) {
  return String(s || '').replace(/\/+$/g, '');
}

function normRoute(r) {
  const x = String(r || '').trim();
  if (!x) return 'formrecognizer'; // ✅ default
  return x.toLowerCase();
}

async function extractTextWithOCR(buffer) {
  const endpoint = trimSlash(process.env.AZURE_DI_ENDPOINT);
  const key = process.env.AZURE_DI_KEY;
  const route = normRoute(process.env.AZURE_DI_ROUTE || 'formrecognizer');
  const apiVersion = process.env.AZURE_DI_API_VERSION || '2023-07-31';

  if (!endpoint || !key) {
    throw new Error('AZURE_DI_ENDPOINT/AZURE_DI_KEY env дутуу байна.');
  }

  const submitUrl = `${endpoint}/${route}/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;

  let submit;
  try {
    submit = await axios.post(submitUrl, buffer, {
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/pdf',
      },
    });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    throw new Error(`Document Intelligence submit failed: ${msg}`);
  }

  const opLoc = submit.headers['operation-location'];
  if (!opLoc) throw new Error('Document Intelligence: operation-location header алга.');

  const started = Date.now();
  const timeoutMs = 120000;

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await axios.get(opLoc, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });

    const st = String(poll.data?.status || '').toLowerCase();
    if (st === 'succeeded') {
      return String(poll.data.analyzeResult?.content || '');
    }
    if (st === 'failed') {
      const msg = poll.data?.error?.message || JSON.stringify(poll.data);
      throw new Error(`Document Intelligence analyze failed: ${msg}`);
    }
  }

  throw new Error('Document Intelligence analyze timeout.');
}

module.exports = { extractTextWithOCR };
