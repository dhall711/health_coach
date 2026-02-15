"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/db";
import type { Workout, WorkoutType } from "@/lib/types";

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [type, setType] = useState<WorkoutType>("amt885");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [notes, setNotes] = useState("");

  const loadWorkouts = useCallback(async () => {
    const { data } = await db
      .from("workouts")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(20);

    if (data) setWorkouts(data as Workout[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWorkouts();
    // Check URL for action
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "log") setShowForm(true);
  }, [loadWorkouts]);

  const saveWorkout = async () => {
    if (!duration) return;

    const { error } = await db.from("workouts").insert({
      type,
      duration_min: parseInt(duration),
      calories_burned: calories ? parseInt(calories) : 0,
      avg_hr: avgHr ? parseInt(avgHr) : null,
      notes: notes || null,
      source: "manual",
    });

    if (!error) {
      setShowForm(false);
      setDuration("");
      setCalories("");
      setAvgHr("");
      setNotes("");
      loadWorkouts();
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case "amt885": return "🏃‍♂️";
      case "mobility": return "🧘";
      case "flexibility": return "🤸";
      case "walk": return "🚶";
      default: return "💪";
    }
  };

  const getTypeLabel = (t: string) => {
    switch (t) {
      case "amt885": return "AMT 885";
      case "mobility": return "Mobility";
      case "flexibility": return "Flexibility";
      case "walk": return "Walk";
      default: return "Other";
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Workouts</h1>
          <p className="text-xs text-slate-400">Track your exercise sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 text-sm">← Home</a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            + Log
          </button>
        </div>
      </div>

      {/* Log Form */}
      {showForm && (
        <div className="bg-[var(--card)] border border-slate-600 rounded-xl p-4 mb-4">
          <h2 className="font-semibold mb-3">Log Workout</h2>

          {/* Type */}
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1 block">Type</label>
            <div className="flex flex-wrap gap-2">
              {(["amt885", "mobility", "flexibility", "walk", "other"] as WorkoutType[]).map(
                (wt) => (
                  <button
                    key={wt}
                    onClick={() => setType(wt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      type === wt
                        ? "bg-[var(--accent)] text-white"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {getTypeIcon(wt)} {getTypeLabel(wt)}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1 block">Duration (minutes)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 35"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Calories */}
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1 block">Calories Burned (optional)</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="e.g. 350"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Avg HR */}
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1 block">Avg Heart Rate (optional)</label>
            <input
              type="number"
              value={avgHr}
              onChange={(e) => setAvgHr(e.target.value)}
              placeholder="e.g. 135"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Felt good, moderate effort"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveWorkout}
              className="flex-1 bg-[var(--success)] text-white py-2.5 rounded-lg font-semibold active:opacity-80"
            >
              Save Workout
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="bg-slate-700 text-slate-300 px-4 py-2.5 rounded-lg active:opacity-80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workout History */}
      {loading ? (
        <p className="text-center text-slate-400 py-8">Loading...</p>
      ) : workouts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">💪</p>
          <p className="text-slate-400">No workouts logged yet</p>
          <p className="text-xs text-slate-500 mt-1">Tap &quot;+ Log&quot; to record your first workout</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workouts.map((w) => (
            <div key={w.id} className="bg-[var(--card)] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getTypeIcon(w.type)}</span>
                  <div>
                    <p className="text-sm font-medium">{getTypeLabel(w.type)}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(w.timestamp).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {w.duration_min} min
                      {w.avg_hr && ` · ${w.avg_hr} bpm`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{w.calories_burned} cal</p>
                  <p className="text-xs text-slate-400">{w.source}</p>
                </div>
              </div>
              {w.notes && (
                <p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">
                  {w.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
