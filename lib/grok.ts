const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

/** Suggests a likely diagnosis checklist for a repair tech from the customer's own words — an assist, not a dependency, so callers should treat failures as non-fatal. */
export async function suggestRepairDiagnosis(reportedIssue: string): Promise<string> {
  const prompt = `You are assisting a mobile phone repair technician. A customer reported this issue with their device:

"${reportedIssue}"

In 3-5 short bullet points, list the most likely causes and what the technician should check first. Be concrete and specific to phone repair (e.g. battery, charging port, digitizer, logic board). Do not include a preamble or disclaimer — output only the bullet points.`;

  const res = await fetch(XAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: "grok-4-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`xAI request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("xAI response had no content");
  return text.trim();
}
