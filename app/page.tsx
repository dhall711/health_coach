"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import CalorieBudgetBar from "@/components/CalorieBudgetBar";
import WaterTracker from "@/components/WaterTracker";
import StreakDisplay from "@/components/StreakDisplay";
import MotivationBanner from "@/components/MotivationBanner";
import type { FoodLog, Workout, WaterLog, Streak, WeightLog } from "@/lib/types";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function Dashboard() {
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieTarget] = useState(1800);
  const [waterOz, setWaterOz] = useState(0);
  const [waterGoal] = useState(64);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [todayWorkouts, setTodayWorkouts] = useState<Workout[]>([]);
  const [todayFoodLogs, setTodayFoodLogs] = useState<FoodLog[]>([]);
  const [mobilityDone, setMobilityDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    const today = getToday();

    try {
      // Load today's food logs
      const { data: foodLogs } = await supabase
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
      }

      // Load today's water
      const { data: waterLogs } = await supabase
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
      const { data: streakData } = await supabase
        .from("streaks")
        .select("*")
        .limit(1)
        .single();

      if (streakData) {
        setStreak(streakData as Streak);
      }

      // Load latest weight
      const { data: weightData } = await supabase
        .from("weight_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (weightData) {
        setCurrentWeight((weightData as WeightLog).weight);
      }

      // Load today's workouts
      const { data: workouts } = await supabase
        .from("workouts")
        .select("*")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`);

      if (workouts) {
        setTodayWorkouts(workouts as Workout[]);
      }

      // Check mobility
      const { data: mobilityData } = await supabase
        .from("mobility_logs")
        .select("id")
        .eq("date", today)
        .limit(1);

      setMobilityDone(!!mobilityData && mobilityData.length > 0);
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
    const { error } = await supabase
      .from("water_logs")
      .insert({ amount_oz: oz });

    if (!error) {
      setWaterOz((prev) => prev + oz);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💪</div>
          <p className="text-slate-400">Loading your dashboard...</p>
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

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Health Tracker</h1>
          <p className="text-sm text-slate-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <a href="/settings" className="text-2xl">⚙️</a>
      </div>

      {/* Motivation Banner */}
      <MotivationBanner poundsLost={poundsLost} poundsToGo={poundsToGo} />

      {/* Calorie Budget Bar */}
      <CalorieBudgetBar
        consumed={caloriesConsumed}
        target={calorieTarget}
        burned={totalCaloriesBurned}
      />

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Weight Card */}
        <a href="/progress" className="bg-[var(--card)] rounded-xl p-3 text-center card-press">
          <p className="text-xs text-slate-400 mb-1">Weight</p>
          <p className="text-xl font-bold">
            {currentWeight ? `${currentWeight}` : "---"}
          </p>
          <p className="text-xs text-slate-400">lbs</p>
        </a>

        {/* Workouts Card */}
        <a href="/workouts" className="bg-[var(--card)] rounded-xl p-3 text-center card-press">
          <p className="text-xs text-slate-400 mb-1">Workouts</p>
          <p className="text-xl font-bold">{todayWorkouts.length}</p>
          <p className="text-xs text-slate-400">today</p>
        </a>

        {/* Mobility Card */}
        <a href="/mobility" className="bg-[var(--card)] rounded-xl p-3 text-center card-press">
          <p className="text-xs text-slate-400 mb-1">Mobility</p>
          <p className="text-xl font-bold">{mobilityDone ? "✅" : "—"}</p>
          <p className="text-xs text-slate-400">{mobilityDone ? "done" : "pending"}</p>
        </a>
      </div>

      {/* Water Tracker */}
      <WaterTracker currentOz={waterOz} goalOz={waterGoal} onAddWater={addWater} />

      {/* Streak Display */}
      <StreakDisplay streak={streak} />

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <a
            href="/food"
            className="bg-[var(--accent)] text-white rounded-xl p-4 text-center font-semibold card-press flex items-center justify-center gap-2"
          >
            <span className="text-xl">📸</span> Snap Food Photo
          </a>
          <a
            href="/food?mode=voice"
            className="bg-[var(--card)] border border-slate-600 rounded-xl p-4 text-center font-semibold card-press flex items-center justify-center gap-2"
          >
            <span className="text-xl">🎤</span> Voice Log
          </a>
          <a
            href="/food?mode=favorites"
            className="bg-[var(--card)] border border-slate-600 rounded-xl p-4 text-center font-semibold card-press flex items-center justify-center gap-2"
          >
            <span className="text-xl">⭐</span> Quick Log
          </a>
          <a
            href="/workouts?action=log"
            className="bg-[var(--card)] border border-slate-600 rounded-xl p-4 text-center font-semibold card-press flex items-center justify-center gap-2"
          >
            <span className="text-xl">🏋️</span> Log Workout
          </a>
        </div>
      </div>

      {/* Today's Food Log Summary */}
      {todayFoodLogs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Today&apos;s Food Log
          </h2>
          <div className="space-y-2">
            {todayFoodLogs.map((log) => (
              <div
                key={log.id}
                className="bg-[var(--card)] rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {log.meal_type === "breakfast"
                      ? "🌅"
                      : log.meal_type === "lunch"
                        ? "☀️"
                        : log.meal_type === "dinner"
                          ? "🌙"
                          : log.meal_type === "drink"
                            ? "🥤"
                            : "🍽️"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {log.items && Array.isArray(log.items)
                        ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
                        : log.meal_type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold">{log.total_calories} cal</p>
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
            <span className="text-sm text-slate-400">
              {startWeight} lbs → {goalWeight} lbs
            </span>
            <span className="text-sm font-semibold text-[var(--accent)]">
              {poundsToGo > 0 ? `${poundsToGo} lbs to go` : "Goal reached! 🎉"}
            </span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="bg-[var(--accent)] h-3 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, (poundsLost / (startWeight - goalWeight)) * 100))}%`,
              }}
            />
          </div>
          {currentWeight && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Current: {currentWeight} lbs
              {poundsLost > 0 && ` (${poundsLost} lbs lost!)`}
            </p>
          )}
        </div>
      </div>

      {/* Coach Link */}
      <a
        href="/coach"
        className="block bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 mb-6 card-press"
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <div>
            <p className="font-semibold">AI Coach</p>
            <p className="text-sm text-purple-200">
              Get personalized advice, meal plans, and workout suggestions
            </p>
          </div>
        </div>
      </a>
    </div>
  );
}
