function extractProcessSteps(text) {
  if (!text) return [];

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const steps = [];

  for (let l of lines) {
    const line = l.trim();

    // ----- 1) Тоон дугаарлалт -----
    // 1. ..., 1) ..., 1‑..., 1.1 ..., 2.3.4 ...
    if (/^\d+([.)\-]|(\.\d+)+)/.test(line)) {
      steps.push(clean(line));
      continue;
    }

    // ----- 2) Буллет -----
    if (/^[-•∙*]/.test(line)) {
      steps.push(clean(line.replace(/^[-•∙*]\s*/, '')));
      continue;
    }

    // ----- 3) Монгол үйл үгнээс эхэлсэн өгүүлбэр -----
    // эхлэх, боловсруулах, батлах, хөтлөх, гүйцэтгэх, шалгах, бүртгэх, илгээх …
    if (/^(хэрэгжүүлэх|слэх|боловсруулах|батлах|хөтлөх|шалгах|бүртгэх|илгээх|ундах|хийх|төлөвлөх)/i.test(line)) {
      steps.push(clean(line));
      continue;
    }

    // ----- 4) "алхам", "процесс", "шат" зэргийг агуулсан өгүүлбэр -----
    if (/(алхам|процесс|шат)/i.test(line)) {
      steps.push(clean(line));
      continue;
    }
  }

  // давхардал арилгана
  const uniq = Array.from(new Set(steps));

  // хэт урт мөрийг товчилно (Mermaid бага мөртэй байхад илүү гоё харагддаг)
  return uniq.map(s => s.length > 140 ? s.slice(0, 140) + '…' : s).slice(0, 10);
}

// туслах цэвэрлэгч
function clean(s) {
  return s
    .replace(/^[-•∙*]\s*/, '')
    .replace(/^\d+([.)\-]|(\.\d+)+)\s*/, '')
    .trim();
}

module.exports = { extractProcessSteps };
