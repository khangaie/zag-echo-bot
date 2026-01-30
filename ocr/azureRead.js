const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");

const client = new DocumentAnalysisClient(
  process.env.AZURE_FORM_ENDPOINT,
  new AzureKeyCredential(process.env.AZURE_FORM_KEY)
);

async function extractTextFromPdf(buffer) {
  const poller = await client.beginAnalyzeDocument(
    "prebuilt-read",
    buffer
  );
  const result = await poller.pollUntilDone();

  let text = "";
  for (const page of result.pages) {
    for (const line of page.lines) {
      text += line.content + " ";
    }
  }
  return text;
}

module.exports = { extractTextFromPdf };
