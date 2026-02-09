// ai/adaptiveCardBuilder.js
function truncate(text = '', max = 60) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

/**
 * Copilot хариултыг Adaptive Card хэлбэрээр буцаана.
 * @param {Object} p
 * @param {string} p.question - Хэрэглэгчийн асуулт
 * @param {string} p.summary  - Гол хариулт/тайлбар
 * @param {string[]} p.steps  - Дугаарласан алхмууд
 * @param {string} [p.bpmn]   - Mermaid BPMN/Flow текст (заавал биш)
 * @param {Array<{title?:string, webUrl:string}>} [p.citations] - Эх сурвалжууд
 * @param {number} [p.confidence] - Итгэлцлийн хувь (optional)
 * @param {string} [p.notes] - Нэмэлт тэмдэглэл
 */
function buildCopilotAdaptiveCard({
  question,
  summary = '',
  steps = [],
  bpmn,
  citations = [],
  confidence,
  notes = ''
}) {
  const body = [
    { type: 'TextBlock', text: '🧠 Copilot Answer', weight: 'Bolder', size: 'Large' },
    { type: 'TextBlock', text: `❓ Асуулт: ${question}`, wrap: true },
    summary && { type: 'TextBlock', text: summary, wrap: true },

    // Алхмууд (тоотой мөрүүд)
    Array.isArray(steps) && steps.length > 0 && { type: 'TextBlock', text: '🔁 Процессын алхмууд', weight: 'Bolder' },
    ...(Array.isArray(steps) ? steps.map((s, i) => ({
      type: 'TextBlock',
      text: `${i + 1}. ${s}`,
      wrap: true
    })) : []),

    // BPMN / Flow (цагаан фонтоор моноспэйс)
    bpmn && { type: 'TextBlock', text: '📘 BPMN', weight: 'Bolder' },
    bpmn && { type: 'TextBlock', text: bpmn, fontType: 'Monospace', wrap: true },

    // Тэмдэглэл
    notes && { type: 'TextBlock', text: notes, wrap: true, isSubtle: true }
  ].filter(Boolean);

  // Эх сурвалжийн товчлуурууд
  const links = Array.isArray(citations)
    ? citations.filter(c => c && c.webUrl).slice(0, 5)
    : [];

  if (links.length) {
    body.push({ type: 'TextBlock', text: '🔗 Эх сурвалж', weight: 'Bolder' });
    body.push({
      type: 'ActionSet',
      actions: links.map((c, i) => ({
        type: 'Action.OpenUrl',
        title: `${i + 1}. ${truncate(c.title || c.name || 'Source')}`,
        url: c.webUrl
      }))
    });
  }

  // Итгэлцэл
  if (typeof confidence === 'number') {
    body.push({ type: 'TextBlock', text: `📊 Confidence: ${confidence}%`, isSubtle: true });
  }

  return {
    type: 'AdaptiveCard',
    version: '1.5',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body
  };
}

module.exports = { buildCopilotAdaptiveCard };
