// ai/copilotResponseBuilder.js
const { extractProcessSteps } = require('./processStepExtractor');
const { buildMermaidFlow } = require('./bpmnBuilder');
const { buildCopilotAdaptiveCard } = require('./adaptiveCardBuilder');

// ---- helpers ---------------------------------------------------------------
function uniq(arr) {
  return Array.from(new Set(arr));
}
function cleanSteps(steps = []) {
  return uniq(
    steps
      .map(s => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean)
  ).slice(0, 10);
}
function makeCitations({ ans, files = [] } = {}) {
  // 1) ans.citations [{title, webUrl}] | [{name, webUrl}] | [string-url]
  let fromAns = [];
  if (ans && Array.isArray(ans.citations)) {
    fromAns = ans.citations
      .map((c) => {
        if (!c) return null;
        if (typeof c === 'string') return { title: undefined, webUrl: c };
        // allow {url} | {webUrl} | {link}
        const webUrl = c.webUrl || c.url || c.link;
        const title = c.title || c.name || c.fileName;
        return webUrl ? { title, webUrl } : null;
      })
      .filter(Boolean);
  }

  // 2) files from search (SharePoint/AI Search normalisation)
  const fromFiles = (Array.isArray(files) ? files : []).map((d) => {
    const webUrl = d.webUrl || d.url;
    const title = d.name || d.title || d.fileName || 'Source';
    return webUrl ? { title, webUrl } : null;
  }).filter(Boolean);

  // merge & cap
  const merged = [...fromAns, ...fromFiles];
  const seen = new Set();
  const deduped = [];
  for (const c of merged) {
    const key = c.webUrl;
    if (!seen.has(key)) {
      deduped.push(c);
      seen.add(key);
    }
  }
  return deduped.slice(0, 5);
}
// ---------------------------------------------------------------------------

/**
 * Input:
 *   { question, extractedTextMap, files, ocrUsed, ans }
 * Output:
 *   { adaptiveCard }
 */
function buildCopilotResponse({ question, extractedTextMap = {}, files = [], ocrUsed = false, ans }) {
  const text = Object.values(extractedTextMap || {}).join('\n');
  const fallbackSteps = extractProcessSteps(text);
  const steps = cleanSteps((ans && Array.isArray(ans.steps) && ans.steps.length) ? ans.steps : fallbackSteps);

  // Diagram (optional)
  let bpmn;
  try {
    bpmn = steps && steps.length ? buildMermaidFlow(steps) : undefined;
  } catch {
    bpmn = undefined; // bpmn module байхгүй/алдаатай бол карт унанаас сэргийлнэ
  }

  const citations = makeCitations({ ans, files });

  const adaptiveCard = buildCopilotAdaptiveCard({
    question,
    summary: (ans && ans.tldr) ? ans.tldr
      : (text ? 'Баримтаас үндсэн мэдээлэл илрүүлэв.' : 'Мэдээлэл олдсонгүй'),
    steps,
    bpmn,
    citations,
    notes: (ans && ans.notes) ? ans.notes : '',
    confidence: (ans && typeof ans.confidence === 'number') ? ans.confidence : (ocrUsed ? 92 : 98)
  });

  return { adaptiveCard };
}

module.exports = { buildCopilotResponse };
