"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import CalorieBudgetBar from "@/components/CalorieBudgetBar";
import WaterTracker from "@/components/WaterTracker";
import type { FoodLog, Workout, WaterLog, Streak, WeightLog, FoodFavorite } from "@/lib/types";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export default function TodayPage() {
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [proteinG, setProteinG] = useState(0);
  const [carbsG, setCarbsG] = useState(0);
  const [fatG, setFatG] = useState(0);
  const [calorieTarget] = useState(1800);
  const [waterOz, setWaterOz] = useState(0);
  const [waterGoal] = useState(64);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [hasLoggedWeight, setHasLoggedWeight] = useState(false);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [todayFoodLogs, setTodayFoodLogs] = useState<FoodLog[]>([]);
  const [mobilityDone, setMobilityDone] = useState(false);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    const today = getToday();

    try {
      // Load today's food logs
      const { data: foodLogs } = await db
        .from("food_logs")
        .select("*")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`)
        .order("timestamp", { ascending: true });

      if (foodLogs) {
        setTodayFoodLogs(foodLogs as FoodLog[]);
        setCaloriesConsumed(
          foodLogs.reduce((sum: number, log: FoodLog) => sum + (log.total_calories || 0), 0)
        );
        setProteinG(
          foodLogs.reduce((sum: number, log: FoodLog) => sum + (log.protein_g || 0), 0)
        );
        setCarbsG(
          foodLogs.reduce((sum: number, log: FoodLog) => sum + (log.carbs_g || 0), 0)
        );
        setFatG(
          foodLogs.reduce((sum: number, log: FoodLog) => sum + (log.fat_g || 0), 0)
        );
      }

      // Load today's water
      const { data: waterLogs } = await db
        .from("water_logs")
        .select("*")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`);

      if (waterLogs) {
        setWaterOz(
          waterLogs.reduce((sum: number, log: WaterLog) => sum + (log.amount_oz || 0), 0)
        );
      }

      // Load streak
      const { data: streakData } = await db
        .from("streaks")
        .select("*")
        .limit(1)
        .single();

      if (streakData) setStreak(streakData as Streak);

      // Load latest weight
      const { data: weightData } = await db
        .from("weight_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (weightData) setCurrentWeight((weightData as WeightLog).weight);

      // Check if weight was logged today
      const { data: todayWeight } = await db
        .from("weight_logs")
        .select("id")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`)
        .limit(1);

      setHasLoggedWeight(!!todayWeight && todayWeight.length > 0);

      // Load today's workouts
      const { data: workouts } = await db
        .from("workouts")
        .select("*")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`);

      if (workouts) setTodayWorkouts(workouts as Workout[]);

      // Check mobility
      const { data: mobilityData } = await db
        .from("mobility_logs")
        .select("id")
        .eq("date", today)
        .limit(1);

      setMobilityDone(!!mobilityData && mobilityData.length > 0);

      // Load favorites
      const { data: favs } = await db
        .from("food_favorites")
        .select("*")
        .order("sort_order", { ascending: true });

      if (favs) setFavorites(favs as FoodFavorite[]);
    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const addWater = async (oz: number) => {
    const { error } = await db.from("water_logs").insert({ amount_oz: oz });
    if (!error) setWaterOz((prev) => prev + oz);
  };

  const quickLogFavorite = async (fav: FoodFavorite) => {
    const { error } = await db.from("food_logs").insert({
      meal_type: fav.meal_type,
      items: [
        {
          name: fav.name,
          calories: fav.default_calories,
          protein_g: fav.default_protein_g,
          carbs_g: fav.default_carbs_g,
          fat_g: fav.default_fat_g,
          portion_size: "standard",
          portion_notes: "",
        },
      ],
      total_calories: fav.default_calories,
      protein_g: fav.default_protein_g,
      carbs_g: fav.default_carbs_g,
      fat_g: fav.default_fat_g,
      input_method: "favorite",
      confirmed: true,
    });

    if (!error) {
      setCaloriesConsumed((prev) => prev + fav.default_calories);
      setProteinG((prev) => prev + fav.default_protein_g);
      setCarbsG((prev) => prev + fav.default_carbs_g);
      setFatG((prev) => prev + fav.default_fat_g);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading mission control...</p>
        </div>
      </div>
    );
  }

  const caloriesRemaining = calorieTarget - caloriesConsumed;
  const goalWeight = 185;
  const startWeight = 220;
  const poundsLost = currentWeight ? startWeight - currentWeight : 0;
  const poundsToGo = currentWeight ? currentWeight - goalWeight : startWeight - goalWeight;
  const totalCaloriesBurned = todayWorkouts.reduce((sum, w) => sum + w.calories_burned, 0);
  const timeOfDay = getTimeOfDay();

  // Macro targets (30/40/30 of 1800 cal)
  const proteinTarget = 135; // (1800 * 0.30) / 4
  const carbsTarget = 180; // (1800 * 0.40) / 4
  const fatTarget = 60; // (1800 * 0.30) / 9

  // Next Action logic
  const getNextAction = () => {
    if (timeOfDay === "morning" && !hasLoggedWeight) {
      return {
        icon: "⚖️",
        title: "Log your morning weight",
        subtitle: "Fasted, before eating -- most accurate reading",
        href: "/track?type=weight",
        color: "from-blue-600 to-cyan-600",
      };
    }
    if (todayWorkouts.length === 0 && timeOfDay !== "evening") {
      return {
        icon: "🏃",
        title: "Time for your AMT 885 session",
        subtitle: "30-45 min moderate intensity -- you've got this",
        href: "/track?type=workout",
        color: "from-green-600 to-emerald-600",
      };
    }
    if (!mobilityDone) {
      return {
        icon: "🧘",
        title: "5-min mobility routine",
        subtitle: "Keep those hips and back moving -- gentle stretches",
        href: "/track?type=mobility",
        color: "from-purple-600 to-violet-600",
      };
    }
    if (timeOfDay === "evening" && caloriesConsumed > 0) {
      return {
        icon: "📊",
        title: "How was today?",
        subtitle: `${caloriesConsumed} cal logged, ${todayWorkouts.length} workout${todayWorkouts.length !== 1 ? "s" : ""}`,
        href: "/coach",
        color: "from-indigo-600 to-purple-600",
      };
    }
    return {
      icon: "🍽️",
      title: "Log your next meal",
      subtitle: `${caloriesRemaining > 0 ? caloriesRemaining : 0} cal remaining today`,
      href: "/track",
      color: "from-sky-600 to-blue-600",
    };
  };

  const nextAction = getNextAction();

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">{getGreeting()}</h1>
          <p className="text-sm text-slate-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streak && streak.current_streak > 0 && (
            <div className="flex items-center gap-1 bg-amber-900/30 text-amber-300 px-2.5 py-1 rounded-full text-xs font-medium">
              <span>🔥</span>
              <span>{streak.current_streak}</span>
            </div>
          )}
          <Link
            href="/settings"
            className="w-9 h-9 bg-[var(--card)] rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Next Action Card */}
      <Link
        href={nextAction.href}
        className={`block bg-gradient-to-r ${nextAction.color} rounded-2xl p-4 mb-5 card-press shadow-lg`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{nextAction.icon}</span>
          <div className="flex-1">
            <p className="font-semibold text-white">{nextAction.title}</p>
            <p className="text-sm text-white/70">{nextAction.subtitle}</p>
          </div>
          <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </Link>

      {/* Calorie Budget + Macros */}
      <CalorieBudgetBar consumed={caloriesConsumed} target={calorieTarget} burned={totalCaloriesBurned} />

      {/* Macro Rings */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MacroMini label="Protein" current={proteinG} target={proteinTarget} color="#22c55e" unit="g" />
        <MacroMini label="Carbs" current={carbsG} target={carbsTarget} color="#3b82f6" unit="g" />
        <MacroMini label="Fat" current={fatG} target={fatTarget} color="#f59e0b" unit="g" />
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[var(--card)] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Weight</p>
          <p className="text-lg font-bold">{currentWeight ? `${currentWeight}` : "---"}</p>
          <p className="text-[10px] text-slate-500">{poundsToGo > 0 ? `${poundsToGo} to go` : "Goal!"}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Workouts</p>
          <p className="text-lg font-bold">{todayWorkouts.length}</p>
          <p className="text-[10px] text-slate-500">{totalCaloriesBurned > 0 ? `${totalCaloriesBurned} cal` : "today"}</p>
        </div>
        <div className="bg-[var(--card)] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Mobility</p>
          <p className="text-lg font-bold">{mobilityDone ? "✓" : "—"}</p>
          <p className="text-[10px] text-slate-500">{mobilityDone ? "done" : "pending"}</p>
        </div>
      </div>

      {/* Water Tracker */}
      <WaterTracker currentOz={waterOz} goalOz={waterGoal} onAddWater={addWater} />

      {/* Today's Timeline */}
      {todayFoodLogs.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Today&apos;s Log
            </h2>
            <span className="text-xs text-slate-500">{todayFoodLogs.length} entries</span>
          </div>
          <div className="space-y-2">
            {todayFoodLogs.slice(-5).map((log) => (
              <div key={log.id} className="bg-[var(--card)] rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-base">
                    {log.meal_type === "breakfast" ? "🌅" : log.meal_type === "lunch" ? "☀️" : log.meal_type === "dinner" ? "🌙" : log.meal_type === "drink" ? "🥤" : "🍽️"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {log.items && Array.isArray(log.items)
                        ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
                        : log.meal_type}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{log.total_calories} cal</p>
                  <p className="text-[10px] text-slate-500">{log.protein_g}g P</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal Progress */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Goal Progress
        </h2>
        <div className="bg-[var(--card)] rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-400">{startWeight} lbs → {goalWeight} lbs</span>
            <span className="text-sm font-semibold text-sky-400">
              {poundsToGo > 0 ? `${poundsToGo} lbs to go` : "Goal reached!"}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-sky-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, (poundsLost / (startWeight - goalWeight)) * 100))}%`,
              }}
            />
          </div>
          {currentWeight && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              Current: {currentWeight} lbs
              {poundsLost > 0 && ` · ${poundsLost} lbs lost`}
            </p>
          )}
        </div>
      </div>

      {/* Quick Log Strip -- always visible favorites */}
      {favorites.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Quick Log
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {favorites.map((fav) => (
              <button
                key={fav.id}
                onClick={() => quickLogFavorite(fav)}
                className="flex-shrink-0 bg-[var(--card)] border border-slate-700 rounded-xl px-3 py-2.5 flex flex-col items-center gap-1 card-press hover:border-slate-500 transition-colors min-w-[72px]"
              >
                <span className="text-xl">{fav.icon}</span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{fav.name}</span>
                <span className="text-[10px] text-slate-600">{fav.default_calories} cal</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coach CTA */}
      <Link
        href="/coach"
        className="block bg-gradient-to-r from-purple-600/80 to-indigo-600/80 border border-purple-500/20 rounded-xl p-4 mb-6 card-press"
      >
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-purple-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <div>
            <p className="font-semibold text-white">AI Coach</p>
            <p className="text-sm text-purple-200/70">
              Get advice, review your week, or adjust your plan
            </p>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* Inline mini-component for macro display */
function MacroMini({
  label,
  current,
  target,
  color,
  unit,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  unit: string;
}) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div className="bg-[var(--card)] rounded-xl p-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-[10px] text-slate-500">
          {Math.round(current)}/{target}{unit}
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
