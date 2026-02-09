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
 * Баримт-сууурьтай бүтэцтэй хариулт буцаана:
 * { tldr, steps[], notes, citations[], confidence }
 */
async function askAI(question, documents = []) {
  if (!Array.isArray(documents)) documents = [];
  // Хоосон бол шууд найрсаг тайлбар буцаана
  if (documents.length === 0) {
    return {
      tldr: 'Энэ асуултад хариулах баримт олдсонгүй.',
      steps: [],
      notes: 'Илүү тодорхой түлхүүр үг, баримтын нэр/сэдвээ бичээд дахин оролдоно уу.',
      citations: [],
      confidence: 0
    };
  }

  // CONTEXT: зөвхөн бидний өгсөн баримтын контент
  // (orchestrator.js аль хэдийн хамгийн хамааралтай “фокус” хэсгийг п蓄алж өгдөг)
  const contextText = documents
    .map(d => `Файл: ${d.fileName}\n---\n${(d.content || '').trim()}`)
    .join('\n\n================\n\n');

  // Баримтаас гадуурх мэдлэг ашиглахыг хатуу хориглох систем заавар
  const system = [
    'Чи дан зөвхөн өгөгдсөн баримтуудын текстэд тулгуурлан хариулна.',
    'Барьцаагүй (баримтад байхгүй) зүйл нэмэхийг ХОРИГЛОНО.',
    'JSON объект л буцаа. Ямар ч тайлбар, кодын блок, Markdown бүү нэм.',
    'JSON бүтэц: {"tldr":"...", "steps":["..."], "notes":""}',
    'tldr — 1-2 өгүүлбэр, асуултад оновчтой, баримтад тулгуурласан байх.',
    'steps — 3–8 алхам; тус бүрийг богино, үйл үгнээс эхэлсэн (императив) хэвээр бич.',
    'notes — шаардлагатай бол болгоомжлол, нөхцөл, тодруулга (баримтын ишлэлтэй).',
    'Хэрэв баримтаас хангалттай нотолгоо байхгүй бол "tldr" дээр үгүй гэж хэл; "notes"-д юуг дутуу байгааг тодорхой бич.',
    'Хариуг Монгол хэлээр бич.'
  ].join(' ');

  // Хэрэглэгчийн мөр — асуулт + баримтын “фокус” текст
  const user = [
    `Асуулт: ${question}`,
    '',
    'Баримтууд (зөвхөн эдгээр текстэд тулгуурлан дүгнэ):',
    contextText,
    '',
    'Заавал дараах JSON объект л буцаа.'
  ].join('\n');

  // Azure OpenAI дуудлага (json горим)
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  // ⚠️ Таны aiClient дотор responseFormat: 'json' дэмждэг тул хэвээр үлдээв.
  // Боломжтой бол temperature-ийг бага байлгах нь (grounding) тус болдог.
  const raw = await callAzureOpenAI(messages, {
    responseFormat: 'json',
    temperature: 0.2,
    maxTokens: 900
  });

  // Найдвартай parse
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { tldr: String(raw || '').trim(), steps: [], notes: '' };
  }

  // Цэвэрлэгээ, хамгаалалт
  const tldr = String(parsed.tldr || '').trim();
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .map(s => String(s || '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const notes = String(parsed.notes || '').trim();

  // Баримтын ишлэлийг бид өөрсдөө нэмнэ (LLM-д найдахгүй)
  const citations = normalizeCitations(documents);

  // Хэрэв тldr хоосон ба алхам алга бол — баримт хүрэлцээгүйд тооцож, эелдгээр буцаана
  const hasAnswer = tldr.length > 0 || steps.length > 0;
  const final = hasAnswer
    ? { tldr, steps, notes }
    : {
        tldr: 'Энэ асуултад баримтаас шууд нотлогдох хариулт олдсонгүй.',
        steps: [],
        notes:
          'Баримтаас илэрсэн хэсгүүд хангалтгүй байна. Баримтын нэр/хэдэн үг ' +
          'эсвэл фолдерын байршлаа тодруулж өгнө үү.'
      };

  return {
    ...final,
    citations,
    confidence: confidenceScore(documents)
  };
}

module.exports = { askAI };
