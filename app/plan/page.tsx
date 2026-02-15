"use client";

import { useState, useEffect } from "react";
import { generateWeeklyPlan, generateGroceryList, type DayPlan, type MealTemplate } from "@/lib/mealPlanner";
import Link from "next/link";

export default function PlanPage() {
  const [tab, setTab] = useState<"meals" | "grocery" | "workouts" | "targets">("meals");
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>([]);
  const [groceryList, setGroceryList] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // Generate plan on load
    const plan = generateWeeklyPlan(0);
    setWeekPlan(plan);
    setGroceryList(generateGroceryList(plan));
  }, []);

  const regeneratePlan = async () => {
    setGenerating(true);
    // Try AI-generated plan
    try {
      const res = await fetch("/api/plan/generate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.plan && data.plan.length > 0) {
          setWeekPlan(data.plan);
          setGroceryList(generateGroceryList(data.plan));
          setGenerating(false);
          return;
        }
      }
    } catch {
      // Fall through to template rotation
    }
    // Fallback: rotate templates
    const offset = Math.floor(Math.random() * 5);
    const plan = generateWeeklyPlan(offset);
    setWeekPlan(plan);
    setGroceryList(generateGroceryList(plan));
    setGenerating(false);
  };

  const toggleGroceryItem = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  // Weekly targets
  const weeklyCalTarget = 1800;
  const proteinTarget = 135;
  const carbsTarget = 180;
  const fatTarget = 60;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Plan</h1>
          <p className="text-xs text-slate-400">Your week, pre-decided. Just execute.</p>
        </div>
        <button
          onClick={regeneratePlan}
          disabled={generating}
          className="bg-[var(--card)] border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:text-white transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 mb-5">
        {(["meals", "grocery", "workouts", "targets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
              tab === t ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "meals" ? "Meals" : t === "grocery" ? "Grocery" : t === "workouts" ? "Workouts" : "Targets"}
          </button>
        ))}
      </div>

      {/* MEALS TAB */}
      {tab === "meals" && (
        <div className="space-y-3">
          {weekPlan.map((day) => (
            <div key={day.day} className="bg-[var(--card)] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="font-semibold">{day.day}</p>
                  <p className="text-xs text-slate-400">{day.total_calories} cal · {day.total_protein_g}g protein</p>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${expandedDay === day.day ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {expandedDay === day.day && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
                  <MealCard meal={day.breakfast} label="Breakfast" icon="🌅" />
                  <MealCard meal={day.lunch} label="Lunch" icon="☀️" />
                  <MealCard meal={day.dinner} label="Dinner" icon="🌙" />
                </div>
              )}
            </div>
          ))}

          {weekPlan.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-slate-400 text-sm">Generating your meal plan...</p>
            </div>
          )}
        </div>
      )}

      {/* GROCERY TAB */}
      {tab === "grocery" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{groceryList.length} items · {checkedItems.size} checked</p>
            <button onClick={() => setCheckedItems(new Set())} className="text-xs text-sky-400 hover:text-sky-300">
              Reset
            </button>
          </div>
          <div className="bg-[var(--card)] rounded-xl divide-y divide-slate-700/50">
            {groceryList.map((item) => (
              <button
                key={item}
                onClick={() => toggleGroceryItem(item)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  checkedItems.has(item) ? "bg-green-600 border-green-600" : "border-slate-500"
                }`}>
                  {checkedItems.has(item) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${checkedItems.has(item) ? "text-slate-500 line-through" : "text-white"}`}>
                  {item}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WORKOUTS TAB */}
      {tab === "workouts" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 mb-2">
            Suggested workout schedule. Connect Google Calendar to auto-fill gaps.
          </p>

          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
            const isWorkoutDay = ["Monday", "Wednesday", "Friday"].includes(day);
            const isMobilityOnly = ["Tuesday", "Thursday"].includes(day);
            const isRest = ["Saturday", "Sunday"].includes(day);

            return (
              <div key={day} className={`bg-[var(--card)] rounded-xl p-4 flex items-center justify-between ${isRest ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {isWorkoutDay ? "🏃" : isMobilityOnly ? "🧘" : "😌"}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{day}</p>
                    <p className="text-xs text-slate-400">
                      {isWorkoutDay ? "AMT 885 (30-45 min) + Mobility" :
                       isMobilityOnly ? "Mobility routine (5-10 min)" :
                       "Rest & recovery"}
                    </p>
                  </div>
                </div>
                {!isRest && (
                  <Link href="/track?type=workout" className="text-xs text-sky-400 hover:text-sky-300">
                    Log
                  </Link>
                )}
              </div>
            );
          })}

          <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <p className="text-sm font-semibold text-purple-300">Google Calendar</p>
            </div>
            <p className="text-xs text-slate-400">
              Connect your calendar to auto-detect open slots around meetings and schedule workouts as private events.
            </p>
            <Link href="/settings" className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block">
              Set up in Settings →
            </Link>
          </div>
        </div>
      )}

      {/* TARGETS TAB */}
      {tab === "targets" && (
        <div className="space-y-4">
          <div className="bg-[var(--card)] rounded-xl p-5">
            <h2 className="font-semibold mb-4">Daily Targets</h2>
            <div className="space-y-4">
              <TargetRow label="Calories" value={weeklyCalTarget} unit="cal/day" icon="🔥" />
              <TargetRow label="Protein" value={proteinTarget} unit="g/day" icon="🥩" />
              <TargetRow label="Carbs" value={carbsTarget} unit="g/day" icon="🌾" />
              <TargetRow label="Fat" value={fatTarget} unit="g/day" icon="🥑" />
              <TargetRow label="Water" value={64} unit="oz/day" icon="💧" />
            </div>
          </div>

          <div className="bg-[var(--card)] rounded-xl p-5">
            <h2 className="font-semibold mb-4">Weekly Targets</h2>
            <div className="space-y-4">
              <TargetRow label="AMT 885 Sessions" value={3} unit="sessions" icon="🏃" />
              <TargetRow label="Mobility Routines" value={5} unit="sessions" icon="🧘" />
              <TargetRow label="Weight Loss Rate" value={1} unit="lb/week" icon="📉" />
              <TargetRow label="Weigh-ins" value={7} unit="daily" icon="⚖️" />
            </div>
          </div>

          <div className="bg-sky-900/20 border border-sky-700/30 rounded-xl p-4">
            <p className="text-xs text-sky-300">
              These targets auto-adjust based on your weekly trends. Your AI Coach will recommend changes during the Weekly Review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function MealCard({ meal, label, icon }: { meal: MealTemplate; label: string; icon: string }) {
  return (
    <div className="pt-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium">{meal.name}</p>
      <p className="text-xs text-slate-400 mt-0.5">
        {meal.calories} cal · {meal.protein_g}g P · {meal.carbs_g}g C · {meal.fat_g}g F
      </p>
      {meal.prep_notes && (
        <p className="text-xs text-slate-500 mt-1">{meal.prep_notes}</p>
      )}
      <div className="mt-2">
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer hover:text-slate-400">Ingredients</summary>
          <ul className="mt-1 space-y-0.5 pl-4 list-disc">
            {meal.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

function TargetRow({ label, value, unit, icon }: { label: string; value: number; unit: string; icon: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-xs text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}
