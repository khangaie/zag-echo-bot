// ai/folderRouter.js
function resolveFolders(domain = 'general') {
  switch (domain) {
    case 'process':
      return ['PROCESS-AI'];

    case 'hse':
      return ['HSE-AI'];

    case 'hr':
      return ['HR-AI'];

    case 'contract':
      return ['CONTRACT-AI'];

    case 'project':
      // Төсөл нь ихэвчлэн PROCESS/CONTRACT-тай холилддог тул 2-ыг дагалдуулж болно
      return ['PROJECT-AI', 'PROCESS-AI', 'CONTRACT-AI'];

    default:
      return ['PROCESS-AI', 'HSE-AI', 'HR-AI', 'CONTRACT-AI', 'PROJECT-AI'];
  }
}

module.exports = { resolveFolders };
