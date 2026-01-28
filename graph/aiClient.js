const axios = require('axios');

async function askAI(userQuestion, contextText) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    return '⚠️ AI тохиргоо дутуу байна.';
  }

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

  const systemPrompt = `
Та бол ZAG AI Bot.
Таны үүрэг бол ЗӨВХӨН SharePoint дээрээс олдсон баримт бичигт үндэслэн хариу өгөх явдал юм.

❗ ДҮРМҮҮД:
1. SharePoint дээр олдсон баримтад байхгүй мэдээллээр ерөнхий, таамагласан хариу өгөхийг ХОРИГЛОНО.
2. Хэрвээ холбогдох баримт олдоогүй бол:
   “Таны асуултад холбогдох мэдээлэл SharePoint дээр олдсонгүй. Асуултаа илүү тодорхой болгоно уу.”
гэсэн утгатай хариу өг.
3. “process”, “policy” гэх мэт ерөнхий асуултад:
   – Ямар баримт, ямар сэдэв гэдгийг тодруулж асуу.
4. Баримт АНГЛИ хэл дээр байсан ч:
   – Хариултыг ЗӨВХӨН МОНГОЛ хэлээр өг.
5. Хариулт нь Copilot шиг:
   – Товч
   – Цэгцтэй
   – Алхамчилсан (боломжтой бол)
6. “магадгүй”, “ихэнхдээ”, “ерөнхийдөө” гэх мэт үг ашиглахыг ХОРИГЛОНО.

ЗАРЧИМ:
“Баримтад байвал – тайлбарла.
Баримтад байхгүй бол – татгалз.”
`;

  const payload = {
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `
Асуулт:
${userQuestion}

SharePoint-оос олдсон баримтын агуулга:
${contextText}
`
      }
    ],
    temperature: 0.1
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

