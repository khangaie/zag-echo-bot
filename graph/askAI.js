const { callAzureOpenAI } = require('./aiClient');

function confidenceScore(docs) {
  if (docs.length === 0) return 0;
  if (docs.length === 1) return 60;
  if (docs.length === 2) return 75;
  return 90;
}

async function askAI(question, documents = []) {
  if (documents.length === 0) {
    return `
Энэ асуултад хариулах баримт олдсонгүй.

💡 Suggested questions:
• Аль процессын талаар асууж байна вэ?
• Ямар баримт хайж байна вэ?
• Түлхүүр үг өгнө үү
`;
  }

  const citations = documents
    .map((d, i) => `${i + 1}. ${d.fileName} – ${d.url}`)
    .join('\n');

  const contextText = documents
    .map(d => `Файл: ${d.fileName}\n${d.content}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content:
        'Та зөвхөн өгөгдсөн SharePoint баримтад тулгуурлан хариулна.'
    },
    {
      role: 'user',
      content: `Асуулт: ${question}\n\nБаримтууд:\n${contextText}`
    }
  ];

  const aiAnswer = await callAzureOpenAI(messages);

  return `
${aiAnswer}

📎 Эдгээр баримтад үндэслэв:
${citations}

🧠 Confidence score: ${confidenceScore(documents)}%
`;
}

module.exports = { askAI };

