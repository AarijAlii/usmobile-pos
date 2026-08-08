import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { suggestRepairDiagnosis } from "@/lib/groq";

export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success } = await checkRateLimit(`ai:${staff.id}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded, try again shortly." }, { status: 429 });
  }

  const { reportedIssue } = await request.json();
  if (!reportedIssue || typeof reportedIssue !== "string") {
    return NextResponse.json({ error: "reportedIssue is required" }, { status: 400 });
  }

  try {
    const suggestion = await suggestRepairDiagnosis(reportedIssue);
    return NextResponse.json({ suggestion });
  } catch (err) {
    // This is an assist, not a dependency — never let an AI provider outage block ticket
    // work, but still log server-side so a real outage/misconfiguration is diagnosable.
    console.error("AI diagnosis suggestion failed:", err);
    return NextResponse.json(
      { error: "AI suggestion is temporarily unavailable." },
      { status: 502 },
    );
  }
}
