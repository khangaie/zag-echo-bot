const { extractProcessSteps } = require('./processStepExtractor');
const { buildBPMN } = require('./bpmnBuilder');
const { buildCopilotAdaptiveCard } = require('./adaptiveCardBuilder');

function buildCopilotResponse(data) {
  const text = Object.values(data.extractedTextMap).join('\n');
  const steps = extractProcessSteps(text);
  const bpmn = buildBPMN(data.question, steps);

  const summary =
    steps.length
      ? `${steps.length} үндсэн процесс илэрлээ.`
      : 'Процессийн мэдээлэл олдсонгүй.';

  return {
    adaptiveCard: buildCopilotAdaptiveCard({
      question: data.question,
      summary,
      steps,
      bpmn,
      files: data.files,
      confidence: data.ocrUsed ? 92 : 98
    })
  };
}

module.exports = { buildCopilotResponse };

