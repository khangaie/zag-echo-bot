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
   body: [
     { type: 'TextBlock', text: '🧠 Copilot Answer', weight: 'Bolder', size: 'Large' },
     { type: 'TextBlock', text: `❓ Асуулт: ${question}`, wrap: true },
     { type: 'TextBlock', text: summary, wrap: true },
     steps.length && {
       type: 'TextBlock',
       text: '🔁 Процессийн алхмууд',
       weight: 'Bolder'
     },
     ...steps.map((s, i) => ({
       type: 'TextBlock',
       text: `${i + 1}. ${s}`,
       wrap: true
     })),
     bpmn && {
       type: 'TextBlock',
       text: '📐 BPMN',
       weight: 'Bolder'
     },
     bpmn && {
       type: 'TextBlock',
       text: bpmn,
       fontType: 'Monospace',
       wrap: true
     },
     {
       type: 'TextBlock',
       text: `📊 Confidence: ${confidence}%`,
       isSubtle: true
     }
   ].filter(Boolean)
 };
}
module.exports = { buildCopilotAdaptiveCard };
