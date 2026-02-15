"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { rollingWeightAverage, estimateGoalDate, weeklyCalorieAdherence, macroBreakdown, weeklyWeightChangeRate } from "@/lib/trendAnalysis";
import { detectOvereatingPatterns, type PatternInsight } from "@/lib/patternDetection";
import type { WeightLog, FoodLog, Workout } from "@/lib/types";

export default function InsightsPage() {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "weight" | "nutrition" | "patterns">("overview");
  const [weightRange, setWeightRange] = useState<"30d" | "90d" | "1y" | "all">("90d");

  const calorieTarget = 1800;
  const goalWeight = 185;

  const loadData = useCallback(async () => {
    // For food/workouts, 30 days is enough for pattern detection
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const shortCutoff = thirtyDaysAgo.toISOString();

    // For weight, pull up to 2 years to leverage TrendWeight historical data
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const longCutoff = twoYearsAgo.toISOString();

    const [{ data: weights }, { data: foods }, { data: wkts }] = await Promise.all([
      db.from("weight_logs").select("*").gte("timestamp", longCutoff).order("timestamp", { ascending: true }),
      db.from("food_logs").select("*").gte("timestamp", shortCutoff).order("timestamp", { ascending: true }),
      db.from("workouts").select("*").gte("timestamp", shortCutoff).order("timestamp", { ascending: true }),
    ]);

    if (weights) setWeightLogs(weights as WeightLog[]);
    if (foods) setFoodLogs(foods as FoodLog[]);
    if (wkts) setWorkouts(wkts as Workout[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Analyzing your data...</p>
        </div>
      </div>
    );
  }

  // Computed
  const rollingAvgs = rollingWeightAverage(weightLogs);
  const goalDate = estimateGoalDate(rollingAvgs, goalWeight);
  const weeklyAdherence = weeklyCalorieAdherence(foodLogs, calorieTarget);
  const macros = macroBreakdown(foodLogs.filter((f) => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Date(f.timestamp) >= d;
  }));
  const weeklyRate = weeklyWeightChangeRate(rollingAvgs);
  const patterns = detectOvereatingPatterns(foodLogs, workouts, calorieTarget);

  const latestAvg = rollingAvgs.length > 0 ? rollingAvgs[rollingAvgs.length - 1].avg : null;
  const workoutCount7d = workouts.filter((w) => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return new Date(w.timestamp) >= d;
  }).length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="w-8 h-8 bg-[var(--card)] rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Insights</h1>
          <p className="text-xs text-slate-400">Your data tells a story -- here&apos;s what it says</p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 mb-5">
        {(["overview", "weight", "nutrition", "patterns"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
              tab === t ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Are We On Track?</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">7-Day Avg Weight</p>
                <p className="text-2xl font-bold">{latestAvg ?? "---"}<span className="text-sm text-slate-400 ml-1">lbs</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Weekly Rate</p>
                <p className={`text-2xl font-bold ${weeklyRate !== null && weeklyRate < 0 ? "text-green-400" : weeklyRate !== null && weeklyRate > 0 ? "text-red-400" : ""}`}>
                  {weeklyRate !== null ? `${weeklyRate > 0 ? "+" : ""}${weeklyRate}` : "---"}
                  <span className="text-sm text-slate-400 ml-1">lbs/wk</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Projected Goal</p>
                <p className="text-lg font-semibold text-sky-400">{goalDate ?? "Need more data"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Workouts (7d)</p>
                <p className="text-2xl font-bold">{workoutCount7d}</p>
              </div>
            </div>
          </div>

          {/* Quick Insight Cards */}
          {patterns.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Top Insights</h2>
              <div className="space-y-2">
                {patterns.slice(0, 3).map((p) => (
                  <PatternCard key={p.id} pattern={p} />
                ))}
              </div>
            </div>
          )}

          {/* Macro Summary */}
          <div className="bg-[var(--card)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">7-Day Macro Avg</h2>
            <div className="grid grid-cols-3 gap-3">
              <MacroStat label="Protein" value={macros.protein_g} pct={macros.protein_pct} target={30} color="bg-green-500" />
              <MacroStat label="Carbs" value={macros.carbs_g} pct={macros.carbs_pct} target={40} color="bg-blue-500" />
              <MacroStat label="Fat" value={macros.fat_g} pct={macros.fat_pct} target={30} color="bg-amber-500" />
            </div>
          </div>
        </div>
      )}

      {/* WEIGHT TAB */}
      {tab === "weight" && (() => {
        // Filter weight data by selected range
        const now = new Date();
        const filteredWeights = weightLogs.filter((w) => {
          const d = new Date(w.timestamp);
          if (weightRange === "30d") { const c = new Date(now); c.setDate(c.getDate() - 30); return d >= c; }
          if (weightRange === "90d") { const c = new Date(now); c.setDate(c.getDate() - 90); return d >= c; }
          if (weightRange === "1y") { const c = new Date(now); c.setFullYear(c.getFullYear() - 1); return d >= c; }
          return true; // "all"
        });
        const filteredAvgs = rollingWeightAverage(filteredWeights);
        const filteredLatestAvg = filteredAvgs.length > 0 ? filteredAvgs[filteredAvgs.length - 1].avg : null;

        return (
        <div className="space-y-4">
          {/* Range selector */}
          <div className="flex gap-1 bg-[var(--card)] rounded-lg p-1">
            {(["30d", "90d", "1y", "all"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setWeightRange(r)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  weightRange === r ? "bg-sky-600 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {r === "all" ? `All (${weightLogs.length})` : r}
              </button>
            ))}
          </div>

          {/* Rolling average chart */}
          <div className="bg-[var(--card)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Weight Trend (7-Day Average)</h2>
            {filteredAvgs.length >= 3 ? (
              <div>
                <MiniChart data={filteredAvgs} goalWeight={goalWeight} />
                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>{filteredAvgs[0].date}</span>
                  <span>{filteredAvgs[filteredAvgs.length - 1].date}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-6">
                {weightLogs.length > 0
                  ? "Not enough data in this range. Try a wider range."
                  : "Log weights or import from TrendWeight to see trends"}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--card)] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Starting</p>
              <p className="text-xl font-bold">220<span className="text-sm text-slate-400 ml-0.5">lbs</span></p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Current Avg</p>
              <p className="text-xl font-bold">{filteredLatestAvg ?? latestAvg ?? "---"}<span className="text-sm text-slate-400 ml-0.5">lbs</span></p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Goal</p>
              <p className="text-xl font-bold text-sky-400">{goalWeight}<span className="text-sm text-slate-400 ml-0.5">lbs</span></p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500">Est. Date</p>
              <p className="text-sm font-semibold text-sky-400">{goalDate ?? "---"}</p>
            </div>
          </div>

          {/* Recent Weigh-ins */}
          <div className="bg-[var(--card)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Weigh-ins</h2>
              {weightLogs.length > 0 && (
                <span className="text-[10px] text-slate-600">{weightLogs.length} total entries</span>
              )}
            </div>
            {filteredWeights.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No weight data yet.{" "}
                <a href="/settings" className="text-sky-400 hover:text-sky-300">Import from TrendWeight</a>
              </p>
            ) : (
              <div className="space-y-1">
                {[...filteredWeights].reverse().slice(0, 10).map((w) => (
                  <div key={w.id} className="flex justify-between py-1.5 border-b border-slate-700/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{new Date(w.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      {w.source === "trendweight" && <span className="text-[8px] bg-purple-900/40 text-purple-400 px-1 py-0.5 rounded">TW</span>}
                    </div>
                    <span className="text-sm font-medium">{w.weight} lbs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* NUTRITION TAB */}
      {tab === "nutrition" && (
        <div className="space-y-4">
          {/* Weekly adherence */}
          <div className="bg-[var(--card)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Weekly Calorie Adherence</h2>
            <div className="space-y-2">
              {weeklyAdherence.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-8">
                    {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <div className="flex-1 bg-slate-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        day.calories === 0 ? "bg-slate-600" :
                        day.calories <= calorieTarget * 1.05 ? "bg-green-500" :
                        day.calories <= calorieTarget * 1.15 ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${day.calories === 0 ? 0 : Math.min(100, (day.calories / (calorieTarget * 1.3)) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono w-14 text-right ${
                    day.calories === 0 ? "text-slate-600" :
                    day.calories <= calorieTarget ? "text-green-400" : "text-red-400"
                  }`}>
                    {day.calories > 0 ? `${day.calories}` : "---"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">Target: {calorieTarget} cal/day</p>
          </div>

          {/* Macro breakdown */}
          <div className="bg-[var(--card)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">7-Day Macro Split</h2>
            <div className="flex gap-1 h-6 rounded-full overflow-hidden mb-3">
              {macros.protein_pct > 0 && <div className="bg-green-500 transition-all" style={{ width: `${macros.protein_pct}%` }} />}
              {macros.carbs_pct > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${macros.carbs_pct}%` }} />}
              {macros.fat_pct > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${macros.fat_pct}%` }} />}
              {macros.protein_pct === 0 && macros.carbs_pct === 0 && macros.fat_pct === 0 && <div className="bg-slate-600 w-full" />}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1" />
                <p className="text-xs text-slate-400">Protein</p>
                <p className="text-sm font-semibold">{macros.protein_pct}%</p>
                <p className="text-xs text-slate-500">{macros.protein_g}g avg</p>
                <p className="text-[10px] text-slate-600">target: 30%</p>
              </div>
              <div>
                <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-1" />
                <p className="text-xs text-slate-400">Carbs</p>
                <p className="text-sm font-semibold">{macros.carbs_pct}%</p>
                <p className="text-xs text-slate-500">{macros.carbs_g}g avg</p>
                <p className="text-[10px] text-slate-600">target: 40%</p>
              </div>
              <div>
                <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto mb-1" />
                <p className="text-xs text-slate-400">Fat</p>
                <p className="text-sm font-semibold">{macros.fat_pct}%</p>
                <p className="text-xs text-slate-500">{macros.fat_g}g avg</p>
                <p className="text-[10px] text-slate-600">target: 30%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PATTERNS TAB */}
      {tab === "patterns" && (
        <div className="space-y-4">
          {patterns.length > 0 ? (
            <>
              <p className="text-xs text-slate-400">AI-detected patterns from the last 14 days of data</p>
              {patterns.map((p) => (
                <PatternCard key={p.id} pattern={p} expanded />
              ))}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-slate-400 text-sm">Not enough data for pattern detection yet</p>
              <p className="text-xs text-slate-500 mt-1">Keep logging for 7-14 days and insights will appear</p>
            </div>
          )}

          {/* Workout consistency */}
          <div className="bg-[var(--card)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Workout Consistency (30d)</h2>
            <WorkoutHeatmap workouts={workouts} />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function PatternCard({ pattern, expanded }: { pattern: PatternInsight; expanded?: boolean }) {
  const borderColors: Record<string, string> = {
    overeating: "border-red-700/40",
    skipping: "border-amber-700/40",
    correlation: "border-blue-700/40",
    positive: "border-green-700/40",
    suggestion: "border-purple-700/40",
  };
  const bgColors: Record<string, string> = {
    overeating: "bg-red-900/20",
    skipping: "bg-amber-900/20",
    correlation: "bg-blue-900/20",
    positive: "bg-green-900/20",
    suggestion: "bg-purple-900/20",
  };

  return (
    <div className={`${bgColors[pattern.type] || "bg-slate-800"} border ${borderColors[pattern.type] || "border-slate-700"} rounded-xl p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{pattern.icon}</span>
        <div>
          <p className="text-sm font-semibold">{pattern.title}</p>
          {(expanded || true) && <p className="text-xs text-slate-400 mt-1">{pattern.detail}</p>}
        </div>
      </div>
    </div>
  );
}

function MacroStat({ label, value, pct, target, color }: { label: string; value: number; pct: number; target: number; color: string }) {
  const diff = pct - target;
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold">{value}g</p>
      <p className={`text-xs ${Math.abs(diff) <= 5 ? "text-green-400" : diff > 5 ? "text-red-400" : "text-amber-400"}`}>
        {pct}% {diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : "(on target)"}
      </p>
      <div className={`w-full h-1 rounded-full bg-slate-700 mt-1`}>
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(100, (pct / target) * 100)}%` }} />
      </div>
    </div>
  );
}

function MiniChart({ data, goalWeight }: { data: { date: string; avg: number; raw: number }[]; goalWeight: number }) {
  if (data.length < 2) return null;

  const weights = data.map((d) => d.avg);
  const rawWeights = data.map((d) => d.raw);
  const maxW = Math.max(...rawWeights, ...weights) + 2;
  const minW = Math.min(...rawWeights, ...weights, goalWeight) - 2;
  const range = maxW - minW;
  const chartHeight = 120;
  const chartWidth = 300;

  const toY = (w: number) => chartHeight - ((w - minW) / range) * chartHeight;
  const toX = (i: number) => (i / (data.length - 1)) * chartWidth;

  const avgPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.avg)}`).join(" ");
  const goalY = toY(goalWeight);

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 10}`} className="w-full" preserveAspectRatio="none">
      {/* Goal line */}
      <line x1="0" y1={goalY} x2={chartWidth} y2={goalY} stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      <text x={chartWidth - 2} y={goalY - 4} textAnchor="end" fill="#38bdf8" fontSize="8" opacity="0.6">{goalWeight}</text>

      {/* Raw dots */}
      {data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.raw)} r="2" fill="#64748b" opacity="0.4" />
      ))}

      {/* Rolling average line */}
      <path d={avgPath} fill="none" stroke="#22c55e" strokeWidth="2" />

      {/* Current dot */}
      <circle cx={toX(data.length - 1)} cy={toY(data[data.length - 1].avg)} r="4" fill="#22c55e" />
    </svg>
  );
}

function WorkoutHeatmap({ workouts }: { workouts: Workout[] }) {
  const days: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const count = workouts.filter((w) => w.timestamp.split("T")[0] === dateStr).length;
    days.push({ date: dateStr, count });
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.count} workout${d.count !== 1 ? "s" : ""}`}
          className={`w-6 h-6 rounded text-[8px] flex items-center justify-center ${
            d.count >= 2 ? "bg-green-500 text-white" :
            d.count === 1 ? "bg-green-700 text-green-200" :
            "bg-slate-700 text-slate-500"
          }`}
        >
          {new Date(d.date + "T12:00:00").getDate()}
        </div>
      ))}
    </div>
  );
}
