// graph/askAI.js
const { callAzureOpenAI } = require('./aiClient');

function confidenceScore(docs) {
  if (!docs || docs.length === 0) return 0;
  if (docs.length === 1) return 60;
  if (docs.length === 2) return 75;
  return 90;
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
      notes: 'Илүү тодорхой түлхүүр үг өгөөд дахин оролдоно уу.',
      citations: [],
      confidence: 0
    };
  }

  const citations = documents.map((d, i) => ({
    index: i + 1,
    fileName: d.fileName || 'document',
    url: d.url || '#'
  }));

  const contextText = documents
    .map(d => `Файл: ${d.fileName}\n${d.content || ''}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content:
        'Та зөвхөн өгөгдсөн SharePoint баримтад тулгуурлан хариулна. ' +
        'JSON бүтэцтэйгээр буцаа: {"tldr":"...","steps":["..."],"notes":"..."}. ' +
        'Хэрэв хангалттай баримт байхгүй бол эргэлзээгээ "notes" талбарт бич.'
    },
    {
      role: 'user',
      content:
        `Асуулт: ${question}\n\n` +
        `Баримтууд:\n${contextText}\n\n` +
        `Дээрх JSON форматтайгаар буцаа.`
    }
  ];

  const raw = await callAzureOpenAI(messages, { responseFormat: 'json' });
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = { tldr: raw, steps: [], notes: '' }; }

  const tldr = String(parsed.tldr || '').trim();
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.map(s => String(s).trim()).filter(Boolean).slice(0, 10)
    : [];
  const notes = String(parsed.notes || '').trim();

  return { tldr, steps, notes, citations, confidence: confidenceScore(documents) };
}

module.exports = { askAI };
