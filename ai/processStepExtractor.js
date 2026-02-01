function extractProcessSteps(text) {
 if (!text) return [];
 return text
   .split('\n')
   .map(l => l.trim())
   .filter(l =>
     l.match(/^\d+[\.\)]/) ||
     l.match(/алхам|шат|процесс/i)
   )
   .slice(0, 10);
}
module.exports = { extractProcessSteps };
