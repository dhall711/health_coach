// Trend analysis: rolling averages, smoothing, projections
// Inspired by MacroFactor's expenditure algorithm -- signal from noise

import type { WeightLog, FoodLog } from "./types";

// Source priority: lower number = more authoritative
const SOURCE_PRIORITY: Record<string, number> = {
  withings: 10,
  manual: 20,
  apple_health: 30,
  trendweight: 40,
};

/**
 * Deduplicate weight logs from multiple sources.
 *
 * When Withings syncs to Apple Health, the same scale reading appears from
 * both sources. This function keeps the highest-priority entry and removes
 * duplicates that are within ±30 minutes and ±0.5 lbs of each other.
 */
export function deduplicateWeightLogs(logs: WeightLog[]): WeightLog[] {
  if (logs.length <= 1) return logs;

  // Sort by timestamp, then by source priority (best source first)
  const sorted = [...logs].sort((a, b) => {
    const timeDiff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    if (Math.abs(timeDiff) > 1000) return timeDiff;
    return (SOURCE_PRIORITY[a.source] ?? 50) - (SOURCE_PRIORITY[b.source] ?? 50);
  });

  const kept: WeightLog[] = [];
  const windowMs = 30 * 60 * 1000; // 30 minutes

  for (const log of sorted) {
    const isDuplicate = kept.some((existing) => {
      const timeDiff = Math.abs(
        new Date(log.timestamp).getTime() -
          new Date(existing.timestamp).getTime()
      );
      const weightDiff = Math.abs(log.weight - existing.weight);
      // If same time window and similar weight, it's a duplicate
      if (timeDiff <= windowMs && weightDiff < 0.5) {
        // Keep the one with higher priority (lower number)
        const existingPriority = SOURCE_PRIORITY[existing.source] ?? 50;
        const logPriority = SOURCE_PRIORITY[log.source] ?? 50;
        return logPriority >= existingPriority; // skip if lower or equal priority
      }
      return false;
    });

    if (!isDuplicate) {
      kept.push(log);
    }
  }

  return kept;
}

/**
 * Calculate 7-day rolling average from weight logs.
 * Filters noise from water/glycogen/sodium fluctuations.
 */
export function rollingWeightAverage(
  logs: WeightLog[],
  windowDays: number = 7
): { date: string; avg: number; raw: number }[] {
  if (logs.length === 0) return [];

  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sorted.map((log, idx) => {
    const windowStart = Math.max(0, idx - windowDays + 1);
    const window = sorted.slice(windowStart, idx + 1);
    const avg =
      window.reduce((sum, w) => sum + w.weight, 0) / window.length;
    return {
      date: log.timestamp.split("T")[0],
      avg: Math.round(avg * 10) / 10,
      raw: log.weight,
    };
  });
}

/**
 * Project future weight based on current trend.
 * Uses linear regression on the last N days of rolling averages.
 */
export function projectWeightTrajectory(
  rollingAvgs: { date: string; avg: number }[],
  goalWeight: number,
  projectionDays: number = 180
): { date: string; projected: number }[] {
  if (rollingAvgs.length < 3) return [];

  // Use last 14 data points for trend
  const recent = rollingAvgs.slice(-14);
  const n = recent.length;

  // Simple linear regression
  const xValues = recent.map((_, i) => i);
  const yValues = recent.map((r) => r.avg);
  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += (xValues[i] - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const intercept = yMean - slope * xMean;

  // Project forward
  const lastDate = new Date(recent[recent.length - 1].date);
  const projections: { date: string; projected: number }[] = [];

  for (let d = 1; d <= projectionDays; d += 7) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + d);
    const projected = Math.round((intercept + slope * (n - 1 + d)) * 10) / 10;

    // Don't project below goal
    if (projected < goalWeight) {
      projections.push({
        date: futureDate.toISOString().split("T")[0],
        projected: goalWeight,
      });
      break;
    }

    projections.push({
      date: futureDate.toISOString().split("T")[0],
      projected,
    });
  }

  return projections;
}

/**
 * Estimate date when goal weight will be reached.
 */
export function estimateGoalDate(
  rollingAvgs: { date: string; avg: number }[],
  goalWeight: number
): string | null {
  if (rollingAvgs.length < 7) return null;

  const recent = rollingAvgs.slice(-14);
  if (recent.length < 2) return null;

  const firstAvg = recent[0].avg;
  const lastAvg = recent[recent.length - 1].avg;
  const daysBetween =
    (new Date(recent[recent.length - 1].date).getTime() -
      new Date(recent[0].date).getTime()) /
    (1000 * 60 * 60 * 24);

  if (daysBetween === 0 || lastAvg >= firstAvg) return null; // not losing

  const lossPerDay = (firstAvg - lastAvg) / daysBetween;
  const remainingLoss = lastAvg - goalWeight;

  if (remainingLoss <= 0) return "Goal reached!";

  const daysToGoal = Math.ceil(remainingLoss / lossPerDay);
  const goalDate = new Date(recent[recent.length - 1].date);
  goalDate.setDate(goalDate.getDate() + daysToGoal);

  return goalDate.toISOString().split("T")[0];
}

/**
 * Calculate weekly calorie adherence.
 * Returns daily calorie totals for the past 7 days compared to target.
 */
export function weeklyCalorieAdherence(
  foodLogs: FoodLog[],
  target: number,
  days: number = 7
): { date: string; calories: number; target: number; delta: number }[] {
  const today = new Date();
  const result: { date: string; calories: number; target: number; delta: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayLogs = foodLogs.filter(
      (l) => l.timestamp.split("T")[0] === dateStr
    );
    const calories = dayLogs.reduce((sum, l) => sum + (l.total_calories || 0), 0);

    result.push({
      date: dateStr,
      calories,
      target,
      delta: calories - target,
    });
  }

  return result;
}

/**
 * Calculate macro breakdown for a set of food logs.
 */
export function macroBreakdown(foodLogs: FoodLog[]): {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  protein_pct: number;
  carbs_pct: number;
  fat_pct: number;
} {
  const protein = foodLogs.reduce((s, l) => s + (l.protein_g || 0), 0);
  const carbs = foodLogs.reduce((s, l) => s + (l.carbs_g || 0), 0);
  const fat = foodLogs.reduce((s, l) => s + (l.fat_g || 0), 0);

  const totalCal = protein * 4 + carbs * 4 + fat * 9;

  return {
    protein_g: Math.round(protein),
    carbs_g: Math.round(carbs),
    fat_g: Math.round(fat),
    protein_pct: totalCal > 0 ? Math.round(((protein * 4) / totalCal) * 100) : 0,
    carbs_pct: totalCal > 0 ? Math.round(((carbs * 4) / totalCal) * 100) : 0,
    fat_pct: totalCal > 0 ? Math.round(((fat * 9) / totalCal) * 100) : 0,
  };
}

/**
 * Weekly weight change rate (lbs per week).
 */
export function weeklyWeightChangeRate(
  rollingAvgs: { date: string; avg: number }[]
): number | null {
  if (rollingAvgs.length < 7) return null;

  const recent7 = rollingAvgs.slice(-7);
  const older7 = rollingAvgs.slice(-14, -7);

  if (older7.length === 0) return null;

  const recentAvg = recent7.reduce((s, r) => s + r.avg, 0) / recent7.length;
  const olderAvg = older7.reduce((s, r) => s + r.avg, 0) / older7.length;

  return Math.round((recentAvg - olderAvg) * 10) / 10;
}
