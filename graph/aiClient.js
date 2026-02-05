const axios = require('axios');

async function callAzureOpenAI(messages, temperature = 0.2) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI env тохиргоо дутуу');
  }
 const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
 const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;


const res = await axios.post(
  url,
   { messages, temperature },
   {
     headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
     timeout: Number(process.env.HTTP_TIMEOUT_MS || 180000)
   }
 );

  return res.data.choices[0].message.content;
}

module.exports = { callAzureOpenAI };
