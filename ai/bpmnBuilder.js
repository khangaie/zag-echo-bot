// ai/bpmnBuilder.js
function sanitizeLabel(s, max = 60) {
  if (!s) return '';
  return String(s)
    .replace(/["`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function buildMermaidFlow(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) return '';
  const ids = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const nodes = steps.slice(0, 12).map((t, i) => {
    const id = ids[i] || `N${i}`;
    const label = sanitizeLabel(t);
    return `${id}["${label}"]`;
  });

  const edges = steps.slice(0, 12).map((_, i) => {
    const a = ids[i] || `N${i}`;
    const b = ids[i + 1] || null;
    return b ? `${a} --> ${b}` : null;
  }).filter(Boolean);

  return ['graph TD', ...nodes, ...edges].join('\n');
}

module.exports = { buildMermaidFlow };
