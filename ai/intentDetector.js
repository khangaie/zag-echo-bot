// ai/intentDetector.js
function safeLower(x) { return String(x ?? '').toLowerCase(); }
function hasAny(q, arr) { return arr.some(w => w && q.includes(w)); }

function detectIntent(question = '') {
  const q = safeLower(question);

  const needSteps = hasAny(q, [
    'алхам', 'урсгал', 'процесс', 'workflow', 'bpmn', 'flowchart', 'diagram', 'process'
  ]);

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

  const hasSMC = hasAny(q, ['smc']);

  // ✅ Алхам/процесс гэж орвол заавал process
  let domain = 'general';
  if (needSteps) domain = 'process';
  else if (isContract) domain = 'contract';
  else if (isHSE) domain = 'hse';
  else if (isHR) domain = 'hr';
  else if (isProject) domain = 'project';

  return { domain, needSteps, isContract, isProject, hasSMC };
}

module.exports = { detectIntent };
