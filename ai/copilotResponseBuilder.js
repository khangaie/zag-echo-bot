// ai/copilotResponseBuilder.js
const { extractProcessSteps } = require('./processStepExtractor');
const { buildCopilotAdaptiveCard } = require('./adaptiveCardBuilder');

function uniq(arr) { return Array.from(new Set(arr)); }
function cleanSteps(steps = []) {
  return uniq(
    steps.map(s => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
  ).slice(0, 10);
}

function makeCitations({ ans, files = [] } = {}) {
  let fromAns = [];
  if (ans && Array.isArray(ans.citations)) {
    fromAns = ans.citations
      .map((c) => {
        if (!c) return null;
        if (typeof c === 'string') return { title: undefined, webUrl: c };
        const webUrl = c.webUrl || c.url || c.link;
        const title = c.title || c.name || c.fileName;
        return webUrl ? { title, webUrl } : null;
      })
      .filter(Boolean);
  }

  const fromFiles = (Array.isArray(files) ? files : [])
    .map((d) => {
      const webUrl = d.webUrl || d.url;
      const title = d.name || d.title || d.fileName || 'Source';
      return webUrl ? { title, webUrl } : null;
    })
    .filter(Boolean);

  const merged = [...fromAns, ...fromFiles];
  const seen = new Set();
  const deduped = [];
  for (const c of merged) {
    if (!seen.has(c.webUrl)) {
      deduped.push(c);
      seen.add(c.webUrl);
    }
  }
  return deduped.slice(0, 5);
}

function buildCopilotResponse({
  question,
  extractedTextMap = {},
  files = [],
  ocrUsed = false,
  ans,
  needSteps = false,
  domain = 'general',
  folders = []
}) {
  const text = Object.values(extractedTextMap || {}).join('\n');

  // steps зөвхөн хэрэгтэй үед
  let steps = [];
  if (needSteps) {
    const fallbackSteps = extractProcessSteps(text);
    const fromAns = (ans && Array.isArray(ans.steps) && ans.steps.length) ? ans.steps : fallbackSteps;
    steps = cleanSteps(fromAns);
  }

  const citations = makeCitations({ ans, files });

  const adaptiveCard = buildCopilotAdaptiveCard({
    question,
    domain,
    folders,
    summary: (ans && ans.tldr) ? ans.tldr : (text ? 'Баримтаас үндсэн мэдээлэл илрүүлэв.' : 'Мэдээлэл олдсонгүй'),
    keyPoints: (ans && Array.isArray(ans.keyPoints)) ? ans.keyPoints : [],
    facts: (ans && Array.isArray(ans.facts)) ? ans.facts : [],
    steps,
    followUps: (ans && Array.isArray(ans.followUps)) ? ans.followUps : [],
    citations,
    notes: (ans && ans.notes) ? ans.notes : '',
    confidence: (ans && typeof ans.confidence === 'number') ? ans.confidence : (ocrUsed ? 92 : 98)
  });

  return { adaptiveCard };
}

module.exports = { buildCopilotResponse };
