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
 * Structured answer:
 * {
 *  tldr: string,
 *  keyPoints: string[],
 *  facts: [{ title, value }], // for table
 *  steps: string[],          // only when needSteps
 *  followUps: string[],
 *  notes: string,
 *  citations: [],
 *  confidence: number
 * }
 */
async function askAI(question, documents = [], options = {}) {
  const needSteps = !!options.needSteps;
  const domain = String(options.domain || 'general');

  if (!Array.isArray(documents)) documents = [];
  if (documents.length === 0) {
    return {
      tldr: 'Энэ асуултад хариулах баримт олдсонгүй.',
      keyPoints: [],
      facts: [],
      steps: [],
      followUps: [],
      notes: 'Илүү тодорхой түлхүүр үг, баримтын нэр/сэдвээ бичээд дахин оролдоно уу.',
      citations: [],
      confidence: 0
    };
  }

  const contextText = documents
    .map(d => `Файл: ${d.fileName}\n---\n${String(d.content || '').trim()}`)
    .join('\n\n================\n\n');

  const system = [
    'Чи Microsoft Copilot шиг ТОВЧ, ЦЭГЦТЭЙ, АЖЛЫН ХЭРЭГЛЭЭНИЙ хариулт өгнө.',
    'Зөвхөн өгөгдсөн баримтуудын текстэд тулгуурлаж бич.',
    'Баримтад байхгүй зүйлийг таамаглан НЭМЭХИЙГ ХОРИГЛОНО.',
    'Зөвхөн JSON объект буцаа. Markdown/тайлбар/кодын блок БИЧИХГҮЙ.',
    '',
    'JSON бүтэц (яг энэ түлхүүрүүдээр):',
    '{',
    '  "tldr": "1–2 өгүүлбэр гол хариу",',
    '  "keyPoints": ["чухал цэг 1", "чухал цэг 2"],',
    '  "facts": [{"title":"Нөхцөл","value":"Утга"}],',
    '  "steps": ["..."],',
    '  "followUps": ["Та бас ... асууж болно"],',
    '  "notes": "анхаарах зүйл / хязгаарлалт байхгүй бол хоосон string"',
    '}',
    '',
    'tldr: асуултад шууд хариул.',
    'keyPoints: 2–5 ширхэг, богино, ажил хэрэгч.',
    'facts: боломжтой бол 3–8 мөрийн "Нөхцөл/Утга" хүснэгт; боломжгүй бол [] буцаа.',
    needSteps
      ? 'steps: хэрэглэгч процесс/алхам асуусан тул 3–6 алхам буцаа.'
      : 'steps: хэрэглэгч процесс/алхам ШУУД хүсээгүй тул заавал [] буцаа.',
    'followUps: 2–4 ширхэг, тухайн домэйны зөв дараагийн асуултын санал.',
    `Домэйн: ${domain}.`,
    'Монгол хэлээр бич.'
  ].join('\n');

  const user = [
    `Асуулт: ${question}`,
    `needSteps: ${needSteps ? 'true' : 'false'}`,
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
  catch {
    parsed = { tldr: String(raw || '').trim(), keyPoints: [], facts: [], steps: [], followUps: [], notes: '' };
  }

  const tldr = String(parsed.tldr || '').trim();
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints.map(x => String(x || '').trim()).filter(Boolean).slice(0, 6)
    : [];

  const facts = Array.isArray(parsed.facts)
    ? parsed.facts
        .map(f => ({
          title: String(f?.title || '').trim(),
          value: String(f?.value || '').trim()
        }))
        .filter(f => f.title && f.value)
        .slice(0, 10)
    : [];

  let steps = Array.isArray(parsed.steps)
    ? parsed.steps.map(s => String(s || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  // ✅ needSteps=false үед хүчээр хоосолно
  if (!needSteps) steps = [];

  const followUps = Array.isArray(parsed.followUps)
    ? parsed.followUps.map(s => String(s || '').trim()).filter(Boolean).slice(0, 5)
    : [];

  const notes = String(parsed.notes || '').trim();
  const citations = normalizeCitations(documents);

  const final = tldr
    ? { tldr, keyPoints, facts, steps, followUps, notes }
    : {
        tldr: 'Энэ асуултад баримтаас шууд нотлогдох хариулт олдсонгүй.',
        keyPoints: [],
        facts: [],
        steps: [],
        followUps: [],
        notes: 'Баримтын нэр/код, эсвэл ямар фолдероос хайхыг тодруулбал илүү зөв хариулна.'
      };

  return { ...final, citations, confidence: confidenceScore(documents) };
}

module.exports = { askAI };
