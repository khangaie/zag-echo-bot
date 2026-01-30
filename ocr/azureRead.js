const { DocumentAnalysisClient, AzureKeyCredential } =
  require('@azure/ai-form-recognizer');

const client = new DocumentAnalysisClient(
  process.env.AZURE_FORM_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_FORM_KEY)
);

async function extractTextWithOCR(buffer) {
  const poller = await client.beginAnalyzeDocument(
    'prebuilt-read',
    buffer
  );

  const result = await poller.pollUntilDone();

  return result.content || '';
}

module.exports = { extractTextWithOCR };
