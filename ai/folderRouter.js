// ai/folderRouter.js
function resolveFolders(domain = 'general', question = '', hasSMC = false) {
  const q = String(question || '').toLowerCase();
  const hasContractWord = /(гэрээ|contract|заалт|нөхцөл)/i.test(q);

  switch (domain) {
    case 'process':
      return hasContractWord ? ['PROCESS-AI', 'CONTRACT-AI'] : ['PROCESS-AI'];

    case 'contract':
      return hasSMC ? ['CONTRACT-AI', 'PROJECT-AI'] : ['CONTRACT-AI'];

    case 'project':
      return hasSMC ? ['PROJECT-AI', 'CONTRACT-AI'] : ['PROJECT-AI', 'PROCESS-AI'];

    case 'hse':
      return ['HSE-AI'];

    case 'hr':
      return ['HR-AI'];

    default:
      return ['PROCESS-AI', 'HSE-AI', 'HR-AI', 'CONTRACT-AI', 'PROJECT-AI'];
  }
}

module.exports = { resolveFolders };
