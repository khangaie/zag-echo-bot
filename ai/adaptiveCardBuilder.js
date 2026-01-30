function buildCopilotAdaptiveCard({
  question,
  summary,
  steps,
  bpmn,
  files,
  confidence
}) {
  return {
    type: 'AdaptiveCard',
    version: '1.5',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body: [
      { type: 'TextBlock', text: '🤖 Copilot Answer', weight: 'Bolder', size: 'Large' },
      { type: 'TextBlock', text: `**Асуулт:** ${question}`, wrap: true },
      { type: 'TextBlock', text: '🧠 Summary', weight: 'Bolder', spacing: 'Medium' },
      { type: 'TextBlock', text: summary, wrap: true },
      { type: 'TextBlock', text: '🧩 Процессийн алхмууд', weight: 'Bolder', spacing: 'Medium' },
      {
        type: 'FactSet',
        facts: steps.map((s, i) => ({
          title: `Алхам ${i + 1}`,
          value: s
        }))
      },
      { type: 'TextBlock', text: '📊 BPMN', weight: 'Bolder', spacing: 'Medium' },
      { type: 'TextBlock', text: bpmn, wrap: true, fontType: 'Monospace' },
      { type: 'TextBlock', text: '📎 Баримтууд', weight: 'Bolder', spacing: 'Medium' },
      ...files.map(f => ({
        type: 'TextBlock',
        text: `🔗 [${f.fileName}](${f.url})`,
        wrap: true
      })),
      {
        type: 'TextBlock',
        text: `📊 Confidence: ${confidence}%`,
        spacing: 'Medium',
        isSubtle: true
      }
    ]
  };
}

module.exports = { buildCopilotAdaptiveCard };
