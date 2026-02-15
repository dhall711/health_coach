import { NextRequest, NextResponse } from "next/server";
import { anthropic, HEALTH_SYSTEM_PROMPT } from "@/lib/claude";
import { query as dbQuery } from "@/lib/neon";

export async function POST(req: NextRequest) {
  try {
    // Accept timezone offset from client (minutes behind UTC, e.g. 360 for CST)
    let tzOffsetMin = 0;
    try {
      const body = await req.json();
      tzOffsetMin = body.tzOffset ?? 0;
    } catch { /* no body is fine, default to UTC */ }

    // Compute today's boundaries in the user's local timezone
    const nowUtc = Date.now();
    const localNow = new Date(nowUtc - tzOffsetMin * 60 * 1000);
    const localDateStr = `${localNow.getUTCFullYear()}-${String(localNow.getUTCMonth() + 1).padStart(2, "0")}-${String(localNow.getUTCDate()).padStart(2, "0")}`;

    // Local midnight → UTC
    const todayStartUtc = new Date(`${localDateStr}T00:00:00Z`);
    todayStartUtc.setMinutes(todayStartUtc.getMinutes() + tzOffsetMin);
    const todayEndUtc = new Date(`${localDateStr}T23:59:59.999Z`);
    todayEndUtc.setMinutes(todayEndUtc.getMinutes() + tzOffsetMin);

    const todayStart = todayStartUtc.toISOString();
    const todayEnd = todayEndUtc.toISOString();

    const [weightLogs, foodLogs, workouts, waterLogs, mobilityLogs] =
      await Promise.all([
        dbQuery("SELECT * FROM weight_logs WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp", [todayStart, todayEnd]),
        dbQuery("SELECT * FROM food_logs WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp", [todayStart, todayEnd]),
        dbQuery("SELECT * FROM workouts WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp", [todayStart, todayEnd]),
        dbQuery("SELECT * FROM water_logs WHERE timestamp >= $1 AND timestamp <= $2 ORDER BY timestamp", [todayStart, todayEnd]),
        dbQuery("SELECT * FROM mobility_logs WHERE date = $1 ORDER BY date", [localDateStr]),
      ]);

    // Also get yesterday for comparison
    const yesterdayLocal = new Date(localNow);
    yesterdayLocal.setUTCDate(yesterdayLocal.getUTCDate() - 1);
    const yesterdayStr = `${yesterdayLocal.getUTCFullYear()}-${String(yesterdayLocal.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterdayLocal.getUTCDate()).padStart(2, "0")}`;
    const yStartUtc = new Date(`${yesterdayStr}T00:00:00Z`);
    yStartUtc.setMinutes(yStartUtc.getMinutes() + tzOffsetMin);
    const yEndUtc = new Date(`${yesterdayStr}T23:59:59.999Z`);
    yEndUtc.setMinutes(yEndUtc.getMinutes() + tzOffsetMin);

    const [yesterdayFood, yesterdayWorkouts] = await Promise.all([
      dbQuery("SELECT * FROM food_logs WHERE timestamp >= $1 AND timestamp <= $2", [yStartUtc.toISOString(), yEndUtc.toISOString()]),
      dbQuery("SELECT * FROM workouts WHERE timestamp >= $1 AND timestamp <= $2", [yStartUtc.toISOString(), yEndUtc.toISOString()]),
    ]);

    // Compute today's stats
    const totalCalories = (foodLogs || []).reduce((sum: number, f: { total_calories: number }) => sum + (Number(f.total_calories) || 0), 0);
    const totalProtein = (foodLogs || []).reduce((sum: number, f: { protein_g: number }) => sum + (Number(f.protein_g) || 0), 0);
    const totalWater = (waterLogs || []).reduce((sum: number, w: { amount_oz: number }) => sum + (Number(w.amount_oz) || 0), 0);
    const workoutCount = (workouts || []).length;
    const mobilityDone = (mobilityLogs || []).length > 0;
    const todayWeightLog = (weightLogs || []).length > 0;
    const latestWeight = todayWeightLog ? Number((weightLogs as { weight: number }[])[0].weight) : null;

    // Yesterday comparison
    const yesterdayCalories = (yesterdayFood || []).reduce((sum: number, f: { total_calories: number }) => sum + (Number(f.total_calories) || 0), 0);
    const yesterdayWorkoutCount = (yesterdayWorkouts || []).length;

    // Meal breakdown
    const mealBreakdown = (foodLogs || []).reduce((acc: Record<string, number>, f: { meal_type: string; total_calories: number }) => {
      acc[f.meal_type] = (acc[f.meal_type] || 0) + (Number(f.total_calories) || 0);
      return acc;
    }, {} as Record<string, number>);

    const dataSummary = `
TODAY'S DATA (${localDateStr}):
- Weight logged: ${todayWeightLog ? `Yes (${latestWeight} lbs)` : "No"}
- Total calories: ${totalCalories} cal (target: 1,800)
- Total protein: ${totalProtein}g (target: 135g)
- Water: ${totalWater}oz (target: 64oz)
- Workouts: ${workoutCount}
- Mobility done: ${mobilityDone ? "Yes" : "No"}
- Meal breakdown: ${Object.entries(mealBreakdown).map(([k, v]) => `${k}: ${v} cal`).join(", ") || "No meals logged"}
- Food log entries: ${(foodLogs || []).length}

YESTERDAY COMPARISON:
- Yesterday calories: ${yesterdayCalories} cal
- Yesterday workouts: ${yesterdayWorkoutCount}

TIME OF DAY: ${localNow.getUTCHours() < 12 ? "morning" : localNow.getUTCHours() < 17 ? "afternoon" : "evening"}
`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `${HEALTH_SYSTEM_PROMPT}

You are generating a DAILY REVIEW for Doug -- a quick end-of-day (or mid-day) summary. Keep it conversational but data-driven. Structure it:

1. **Today's Score** -- Give an honest grade (A-F) with a one-line reason
2. **What went well** -- Celebrate wins, even small ones
3. **Watch out** -- Flag anything concerning (overeating, skipped workout, etc.)
4. **Tomorrow's plan** -- 3 specific, actionable items for tomorrow

Keep it concise (under 200 words). Be encouraging but honest. Reference their specific context (Forestier's disease, AMT 885, overeating tendency). Use markdown formatting.`,
      messages: [
        {
          role: "user",
          content: `Generate my daily review:\n${dataSummary}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "No response" }, { status: 500 });
    }

    return NextResponse.json({ review: textContent.text });
  } catch (error) {
    console.error("Daily review error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const safeMessage = message.includes("DATABASE_URL")
      ? "Database not configured"
      : "Failed to generate daily review";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
