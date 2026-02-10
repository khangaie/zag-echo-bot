// ai/intentDetector.js
function safeLower(x) {
  return String(x ?? '').toLowerCase();
}

function hasAny(q, arr) {
  for (const w of arr) {
    if (!w) continue;
    if (q.includes(w)) return true;
  }
  return false;
}

/**
 * Returns:
 * { domain: 'process'|'contract'|'hr'|'hse'|'project'|'general',
 *   needSteps: boolean,
 *   isContract: boolean,
 *   isProject: boolean }
 */
function detectIntent(question = '') {
  const q = safeLower(question);

  // хэрэглэгч алхам/процесс хүссэн эсэх (explicit)
  const needSteps = hasAny(q, [
    'алхам', 'урсгал', 'процесс', 'workflow', 'bpmn', 'flowchart', 'diagram', 'process'
  ]);

  // домэйн түлхүүрүүд
  const isContract = hasAny(q, [
    'гэрээ', 'contract', 'заалт', 'нөхцөл', 'торгууль', 'хугацаа', 'үнэ', 'appendix', 'нэмэлт'
  ]);

  const isHSE = hasAny(q, [
    'hse', 'osha', 'аюулгүй', 'эрсдэл', 'осол', 'ppe', 'permit', 'standard', 'стандарт', 'журам', 'заавар'
  ]);

  const isHR = hasAny(q, [
    'hr', 'ажилтан', 'цалин', 'чөлөө', 'амралт', 'ажлын цаг', 'албан тушаал', 'томилгоо', 'сонгон'
  ]);

  const isProject = hasAny(q, [
    'project', 'төсөл', 'smc', 'oyutolgoi', 'ot', 'scope', 'schedule', 'timeline', 'wbs'
  ]);

  // ✅ чухал: "процесс/алхам" орсон бол заавал process домэйнд route
  let domain = 'general';
  if (needSteps) domain = 'process';
  else if (isContract) domain = 'contract';
  else if (isHSE) domain = 'hse';
  else if (isHR) domain = 'hr';
  else if (isProject) domain = 'project';

  return { domain, needSteps, isContract, isProject };
}

module.exports = { detectIntent };
