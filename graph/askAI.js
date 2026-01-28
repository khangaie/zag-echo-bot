const { callAzureOpenAI } = require('./aiclient');

/**
 * documents = [
 *   {
 *     fileName: 'Гэрээ_байгуулах_процесс.docx',
 *     folder: 'PROCESS-AI',
 *     url: 'https://sharepoint/...',
 *     content: 'баримтын текст'
 *   }
 * ]
 */

function calculateConfidence(documents) {
  if (!documents || documents.length === 0) return 0;
  if (documents.length >= 3) return 90;
  if (documents.length === 2) return 75;
  return 60;
}

async function askAI(userQuestion, documents = []) {
  // ❌ Баримтгүй бол AI-г огт дуудахгүй
  if (!documents || documents.length === 0) {
    return `
Энэ асуултад хариулах мэдээлэл ZAG компанийн SharePoint баримтад олдсонгүй.

🟦 Санал болгох асуултууд:
- Аль процессын талаар асууж байна вэ?
- Ямар хэлтсийн баримт вэ?
- Илүү тодорхой түлхүүр үг өгнө үү
`;
  }

  const combinedText = documents.map((d, i) => `
[${i + 1}]
Файл: ${d.fileName}
Folder: ${d.folder}
Link: ${d.url}

Агуулга:
${d.content}
`).join('\n\n');

  const citations = documents.map((d, i) => `
${i + 1}. ${d.fileName}
   Folder: ${d.folder}
   Link: ${d.url}
`).join('\n');

  const confidence = calculateConfidence(documents);

  const messages = [
    {
      role: 'system',
      content: `
Чи ZAG компанийн SharePoint баримтад үндэслэн хариулдаг AI Copilot.

ХАТУУ ДҮРЭМ:
1. Хариулт нь ЗӨВХӨН өгөгдсөн баримтын агуулгад тулгуурлана.
2. Баримтад байхгүй мэдээллээр таамаглаж, ерөнхий хариулт өгөхийг ХОРИГЛОНО.
3. Баримт англи байсан ч хариуг ЗААВАЛ МОНГОЛ хэлээр өг.
4. Хариултын төгсгөлд:
   - 📎 Ашигласан баримтууд
   - 🧠 Эх сурвалж
   - 🧠 Confidence score
   - 🟦 3 Suggested questions
   заавал оруул.
`
    },
    {
      role: 'user',
      content: `
Асуулт:
${userQuestion}

Баримтууд:
${combinedText}
`
    }
  ];

  const aiAnswer = await callAzureOpenAI(messages);

  return `
${aiAnswer}

📎 Ашигласан баримтууд:
${citations}

🧠 Эх сурвалж:
"Дээрх хариулт нь ZAG компанийн дотоод SharePoint баримтад үндэслэв."

🧠 Confidence score: ${confidence}%
`;
}

module.exports = { askAI };
