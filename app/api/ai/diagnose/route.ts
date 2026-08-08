import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { suggestRepairDiagnosis } from "@/lib/grok";

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
  } catch {
    // This is an assist, not a dependency — never let an AI provider outage block ticket work.
    return NextResponse.json(
      { error: "AI suggestion is temporarily unavailable." },
      { status: 502 },
    );
  }
}
