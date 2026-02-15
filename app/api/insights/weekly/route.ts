import { NextResponse } from "next/server";
import { query as dbQuery } from "@/lib/neon";

export async function GET() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    const [weightLogs, foodLogs, workouts, waterLogs] = await Promise.all([
      dbQuery("SELECT * FROM weight_logs WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
      dbQuery("SELECT * FROM food_logs WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
      dbQuery("SELECT * FROM workouts WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
      dbQuery("SELECT * FROM water_logs WHERE timestamp >= $1 ORDER BY timestamp", [cutoff]),
    ]);

    // Compute weekly summary
    const weights = weightLogs.map((w: { weight: number }) => Number(w.weight));
    const avgWeight =
      weights.length > 0
        ? Math.round(
            (weights.reduce((a: number, b: number) => a + b, 0) / weights.length) * 10
          ) / 10
        : null;

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
        : null;

    const protValues = Object.values(dailyProtein);
    const avgProtein =
      protValues.length > 0
        ? Math.round(protValues.reduce((a, b) => a + b, 0) / protValues.length)
        : null;

    const totalWater = waterLogs.reduce(
      (s: number, w: { amount_oz: number }) => s + Number(w.amount_oz),
      0
    );
    const waterDays = new Set(
      waterLogs.map((w: { timestamp: string }) => String(w.timestamp).split("T")[0])
    ).size;

    return NextResponse.json({
      period: "7d",
      avgWeight,
      weightCount: weights.length,
      avgCalories,
      avgProtein,
      calorieTarget: 1800,
      proteinTarget: 135,
      totalWorkouts: workouts.length,
      avgWaterOz: waterDays > 0 ? Math.round(totalWater / waterDays) : null,
      dailyCalories,
      dailyProtein,
    });
  } catch (error) {
    console.error("Weekly insights error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const safeMessage = message.includes("DATABASE_URL")
      ? "Database not configured"
      : "Failed to generate insights";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
