import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

/** Suggests a likely diagnosis checklist for a repair tech from the customer's own words — an assist, not a dependency, so callers should treat failures as non-fatal. */
export async function suggestRepairDiagnosis(reportedIssue: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are assisting a mobile phone repair technician. A customer reported this issue with their device:

"${reportedIssue}"

In 3-5 short bullet points, list the most likely causes and what the technician should check first. Be concrete and specific to phone repair (e.g. battery, charging port, digitizer, logic board). Do not include a preamble or disclaimer — output only the bullet points.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
