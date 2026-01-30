function resolveFolders(intent) {
 switch (intent) {
   case 'process':
     return ['PROCESS-AI'];
   case 'policy':
     return ['HSE-AI', 'HR-AI'];
   case 'contract':
     return ['CONTRACT-AI'];
   default:
     return ['PROCESS-AI', 'HSE-AI', 'HR-AI', 'CONTRACT-AI'];
 }
}
module.exports = { resolveFolders };
