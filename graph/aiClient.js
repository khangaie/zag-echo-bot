const axios = require('axios');

/**
 * AI-аас эцсийн хариу гаргана
 * @param {string} userQuestion
 * @param {string} contextText - SharePoint-оос олдсон мэдээлэл
 */
async function askAI(userQuestion, contextText) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

    if (!endpoint || !apiKey || !deployment) {
        return '⚠️ AI тохиргоо дутуу байна.';
    }

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

    const payload = {
        messages: [
            {
                role: 'system',
                content:
                    'Чи бол компанийн дотоод SharePoint баримт дээр тулгуурлан хариулдаг туслах AI.'
            },
            {
                role: 'user',
                content: `
Асуулт:
${userQuestion}

Холбогдох баримтууд:
${contextText}

Дээрх мэдээлэлд үндэслэн ойлгомжтой хариулт өг.
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

module.exports = {
    askAI
};
