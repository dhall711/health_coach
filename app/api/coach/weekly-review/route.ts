import { NextResponse } from "next/server";
import { anthropic, HEALTH_SYSTEM_PROMPT } from "@/lib/claude";
import { query as dbQuery } from "@/lib/neon";

export async function POST() {
  try {
    // Gather last 7 days of data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();
    const dateCutoff = cutoff.split("T")[0];

    const [weightLogs, foodLogs, workouts, waterLogs, mobilityLogs] =
      await Promise.all([
        dbQuery("SELECT * FROM weight_logs WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
        dbQuery("SELECT * FROM food_logs WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
        dbQuery("SELECT * FROM workouts WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
        dbQuery("SELECT * FROM water_logs WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
        dbQuery("SELECT * FROM mobility_logs WHERE date >= $1 ORDER BY date", [dateCutoff]),
      ]);

    // Compute stats
    const weights = weightLogs.map((w: { weight: number }) => Number(w.weight));
    const avgWeight =
      weights.length > 0
        ? (weights.reduce((a: number, b: number) => a + b, 0) / weights.length).toFixed(1)
        : "no data";

    const dailyCalories: Record<string, number> = {};
    const dailyProtein: Record<string, number> = {};
    foodLogs.forEach(
      (f: { timestamp: string; total_calories: number; protein_g: number }) => {
        const date = String(f.timestamp).split("T")[0];
        dailyCalories[date] = (dailyCalories[date] || 0) + (Number(f.total_calories) || 0);
        dailyProtein[date] = (dailyProtein[date] || 0) + (Number(f.protein_g) || 0);
      }
    );

    const calValues = Object.values(dailyCalories);
    const avgCalories =
      calValues.length > 0
        ? Math.round(calValues.reduce((a, b) => a + b, 0) / calValues.length)
        : 0;
    const protValues = Object.values(dailyProtein);
    const avgProtein =
      protValues.length > 0
        ? Math.round(protValues.reduce((a, b) => a + b, 0) / protValues.length)
        : 0;

    const totalWorkouts = workouts.length;
    const totalMobility = mobilityLogs.length;

    const waterAmounts = waterLogs.map((w: { amount_oz: number }) => Number(w.amount_oz));
    const totalWater = waterAmounts.reduce((a: number, b: number) => a + b, 0);
    const daysWithWater = new Set(
      waterLogs.map((w: { timestamp: string }) => String(w.timestamp).split("T")[0])
    ).size;
    const avgWater = daysWithWater > 0 ? Math.round(totalWater / daysWithWater) : 0;

    const dataSummary = `
WEEKLY DATA SUMMARY (last 7 days):
- Weight logs: ${weights.length} entries, avg: ${avgWeight} lbs ${weights.length >= 2 ? `(range: ${Math.min(...weights)}-${Math.max(...weights)})` : ""}
- Daily calorie avg: ${avgCalories} cal/day (target: 1,800) -- logged ${calValues.length} days
- Daily protein avg: ${avgProtein}g/day (target: 135g)
- Workouts completed: ${totalWorkouts}
- Mobility sessions: ${totalMobility}
- Avg daily water: ${avgWater}oz (target: 64oz)

Daily calorie breakdown:
${Object.entries(dailyCalories).map(([date, cal]) => `  ${date}: ${cal} cal, ${dailyProtein[date] || 0}g protein`).join("\n") || "  No food data logged"}
`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `${HEALTH_SYSTEM_PROMPT}

You are generating a WEEKLY REVIEW -- a portfolio-style analysis of the user's health data. Structure it like an investment review:

1. **This Week's Numbers** -- key metrics with comparison to targets
2. **Trend Assessment** -- are we on track? Use data, not emotion.
3. **Pattern Detected** -- any overeating patterns, skipped meals, consistency issues
4. **Highest Leverage Adjustment** -- THE SINGLE most impactful change for next week
5. **Next Week's Focus** -- one clear priority

Keep it concise, data-driven, and actionable. Reference their specific context (Forestier's, overeating weakness, past success). Use bullet points and be specific with numbers.`,
      messages: [
        {
          role: "user",
          content: `Generate my weekly review based on this data:\n${dataSummary}`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "No response" }, { status: 500 });
    }

    return NextResponse.json({ review: textContent.text });
  } catch (error) {
    console.error("Weekly review error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const safeMessage = message.includes("DATABASE_URL")
      ? "Database not configured"
      : "Failed to generate weekly review";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
