function buildBPMN(title, steps) {
  if (!steps.length) return 'BPMN олдсонгүй';

  let diagram = `[Start] → `;
  diagram += steps.join(' → ');
  diagram += ' → [End]';

  return diagram;
}

module.exports = { buildBPMN };
