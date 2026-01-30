function extractProcessSteps(text) {
 if (!text) return [];
 const lines = text
   .split('\n')
   .map(l => l.trim())
   .filter(l => l.length > 10);
 const stepLikeLines = lines.filter(l =>
   l.match(
     /^(\d+[\.\)]|\-|\•)\s+/i   // 1. 2) - •
     ||
     l.match(/процесс|батлах|шалгах|бүртгэх|зөвшөөрөх|хянах/i)
   )
 );
 return stepLikeLines.slice(0, 10);
}
module.exports = { extractProcessSteps };
