"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { WeightLog } from "@/lib/types";

export default function ProgressPage() {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [showLogForm, setShowLogForm] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [loading, setLoading] = useState(true);

  const goalWeight = 185;
  const startWeight = 220;

  const loadData = useCallback(async () => {
    const { data: weights } = await supabase
      .from("weight_logs")
      .select("*")
      .order("timestamp", { ascending: true })
      .limit(100);

    if (weights) setWeightLogs(weights as WeightLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveWeight = async () => {
    if (!newWeight) return;

    const weight = parseFloat(newWeight);
    const heightInches = 69;
    const bmi = Math.round((weight / (heightInches * heightInches)) * 703 * 10) / 10;

    const { error } = await supabase.from("weight_logs").insert({
      weight,
      bmi,
      source: "manual",
    });

    if (!error) {
      setNewWeight("");
      setShowLogForm(false);
      loadData();
    }
  };

  const latestWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : null;
  const poundsLost = latestWeight ? startWeight - latestWeight : 0;
  const poundsToGo = latestWeight ? latestWeight - goalWeight : startWeight - goalWeight;
  const progressPct = Math.min(100, Math.max(0, (poundsLost / (startWeight - goalWeight)) * 100));

  // Simple weight chart using divs
  const maxWeight = Math.max(startWeight + 5, ...weightLogs.map((w) => w.weight));
  const minWeight = Math.min(goalWeight - 5, ...weightLogs.map((w) => w.weight));
  const range = maxWeight - minWeight;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Progress</h1>
          <p className="text-xs text-slate-400">Track your weight loss journey</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 text-sm">← Home</a>
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            + Weight
          </button>
        </div>
      </div>

      {/* Weight Log Form */}
      {showLogForm && (
        <div className="bg-[var(--card)] border border-slate-600 rounded-xl p-4 mb-4">
          <h2 className="font-semibold mb-3">Log Weight</h2>
          <input
            type="number"
            step="0.1"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Enter weight in lbs"
            className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={saveWeight}
              className="flex-1 bg-[var(--success)] text-white py-2 rounded-lg font-semibold active:opacity-80"
            >
              Save
            </button>
            <button
              onClick={() => setShowLogForm(false)}
              className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg active:opacity-80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Goal Summary Card */}
      <div className="bg-[var(--card)] rounded-xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <p className="text-xs text-slate-400">Start</p>
            <p className="text-lg font-bold">{startWeight}</p>
            <p className="text-xs text-slate-400">lbs</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Current</p>
            <p className="text-lg font-bold text-[var(--accent)]">
              {latestWeight ?? "---"}
            </p>
            <p className="text-xs text-slate-400">lbs</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Goal</p>
            <p className="text-lg font-bold text-[var(--success)]">{goalWeight}</p>
            <p className="text-xs text-slate-400">lbs</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-700 rounded-full h-3 mb-2">
          <div
            className="bg-gradient-to-r from-[var(--accent)] to-[var(--success)] h-3 rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400">
          <span>{poundsLost > 0 ? `${poundsLost.toFixed(1)} lbs lost` : "Getting started"}</span>
          <span>{poundsToGo > 0 ? `${poundsToGo.toFixed(1)} lbs to go` : "Goal reached!"}</span>
        </div>
      </div>

      {/* Weight Chart (simple bar visualization) */}
      {!loading && weightLogs.length > 0 && (
        <div className="bg-[var(--card)] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Weight Trend
          </h2>
          <div className="relative h-40 flex items-end gap-1">
            {/* Goal line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-[var(--success)]/50"
              style={{
                bottom: `${((goalWeight - minWeight) / range) * 100}%`,
              }}
            >
              <span className="text-[10px] text-[var(--success)] absolute -top-3 right-0">
                {goalWeight} goal
              </span>
            </div>

            {weightLogs.slice(-30).map((w, i) => {
              const height = ((w.weight - minWeight) / range) * 100;
              const isLatest = i === weightLogs.slice(-30).length - 1;
              return (
                <div
                  key={w.id}
                  className="flex-1 min-w-[4px] rounded-t transition-all duration-300"
                  style={{
                    height: `${height}%`,
                    backgroundColor: isLatest
                      ? "var(--accent)"
                      : w.weight <= goalWeight
                        ? "var(--success)"
                        : "var(--muted)",
                  }}
                  title={`${w.weight} lbs - ${new Date(w.timestamp).toLocaleDateString()}`}
                />
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Last {Math.min(30, weightLogs.length)} weigh-ins
          </p>
        </div>
      )}

      {/* Weight History */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Recent Weigh-ins
        </h2>
        {loading ? (
          <p className="text-center text-slate-400 py-4">Loading...</p>
        ) : weightLogs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">⚖️</p>
            <p className="text-slate-400">No weights logged yet</p>
            <p className="text-xs text-slate-500 mt-1">Tap &quot;+ Weight&quot; to log your first weigh-in</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...weightLogs]
              .reverse()
              .slice(0, 10)
              .map((w, i) => {
                const prev = [...weightLogs].reverse()[i + 1];
                const diff = prev ? w.weight - prev.weight : 0;
                return (
                  <div key={w.id} className="bg-[var(--card)] rounded-lg px-4 py-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{w.weight} lbs</p>
                      <p className="text-xs text-slate-400">
                        {new Date(w.timestamp).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {w.bmi && ` · BMI ${w.bmi}`}
                      </p>
                    </div>
                    {diff !== 0 && (
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          diff < 0
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-red-900/40 text-red-300"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
