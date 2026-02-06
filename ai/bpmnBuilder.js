// ai/bpmnBuilder.js
function buildMermaidFlow(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) return '';
  const lines = ['flowchart TD', '  A([Start])'];
  const ids = ['A'];
  steps.forEach((s, i) => {
    const id = String.fromCharCode(66 + i); // B, C, D...
    ids.push(id);
    lines.push(`  ${id}("${String(s).replace(/"/g, '\\"')}")`);
  });
  for (let i = 0; i < ids.length - 1; i++) {
    lines.push(`  ${ids[i]} --> ${ids[i + 1]}`);
  }
  lines.push(`  ${ids[ids.length - 1]} --> Z([End])`);
  return lines.join('\n');
}
module.exports = { buildMermaidFlow };
