"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .limit(1)
      .single();

    if (data) setProfile(data as Profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        age: profile.age,
        height_inches: profile.height_inches,
        current_weight: profile.current_weight,
        goal_weight: profile.goal_weight,
        target_date: profile.target_date,
        daily_calorie_target: profile.daily_calorie_target,
        daily_water_goal_oz: profile.daily_water_goal_oz,
        preferred_workout_times: profile.preferred_workout_times,
        medical_notes: profile.medical_notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 safe-top">
        <p className="text-center text-slate-400 py-8">Loading settings...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 safe-top">
        <p className="text-center text-slate-400 py-8">
          No profile found. Run the database seed script first.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Settings</h1>
        <a href="/" className="text-slate-400 text-sm">← Home</a>
      </div>

      {saved && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-3 mb-4">
          <p className="text-sm text-emerald-300">✅ Settings saved!</p>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {/* Name */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Display Name</label>
          <input
            type="text"
            value={profile.display_name}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
            className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Age */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Age</label>
            <input
              type="number"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || 0 })}
              className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Height (inches)</label>
            <input
              type="number"
              value={profile.height_inches}
              onChange={(e) => setProfile({ ...profile, height_inches: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Weight Goals */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Current Weight (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={profile.current_weight}
              onChange={(e) => setProfile({ ...profile, current_weight: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Goal Weight (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={profile.goal_weight}
              onChange={(e) => setProfile({ ...profile, goal_weight: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Target Date */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Target Date</label>
          <input
            type="date"
            value={profile.target_date}
            onChange={(e) => setProfile({ ...profile, target_date: e.target.value })}
            className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Daily Targets */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Daily Calorie Target</label>
            <input
              type="number"
              value={profile.daily_calorie_target}
              onChange={(e) => setProfile({ ...profile, daily_calorie_target: parseInt(e.target.value) || 0 })}
              className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Daily Water Goal (oz)</label>
            <input
              type="number"
              value={profile.daily_water_goal_oz}
              onChange={(e) => setProfile({ ...profile, daily_water_goal_oz: parseInt(e.target.value) || 0 })}
              className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Preferred Workout Times */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Preferred Workout Times</label>
          <input
            type="text"
            value={profile.preferred_workout_times}
            onChange={(e) => setProfile({ ...profile, preferred_workout_times: e.target.value })}
            placeholder="e.g. 11am-1pm, after 4pm"
            className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Medical Notes */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Medical Notes</label>
          <textarea
            value={profile.medical_notes}
            onChange={(e) => setProfile({ ...profile, medical_notes: e.target.value })}
            rows={3}
            className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:opacity-80 mb-6"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* Integrations Section (placeholder for Phase 2) */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Integrations (Coming Soon)
        </h2>
        <div className="space-y-2">
          {[
            { name: "Google Calendar", icon: "📅", status: "Not connected" },
            { name: "Withings Scale", icon: "⚖️", status: "Not connected" },
            { name: "Apple Health", icon: "❤️", status: "Not connected" },
            { name: "Precor Preva", icon: "🏃‍♂️", status: "Not connected" },
          ].map((integration) => (
            <div
              key={integration.name}
              className="bg-[var(--card)] rounded-lg px-4 py-3 flex items-center justify-between opacity-60"
            >
              <div className="flex items-center gap-3">
                <span>{integration.icon}</span>
                <span className="text-sm">{integration.name}</span>
              </div>
              <span className="text-xs text-slate-400">{integration.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
