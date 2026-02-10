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

function looksLikeRealContractDoc(d) {
  const n = String(d?.fileName || '').toLowerCase();
  // real contract indicators
  if (n.includes('гэрээ') || n.includes('contract') || n.includes('agreement')) return true;
  // exclude process docs
  if (n.includes('процесс') || n.includes('process') || n.includes('п_гэрээ')) return false;
  return false;
}

async function askAI(question, documents = [], options = {}) {
  const needSteps = !!options.needSteps;
  const domain = String(options.domain || 'general');
  const company = String(options.company || '').toLowerCase();

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

  // ✅ CONTRACT guardrail: real contract doc байхгүй бол hallucination хийхгүй
  if (domain === 'contract') {
    const real = documents.filter(looksLikeRealContractDoc);
    if (real.length === 0) {
      return {
        tldr: company
          ? `${company.toUpperCase()} ХХК-тай байгуулсан бодит гэрээ (файл) олдсонгүй.`
          : 'Тухайн компанитай байгуулсан бодит гэрээ (файл) олдсонгүй.',
        keyPoints: [],
        facts: [],
        steps: [],
        followUps: [
          'Гэрээний яг файл нэр (эсвэл огноо/дугаар)-г бичиж асуух',
          'Тухайн гэрээ CONTRACT-AI фолдерт байршуулсан эсэхийг шалгах',
          'Компанийн нэрийн бичлэг (SMC/SCM гэх мэт)-ийг тодруулах'
        ],
        notes: 'Ерөнхий процесс/журамын баримтаар бодит гэрээний заалтыг дүгнэх боломжгүй.',
        citations: [],
        confidence: 0
      };
    }
    // real docs‑оор л ажиллуулна
    documents = real;
  }

  const contextText = documents
    .map(d => `Файл: ${d.fileName}\n---\n${String(d.content || '').trim()}`)
    .join('\n\n================\n\n');

  const contractTemplate = [
    'CONTRACT горим: facts дээр чухал заалтуудыг хүснэгтээр гарга.',
    'facts түлхүүрүүд (боломжтой бол бөглө, байхгүй бол "Тодорхойгүй"):',
    'Талууд',
    'Гэрээний төрөл/зорилго',
    'Ажлын хамрах хүрээ (Scope)',
    'Үнэ/Төлбөрийн нөхцөл',
    'Хугацаа/Гүйцэтгэлийн хугацаа',
    'Хүлээн авах/Акт/Баталгаажуулалт',
    'Чанарын баталгаа/Барьцаа',
    'Хариуцлага/Торгууль',
    'Нууцлал',
    'Гэрээ дуусгавар болгох нөхцөл',
    'Маргаан шийдвэрлэх журам',
    company ? `Компанийн нэр: ${company.toUpperCase()} (энэ компанитай холбоотойг онцол).` : ''
  ].filter(Boolean).join('\n');

  const system = [
    'Чи Microsoft Copilot шиг ТОВЧ, ЦЭГЦТЭЙ хариул.',
    'Зөвхөн өгөгдсөн баримтын текстэд тулгуурла.',
    'Баримтад байхгүй зүйлийг таамаглаж нэмэхийг ХОРИГЛОНО.',
    'Зөвхөн JSON объект буцаа (Markdown/кодын блок үгүй).',
    '',
    'JSON бүтэц:',
    '{"tldr":"...","keyPoints":[],"facts":[{"title":"","value":""}],"steps":[],"followUps":[],"notes":""}',
    '',
    needSteps ? 'steps: 3–6 алхам буцаа.' : 'steps: хэрэглэгч алхам/процесс асуугаагүй бол [] буцаа.',
    `Домэйн: ${domain}`,
    domain === 'contract' ? contractTemplate : '',
    'Монгол хэлээр бич.'
  ].join('\n');

  const user = [
    `Асуулт: ${question}`,
    '',
    'Баримтууд:',
    contextText,
    '',
    'JSON объект л буцаа.'
  ].join('\n');

  const raw = await callAzureOpenAI(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { responseFormat: 'json', temperature: 0.2, maxTokens: 900 }
  );

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { parsed = { tldr: String(raw || '').trim(), keyPoints: [], facts: [], steps: [], followUps: [], notes: '' }; }

  const tldr = String(parsed.tldr || '').trim();
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints.map(x => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : [];

  const facts = Array.isArray(parsed.facts)
    ? parsed.facts
        .map(f => ({ title: String(f?.title || '').trim(), value: String(f?.value || '').trim() }))
        .filter(f => f.title && f.value)
        .slice(0, 14)
    : [];

  let steps = Array.isArray(parsed.steps)
    ? parsed.steps.map(s => String(s || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  if (!needSteps) steps = [];

  const followUps = Array.isArray(parsed.followUps)
    ? parsed.followUps.map(s => String(s || '').trim()).filter(Boolean).slice(0, 6)
    : [];

  const notes = String(parsed.notes || '').trim();
  const citations = normalizeCitations(documents);

  return {
    tldr: tldr || 'Хариу бэлдэхэд хангалттай мэдээлэл олдсонгүй.',
    keyPoints,
    facts,
    steps,
    followUps,
    notes,
    citations,
    confidence: confidenceScore(documents)
  };
}

module.exports = { askAI };
