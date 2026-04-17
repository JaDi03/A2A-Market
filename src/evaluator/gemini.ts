import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Executes a structured prompt using Gemini 2.0 Flash with retries.
 */
export async function callGemini(
  prompt: string, 
  details: { job: any, deliverable: any }, 
  retries = 3
): Promise<any> {
  const startTime = Date.now();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const finalPrompt = prompt
    .replace('{{job_details}}', JSON.stringify(details.job, null, 2))
    .replace('{{deliverable_details}}', JSON.stringify(details.deliverable, null, 2));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Gemini] Evaluation attempt ${attempt}/${retries}...`);
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      const text = response.text();
      const latency = Date.now() - startTime;
      
      const usage = (response as any).usageMetadata;
      
      // Sanitize response text (sometimes LLMs include markdown blocks)
      const sanitizedText = text.replace(/```json\n?/, '').replace(/```/, '').trim();
      
      try {
        const json = JSON.parse(sanitizedText);
        
        console.log(`[Gemini] Success. Latency: ${latency}ms`);
        if (usage) {
          console.log(`[Gemini] Tokens: ${usage.promptTokenCount} (in) | ${usage.candidatesTokenCount} (out) | Total: ${usage.totalTokenCount}`);
        }
        
        return json;
      } catch (parseErr) {
        console.warn(`[Gemini] JSON Parse failed on attempt ${attempt}:`, sanitizedText.substring(0, 100));
        if (attempt === retries) throw new Error('Max retries reached for JSON parsing');
      }
    } catch (err: any) {
      console.error(`[Gemini Error] Attempt ${attempt} failed:`, err.message || err);
      if (attempt === retries) throw err;
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
