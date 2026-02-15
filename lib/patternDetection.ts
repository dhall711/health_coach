// Pattern detection: identify overeating triggers, correlations, weak points
// "Why did I overeat Friday?" -- backed by data

import type { FoodLog, Workout } from "./types";

export interface PatternInsight {
  id: string;
  type: "overeating" | "skipping" | "correlation" | "positive" | "suggestion";
  icon: string;
  title: string;
  detail: string;
}

/**
 * Analyze food logs for overeating patterns.
 * Returns AI-promptable insights.
 */
export function detectOvereatingPatterns(
  foodLogs: FoodLog[],
  workouts: Workout[],
  calorieTarget: number,
  days: number = 14
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  const today = new Date();

  // Group food logs by day
  const dailyCalories: Record<string, number> = {};
  const dailyProtein: Record<string, number> = {};
  const dailyMealTypes: Record<string, string[]> = {};

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    dailyCalories[dateStr] = 0;
    dailyProtein[dateStr] = 0;
    dailyMealTypes[dateStr] = [];
  }

  foodLogs.forEach((log) => {
    const dateStr = log.timestamp.split("T")[0];
    if (dateStr in dailyCalories) {
      dailyCalories[dateStr] += log.total_calories || 0;
      dailyProtein[dateStr] += log.protein_g || 0;
      dailyMealTypes[dateStr].push(log.meal_type);
    }
  });

  // Group workouts by day
  const workoutDays = new Set<string>();
  workouts.forEach((w) => {
    workoutDays.add(w.timestamp.split("T")[0]);
  });

  // Pattern 1: Overeating on specific days of week
  const dayOfWeekOvereat: Record<string, number[]> = {};
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  Object.entries(dailyCalories).forEach(([dateStr, cal]) => {
    const day = dayNames[new Date(dateStr).getDay()];
    if (!dayOfWeekOvereat[day]) dayOfWeekOvereat[day] = [];
    dayOfWeekOvereat[day].push(cal);
  });

  for (const [day, cals] of Object.entries(dayOfWeekOvereat)) {
    const avg = cals.reduce((a, b) => a + b, 0) / cals.length;
    if (avg > calorieTarget * 1.15 && cals.length >= 2) {
      insights.push({
        id: `overeat-${day}`,
        type: "overeating",
        icon: "📈",
        title: `${day}s tend to be high-calorie days`,
        detail: `Avg ${Math.round(avg)} cal on ${day}s (${Math.round(((avg - calorieTarget) / calorieTarget) * 100)}% over target). Consider pre-planning ${day} meals.`,
      });
    }
  }

  // Pattern 2: Overeating on non-workout days
  let workoutDayCals = 0;
  let workoutDayCount = 0;
  let restDayCals = 0;
  let restDayCount = 0;

  Object.entries(dailyCalories).forEach(([dateStr, cal]) => {
    if (cal === 0) return; // no data
    if (workoutDays.has(dateStr)) {
      workoutDayCals += cal;
      workoutDayCount++;
    } else {
      restDayCals += cal;
      restDayCount++;
    }
  });

  if (workoutDayCount > 0 && restDayCount > 0) {
    const workoutAvg = workoutDayCals / workoutDayCount;
    const restAvg = restDayCals / restDayCount;
    if (restAvg > workoutAvg * 1.1) {
      insights.push({
        id: "rest-day-overeat",
        type: "correlation",
        icon: "🔗",
        title: "You eat more on rest days",
        detail: `Rest days avg ${Math.round(restAvg)} cal vs ${Math.round(workoutAvg)} cal on workout days. Exercise may help regulate appetite.`,
      });
    }
  }

  // Pattern 3: Skipped meals (no lunch logged)
  let lunchSkips = 0;
  let totalWeekdays = 0;
  Object.entries(dailyMealTypes).forEach(([dateStr, meals]) => {
    const dayOfWeek = new Date(dateStr).getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      totalWeekdays++;
      if (!meals.includes("lunch") && meals.length > 0) {
        lunchSkips++;
      }
    }
  });

  if (totalWeekdays > 3 && lunchSkips >= 2) {
    insights.push({
      id: "skip-lunch",
      type: "skipping",
      icon: "⏭️",
      title: `Lunch skipped ${lunchSkips} of ${totalWeekdays} workdays`,
      detail: "Skipping lunch often leads to overeating at dinner. Consider pre-logging a lunch from your favorites.",
    });
  }

  // Pattern 4: Low protein days
  const proteinValues = Object.values(dailyProtein).filter((p) => p > 0);
  if (proteinValues.length > 3) {
    const avgProtein = proteinValues.reduce((a, b) => a + b, 0) / proteinValues.length;
    const proteinTarget = 135; // 30% of 1800 cal / 4 cal per g
    if (avgProtein < proteinTarget * 0.8) {
      insights.push({
        id: "low-protein",
        type: "suggestion",
        icon: "🥩",
        title: `Protein averaging ${Math.round(avgProtein)}g/day`,
        detail: `Target is ${proteinTarget}g. Low protein accelerates muscle loss during weight loss. Try adding a protein source to each meal.`,
      });
    }
  }

  // Pattern 5: Positive reinforcement
  const daysOnTarget = Object.values(dailyCalories).filter(
    (cal) => cal > 0 && cal <= calorieTarget * 1.05
  ).length;
  const daysWithData = Object.values(dailyCalories).filter((c) => c > 0).length;

  if (daysWithData > 3 && daysOnTarget / daysWithData >= 0.6) {
    insights.push({
      id: "on-target",
      type: "positive",
      icon: "✅",
      title: `On target ${daysOnTarget} of ${daysWithData} days`,
      detail: "Solid adherence. Consistency beats perfection.",
    });
  }

  // Pattern 6: Lapse context patterns
  const lapseContexts: Record<string, number> = {};
  foodLogs.forEach((log) => {
    if (log.lapse_context) {
      lapseContexts[log.lapse_context] = (lapseContexts[log.lapse_context] || 0) + 1;
    }
  });

  const topLapse = Object.entries(lapseContexts).sort((a, b) => b[1] - a[1])[0];
  if (topLapse && topLapse[1] >= 3) {
    const contextLabels: Record<string, string> = {
      home: "at home",
      restaurant: "at restaurants",
      social: "at social events",
      stressed: "when stressed",
      bored: "when bored",
      screen_time: "during screen time",
    };
    insights.push({
      id: "lapse-pattern",
      type: "overeating",
      icon: "🎯",
      title: `Overeating most often ${contextLabels[topLapse[0]] || topLapse[0]}`,
      detail: `${topLapse[1]} instances in the last ${days} days. Consider specific strategies for this trigger.`,
    });
  }

  return insights;
}
