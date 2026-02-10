// ai/adaptiveCardBuilder.js

function truncate(text = '', max = 70) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function domainLabel(domain = 'general') {
  const d = String(domain || 'general').toLowerCase();
  if (d === 'hr') return 'HR';
  if (d === 'hse') return 'HSE';
  if (d === 'contract') return 'CONTRACT';
  if (d === 'process') return 'PROCESS';
  if (d === 'project') return 'PROJECT';
  return 'GENERAL';
}

function buildCopilotAdaptiveCard({
  question,
  domain = 'general',
  folders = [],
  summary = '',
  keyPoints = [],
  facts = [],
  steps = [],
  followUps = [],
  citations = [],
  confidence,
  notes = ''
}) {
  const body = [];

  // ===== Header + Domain badge =====
  body.push({
    type: 'ColumnSet',
    columns: [
      {
        type: 'Column',
        width: 'stretch',
        items: [
          { type: 'TextBlock', text: '🧠 Copilot хариулт', weight: 'Bolder', size: 'Large' },
          { type: 'TextBlock', text: `❓ ${question}`, wrap: true, isSubtle: true }
        ]
      },
      {
        type: 'Column',
        width: 'auto',
        items: [
          {
            type: 'Container',
            style: 'accent',
            items: [
              { type: 'TextBlock', text: `🏷️ ${domainLabel(domain)}`, weight: 'Bolder', wrap: true, spacing: 'None' },
              Array.isArray(folders) && folders.length
                ? { type: 'TextBlock', text: `📁 ${folders.join(', ')}`, wrap: true, isSubtle: true, spacing: 'None', size: 'Small' }
                : null
            ].filter(Boolean)
          }
        ]
      }
    ]
  });

  // ===== TL;DR =====
  if (summary) {
    body.push({
      type: 'Container',
      style: 'emphasis',
      spacing: 'Medium',
      items: [
        { type: 'TextBlock', text: '✅ Гол хариу', weight: 'Bolder' },
        { type: 'TextBlock', text: summary, wrap: true }
      ]
    });
  }

  // ===== Key points (yellow highlight) =====
  const kp = Array.isArray(keyPoints) ? keyPoints.filter(Boolean).slice(0, 6) : [];
  if (kp.length) {
    body.push({
      type: 'Container',
      style: 'attention', // ✅ шар/анхаарал татах style [6](https://adaptivecards.microsoft.com/?topic=Container)[7](https://learn.microsoft.com/en-us/adaptive-cards/schema-explorer/container)
      spacing: 'Medium',
      items: [
        { type: 'TextBlock', text: '🔍 Key points', weight: 'Bolder' },
        ...kp.map(p => ({ type: 'TextBlock', text: `• ${p}`, wrap: true }))
      ]
    });
  }

  // ===== Table (FactSet) =====
  const fx = Array.isArray(facts)
    ? facts
        .map(f => ({ title: String(f?.title || '').trim(), value: String(f?.value || '').trim() }))
        .filter(f => f.title && f.value)
        .slice(0, 10)
    : [];

  if (fx.length) {
    body.push({ type: 'TextBlock', text: '📌 Нөхцөл / Утга', weight: 'Bolder', spacing: 'Medium' });
    body.push({
      type: 'FactSet',      // ✅ key/value table [8](https://learn.microsoft.com/en-us/adaptive-cards/schema-explorer/fact-set)
      facts: fx
    });
  }

  // ===== Steps (only when present) =====
  if (Array.isArray(steps) && steps.length > 0) {
    body.push({ type: 'TextBlock', text: '🪜 Алхамууд', weight: 'Bolder', spacing: 'Medium' });
    steps.slice(0, 10).forEach((s, i) => {
      body.push({ type: 'TextBlock', text: `${i + 1}. ${s}`, wrap: true });
    });
  }

  // ===== Notes / warnings =====
  if (notes) {
    body.push({
      type: 'Container',
      style: 'warning',
      spacing: 'Medium',
      items: [
        { type: 'TextBlock', text: '⚠️ Анхаарах зүйл', weight: 'Bolder' },
        { type: 'TextBlock', text: notes, wrap: true }
      ]
    });
  }

  // ===== Follow-up suggestions (bullets + buttons) =====
  const fu = Array.isArray(followUps) ? followUps.filter(Boolean).slice(0, 4) : [];
  if (fu.length) {
    body.push({ type: 'TextBlock', text: '🧠 Та бас ингэж асууж болно', weight: 'Bolder', spacing: 'Medium' });

    // bullets
    fu.forEach(s => body.push({ type: 'TextBlock', text: `• ${s}`, wrap: true, isSubtle: true }));

    // buttons (Teams messageBack)
    body.push({
      type: 'ActionSet',
      actions: fu.map((s) => ({
        type: 'Action.Submit',
        title: truncate(s, 32),
        data: {
          // ✅ Teams messageBack — button дархад bot руу текст буцаана [9](https://learn.microsoft.com/en-us/microsoftteams/platform/task-modules-and-cards/cards/cards-actions)
          msteams: {
            type: 'messageBack',
            text: s,
            displayText: s
          }
        }
      }))
    });
  }

  // ===== Sources =====
  const links = Array.isArray(citations)
    ? citations.filter(c => c && c.webUrl).slice(0, 5)
    : [];

  if (links.length) {
    body.push({ type: 'TextBlock', text: '🔗 Эх сурвалж', weight: 'Bolder', spacing: 'Medium' });
    body.push({
      type: 'ActionSet',
      actions: links.map((c, i) => ({
        type: 'Action.OpenUrl',
        title: `${i + 1}. ${truncate(c.title || 'Source')}`,
        url: c.webUrl
      }))
    });
  }

  // ===== Confidence =====
  if (typeof confidence === 'number') {
    body.push({ type: 'TextBlock', text: `📊 Итгэлцэл: ${confidence}%`, isSubtle: true, spacing: 'Medium' });
  }

  return {
    type: 'AdaptiveCard',
    version: '1.5',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body
  };
}

module.exports = { buildCopilotAdaptiveCard };
