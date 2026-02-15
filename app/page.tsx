"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import CalorieBudgetBar from "@/components/CalorieBudgetBar";
import WaterTracker from "@/components/WaterTracker";
import type { FoodLog, Workout, WaterLog, Streak, WeightLog, FoodFavorite } from "@/lib/types";

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Returns UTC ISO strings for the start and end of the LOCAL day.
// This is critical: the DB stores TIMESTAMPTZ in UTC, so we need
// local midnight → UTC for correct day boundaries.
function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning, Doug";
  if (hour < 17) return "Good Afternoon, Doug";
  return "Good Evening, Doug";
}

function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getCoachMessage(
  timeOfDay: string,
  caloriesConsumed: number,
  calorieTarget: number,
  hasWorkedOut: boolean,
  hasLoggedWeight: boolean,
  mobilityDone: boolean,
): string {
  const hour = new Date().getHours();
  if (hour < 8 && !hasLoggedWeight) return "Start your day right -- step on the scale before breakfast.";
  if (hour < 10 && hasLoggedWeight && caloriesConsumed === 0) return "Weight logged. Time for coffee and your banana -- fuel up.";
  if (timeOfDay === "morning" && !hasWorkedOut) return "You have a window this morning. How about 30 min on the AMT?";
  if (timeOfDay === "afternoon" && !hasWorkedOut) return "Still time for your workout today. Even 20 minutes counts.";
  if (timeOfDay === "afternoon" && hasWorkedOut && !mobilityDone) return "Great workout. Now do your 5-min hip and back stretches.";
  if (caloriesConsumed > calorieTarget * 0.85) return "You're close to your calorie limit. Be mindful with your next meal.";
  if (timeOfDay === "evening" && hasWorkedOut && mobilityDone) return "Solid day, Doug. Log dinner and let's wrap up strong.";
  if (timeOfDay === "evening") return "How's the day going? Let's review and plan for tomorrow.";
  return "You're building momentum. Keep it up -- consistency wins.";
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
  const [hasMeals, setHasMeals] = useState(false);
  const [goalWeight, setGoalWeight] = useState(185);
  const [startWeight, setStartWeight] = useState(220);

  const loadDashboardData = useCallback(async () => {
    const today = getToday();
    const { start: todayStart, end: todayEnd } = getTodayRange();

    try {
      // Load today's food logs
      const { data: foodLogs } = await db
        .from("food_logs")
        .select("*")
        .gte("timestamp", todayStart)
        .lte("timestamp", todayEnd)
        .order("timestamp", { ascending: true });

      if (foodLogs) {
        setTodayFoodLogs(foodLogs as FoodLog[]);
        setHasMeals(foodLogs.length > 0);
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
        .gte("timestamp", todayStart)
        .lte("timestamp", todayEnd);

      if (waterLogs) {
        setWaterOz(
          waterLogs.reduce((sum: number, log: WaterLog) => sum + (log.amount_oz || 0), 0)
        );
      }

      // Load streak and trigger check-in (updates streak based on today's activity)
      try {
        const streakRes = await fetch("/api/streaks/check-in", { method: "POST" });
        if (streakRes.ok) {
          const sr = await streakRes.json();
          setStreak({
            id: "",
            current_streak: sr.current_streak,
            longest_streak: sr.longest_streak,
            last_check_in_date: sr.last_check_in_date,
            streak_freezes_remaining: 0,
            streak_freezes_used: 0,
          });
        }
      } catch {
        // Fallback: read streak directly
        const { data: streakData } = await db.from("streaks").select("*").limit(1).single();
        if (streakData) setStreak(streakData as Streak);
      }

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
        .gte("timestamp", todayStart)
        .lte("timestamp", todayEnd)
        .limit(1);

      setHasLoggedWeight(!!todayWeight && todayWeight.length > 0);

      // Load today's workouts
      const { data: workouts } = await db
        .from("workouts")
        .select("*")
        .gte("timestamp", todayStart)
        .lte("timestamp", todayEnd);

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

  // Load configurable goal/start weight
  useEffect(() => {
    const savedStart = localStorage.getItem("startWeight");
    if (savedStart && !isNaN(parseFloat(savedStart))) setStartWeight(parseFloat(savedStart));

    db.from("profiles").select("goal_weight").limit(1).single().then(({ data }) => {
      if (data && (data as { goal_weight: number }).goal_weight) {
        setGoalWeight(Number((data as { goal_weight: number }).goal_weight));
      }
    });
  }, []);

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
      setHasMeals(true);
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
  const poundsLost = currentWeight ? startWeight - currentWeight : 0;
  const poundsToGo = currentWeight ? currentWeight - goalWeight : startWeight - goalWeight;
  const totalCaloriesBurned = todayWorkouts.reduce((sum, w) => sum + w.calories_burned, 0);
  const timeOfDay = getTimeOfDay();

  // Macro targets (30/40/30 of 1800 cal)
  const proteinTarget = 135; // (1800 * 0.30) / 4
  const carbsTarget = 180; // (1800 * 0.40) / 4
  const fatTarget = 60; // (1800 * 0.30) / 9

  // Build the daily action plan -- ordered steps for the day
  const dailyActions = [
    {
      id: "weight",
      icon: "⚖️",
      label: "Log morning weight",
      done: hasLoggedWeight,
      href: "/track?type=weight",
    },
    {
      id: "breakfast",
      icon: "🌅",
      label: "Log breakfast",
      done: todayFoodLogs.some((l) => l.meal_type === "breakfast"),
      href: "/track",
    },
    {
      id: "workout",
      icon: "🏃",
      label: "AMT 885 workout",
      done: todayWorkouts.length > 0,
      href: "/track?type=workout",
    },
    {
      id: "mobility",
      icon: "🧘",
      label: "Mobility stretches",
      done: mobilityDone,
      href: "/track?type=mobility",
    },
    {
      id: "lunch",
      icon: "☀️",
      label: "Log lunch",
      done: todayFoodLogs.some((l) => l.meal_type === "lunch"),
      href: "/track",
    },
    {
      id: "water",
      icon: "💧",
      label: `Drink ${waterGoal}oz water`,
      done: waterOz >= waterGoal,
      href: "#water",
    },
    {
      id: "dinner",
      icon: "🌙",
      label: "Log dinner",
      done: todayFoodLogs.some((l) => l.meal_type === "dinner"),
      href: "/track",
    },
    {
      id: "review",
      icon: "📊",
      label: "Daily review with coach",
      done: false, // always available in evening
      href: "/coach?tab=daily",
    },
  ];

  const completedCount = dailyActions.filter((a) => a.done).length;
  const nextUndone = dailyActions.find((a) => !a.done);
  const dayProgress = (completedCount / dailyActions.length) * 100;

  const coachMessage = getCoachMessage(
    timeOfDay,
    caloriesConsumed,
    calorieTarget,
    todayWorkouts.length > 0,
    hasLoggedWeight,
    mobilityDone,
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{getGreeting()}</h1>
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
              <span className="text-sm">🔥</span>
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

      {/* AI Coach Card -- prominent at top */}
      <Link
        href="/coach"
        className="block bg-gradient-to-br from-purple-600/90 via-indigo-600/90 to-blue-600/90 border border-purple-500/20 rounded-2xl p-4 mb-5 card-press shadow-lg shadow-purple-900/20"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-purple-200" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-white text-sm">AI Coach</p>
              <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
            <p className="text-sm text-purple-100/80 leading-snug">
              {coachMessage}
            </p>
          </div>
        </div>
      </Link>

      {/* Daily Action Plan */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Today&apos;s Plan
          </h2>
          <span className="text-xs text-slate-500">{completedCount}/{dailyActions.length} done</span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-slate-700/50 rounded-full h-1.5 mb-3">
          <div
            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${dayProgress}%` }}
          />
        </div>
        {/* Action steps */}
        <div className="bg-[var(--card)] rounded-xl overflow-hidden divide-y divide-slate-700/50">
          {dailyActions.map((action) => {
            const isNext = nextUndone?.id === action.id;
            return (
              <Link
                key={action.id}
                href={action.href}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isNext
                    ? "bg-sky-500/10"
                    : action.done
                      ? "opacity-60"
                      : "hover:bg-slate-700/30"
                }`}
              >
                {/* Status indicator */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                    action.done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isNext
                        ? "bg-sky-500/20 border-2 border-sky-400 text-sky-400"
                        : "bg-slate-700/50 text-slate-500"
                  }`}
                >
                  {action.done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : isNext ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <span className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
                  )}
                </div>

                <span className="text-lg">{action.icon}</span>
                <span
                  className={`flex-1 text-sm ${
                    action.done
                      ? "text-slate-500 line-through"
                      : isNext
                        ? "text-white font-medium"
                        : "text-slate-300"
                  }`}
                >
                  {action.label}
                </span>

                {isNext && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                    Next
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

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
        <Link href="/track?type=weight" className="bg-[var(--card)] rounded-xl p-3 text-center card-press hover:border-slate-500 transition-colors">
          <p className="text-xs text-slate-400 mb-1">Weight</p>
          <p className="text-lg font-bold">{currentWeight ? `${currentWeight}` : "---"}</p>
          <p className="text-[10px] text-slate-500">{poundsToGo > 0 ? `${poundsToGo.toFixed(1)} to go` : "Goal!"}</p>
        </Link>
        <Link href="/track?type=workout" className="bg-[var(--card)] rounded-xl p-3 text-center card-press hover:border-slate-500 transition-colors">
          <p className="text-xs text-slate-400 mb-1">Workouts</p>
          <p className="text-lg font-bold">{todayWorkouts.length}</p>
          <p className="text-[10px] text-slate-500">{totalCaloriesBurned > 0 ? `${totalCaloriesBurned} cal` : "today"}</p>
        </Link>
        <Link href="/track?type=mobility" className="bg-[var(--card)] rounded-xl p-3 text-center card-press hover:border-slate-500 transition-colors">
          <p className="text-xs text-slate-400 mb-1">Mobility</p>
          <p className="text-lg font-bold">{mobilityDone ? "✓" : "—"}</p>
          <p className="text-[10px] text-slate-500">{mobilityDone ? "done" : "pending"}</p>
        </Link>
      </div>

      {/* Water Tracker */}
      <WaterTracker currentOz={waterOz} goalOz={waterGoal} onAddWater={addWater} />

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
      <div className="mb-6">
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
