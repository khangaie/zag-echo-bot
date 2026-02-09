// graph/askAI.js
const { callAzureOpenAI } = require('./aiClient');

function confidenceScore(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return 0;
  if (docs.length === 1) return 60;
  if (docs.length === 2) return 75;
  return 90;
}

function normalizeCitations(documents = []) {
  return documents.map((d, i) => ({
    index: i + 1,
    title: d.fileName || d.title || 'Source',
    webUrl: d.url || d.webUrl || '#'
  }));
}

/**
 * Structured answer: { tldr, steps[], notes, citations[], confidence }
 */
async function askAI(question, documents = []) {
  if (!Array.isArray(documents)) documents = [];

  if (documents.length === 0) {
    return {
      tldr: 'Энэ асуултад хариулах баримт олдсонгүй.',
      steps: [],
      notes: 'Илүү тодорхой түлхүүр үг, баримтын нэр/сэдвээ бичээд дахин оролдоно уу.',
      citations: [],
      confidence: 0
    };
  }

  const contextText = documents
    .map(d => `Файл: ${d.fileName}\n---\n${(d.content || '').trim()}`)
    .join('\n\n================\n\n');

  const system = [
    'Чи зөвхөн өгөгдсөн баримтуудын текстэд тулгуурлан хариулна.',
    'Баримтад байхгүй зүйлийг таамаглан нэмэхийг ХОРИГЛОНО.',
    'JSON объект л буцаа. Ямар ч Markdown/тайлбар/кодын блок бүү нэм.',
    'JSON бүтэц: {"tldr":"...", "steps":["..."], "notes":""}',
    'tldr — 1-2 өгүүлбэр, асуултад шууд хариул.',
    'steps — 3–8 алхам, тус бүрийг үйл үгнээс эхэлсэн богино өгүүлбэрээр бич.',
    'Хэрэв баримтаас хангалттай нотолгоо олдохгүй бол "tldr" дээр үгүй гэж хэл; "notes"-д яг юу дутуу байгааг бич.',
    'Монгол хэлээр бич.'
  ].join(' ');

  const user = [
    `Асуулт: ${question}`,
    '',
    'Баримтууд (зөвхөн эдгээр текстэд тулгуурлан дүгнэ):',
    contextText,
    '',
    'Заавал JSON объект л буцаа.'
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  const raw = await callAzureOpenAI(messages, {
    responseFormat: 'json',
    temperature: 0.2,
    maxTokens: 900
  });

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { parsed = { tldr: String(raw || '').trim(), steps: [], notes: '' }; }

  const tldr = String(parsed.tldr || '').trim();
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.map(s => String(s || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  const notes = String(parsed.notes || '').trim();

  const citations = normalizeCitations(documents);

  const hasAnswer = tldr.length > 0 || steps.length > 0;
  const final = hasAnswer
    ? { tldr, steps, notes }
    : {
        tldr: 'Энэ асуултад баримтаас шууд нотлогдох хариулт олдсонгүй.',
        steps: [],
        notes: 'Баримтын нэр/код, эсвэл ямар фолдероос хайхыг тодруулбал илүү зөв хариулна.'
      };

  return { ...final, citations, confidence: confidenceScore(documents) };
}

module.exports = { askAI };
