const axios = require('axios');

async function askAI(userQuestion, contextText) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    return '⚠️ AI тохиргоо дутуу байна.';
  }

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

  const payload = {
    messages: [
      {
        role: 'system',
        content: 'Чи ZAG компанийн SharePoint баримтад тулгуурлан хариулдаг AI.'
      },
      {
        role: 'user',
        content: `
Асуулт:
${userQuestion}

Холбогдох баримтууд:
${contextText}

Дээрх мэдээлэлд үндэслэн ойлгомжтой хариул.
`
      }
    ],
    temperature: 0.2
  };

  const response = await axios.post(url, payload, {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
}

module.exports = { askAI };
