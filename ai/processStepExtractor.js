function extractProcessSteps(text) {
  if (!text) return [];

  return text
    .split('\n')
    .filter(l =>
      l.match(/алхам|step|шат|үе/i)
    )
    .slice(0, 7);
}

module.exports = { extractProcessSteps };
