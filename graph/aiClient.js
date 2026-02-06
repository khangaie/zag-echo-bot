// graph/aiClient.js
const axios = require('axios');

async function callAzureOpenAI(messages, {
  temperature = 0.2,
  responseFormat = 'text', // 'text' | 'json'
  maxTokens = 900,
  seed = 42
} = {}) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI env тохиргоо дутуу');
  }
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const timeout = Number(process.env.HTTP_TIMEOUT_MS || 180000);

  const payload = {
    messages,
    temperature,
    max_tokens: maxTokens,
    seed
  };
  if (responseFormat === 'json') {
    payload.response_format = { type: 'json_object' };
  }

  const res = await axios.post(url, payload, {
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    timeout
  });
  return res.data?.choices?.[0]?.message?.content || '';
}

module.exports = { callAzureOpenAI };
