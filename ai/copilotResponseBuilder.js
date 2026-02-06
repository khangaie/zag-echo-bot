// ai/copilotResponseBuilder.js
const { extractProcessSteps } = require('./processStepExtractor');
const { buildMermaidFlow } = require('./bpmnBuilder');
const { buildCopilotAdaptiveCard } = require('./adaptiveCardBuilder');

/**
 * Input:
 *   { question, extractedTextMap, files, ocrUsed, ans }
 * Output:
 *   { adaptiveCard }
 */
function buildCopilotResponse({ question, extractedTextMap = {}, files = [], ocrUsed = false, ans }) {
  const text = Object.values(extractedTextMap || {}).join('\n');
  const fallbackSteps = extractProcessSteps(text);
  const steps = (ans && Array.isArray(ans.steps) && ans.steps.length) ? ans.steps : fallbackSteps;
  const diagram = buildMermaidFlow(steps);

  const citations = (ans && Array.isArray(ans.citations) && ans.citations.length)
    ? ans.citations
    : (files || []).map((d, i) => ({ index: i + 1, fileName: d.fileName || 'doc', url: d.url || '#' }));

  const adaptiveCard = buildCopilotAdaptiveCard({
    question,
    tldr: (ans && ans.tldr) ? ans.tldr : (text ? 'Баримтаас үндсэн мэдээлэл илрүүлэв.' : 'Мэдээлэл олдсонгүй'),
    steps,
    diagram,
    notes: (ans && ans.notes) ? ans.notes : '',
    files: citations,
    confidence: (ans && typeof ans.confidence === 'number') ? ans.confidence : (ocrUsed ? 92 : 98)
  });

  return { adaptiveCard };
}

module.exports = { buildCopilotResponse };
