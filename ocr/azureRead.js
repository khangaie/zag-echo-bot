const axios = require('axios');
async function extractTextWithOCR(buffer) {
 const endpoint = process.env.VISION_ENDPOINT;
 const key = process.env.VISION_KEY;
 const res = await axios.post(
   `${endpoint}/vision/v3.2/read/analyze`,
   buffer,
   {
     headers: {
       'Ocp-Apim-Subscription-Key': key,
       'Content-Type': 'application/pdf'
     }
   }
 );
 const operationUrl = res.headers['operation-location'];
 for (let i = 0; i < 10; i++) {
   await new Promise(r => setTimeout(r, 1500));
   const poll = await axios.get(operationUrl, {
     headers: { 'Ocp-Apim-Subscription-Key': key }
   });
   if (poll.data.status === 'succeeded') {
     return poll.data.analyzeResult.readResults
       .flatMap(p => p.lines.map(l => l.text))
       .join('\n');
   }
 }
 return '';
}
module.exports = { extractTextWithOCR };
