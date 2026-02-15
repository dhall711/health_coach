"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // TrendWeight import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success?: boolean;
    imported?: number;
    skipped?: number;
    errors?: number;
    dateRange?: { earliest: string; latest: string };
    error?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = useCallback(async () => {
    const { data } = await db
      .from("profiles")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      const p = data as Profile;
      // Neon may return DATE columns as ISO timestamps -- normalize to YYYY-MM-DD
      if (p.target_date && p.target_date.includes("T")) {
        p.target_date = p.target_date.split("T")[0];
      }
      setProfile(p);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);

    const { error } = await db
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

  // TrendWeight CSV import handler
  const handleTrendWeightImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();

      const res = await fetch("/api/import/trendweight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: text }),
      });

      const result = await res.json();
      setImportResult(result);
    } catch {
      setImportResult({ error: "Failed to read or upload file." });
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        <Link href="/" className="text-slate-400 text-sm hover:text-white transition-colors">← Back</Link>
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

      {/* Data Import Section */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Data Import
        </h2>

        {/* TrendWeight Import */}
        <div className="bg-[var(--card)] border border-slate-700 rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xl">📈</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">TrendWeight</p>
              <p className="text-xs text-slate-400">Import your historical weight data from trendweight.com</p>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-800 rounded-lg p-3 mb-3">
            <p className="font-medium text-slate-400 mb-1">How to export:</p>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Go to <a href="https://trendweight.com/export/" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 underline">trendweight.com/export</a></li>
              <li>Sign in if needed</li>
              <li>Download the CSV file</li>
              <li>Upload it here</li>
            </ol>
          </div>

          <input
            type="file"
            accept=".csv,.txt"
            ref={fileInputRef}
            onChange={handleTrendWeightImport}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full bg-sky-600 text-white py-2.5 rounded-lg text-sm font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Upload TrendWeight CSV
              </>
            )}
          </button>

          {/* Import Result */}
          {importResult && (
            <div className={`mt-3 rounded-lg p-3 text-sm ${
              importResult.success
                ? "bg-green-900/30 border border-green-700/40 text-green-300"
                : "bg-red-900/30 border border-red-700/40 text-red-300"
            }`}>
              {importResult.success ? (
                <div>
                  <p className="font-semibold mb-1">Import successful!</p>
                  <p className="text-xs">{importResult.imported} weight entries imported</p>
                  {importResult.skipped ? <p className="text-xs">{importResult.skipped} rows skipped (empty/invalid)</p> : null}
                  {importResult.dateRange && (
                    <p className="text-xs mt-1">
                      Date range: {importResult.dateRange.earliest} to {importResult.dateRange.latest}
                    </p>
                  )}
                  <p className="text-xs mt-1 text-green-400">
                    Your Insights tab now has 2 years of trend data!
                  </p>
                </div>
              ) : (
                <p>{importResult.error || "Import failed. Please check your file format."}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Integrations Section */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Integrations
        </h2>
        <div className="space-y-2">
          {[
            { name: "Google Calendar", icon: "📅", status: "Not connected", desc: "Schedule workouts around meetings" },
            { name: "Withings Scale", icon: "⚖️", status: "Not connected", desc: "Auto-sync weight data" },
            { name: "Apple Health", icon: "❤️", status: "Not connected", desc: "Steps, heart rate, sleep" },
            { name: "Precor Preva", icon: "🏃", status: "Not connected", desc: "AMT 885 workout data" },
          ].map((integration) => (
            <div
              key={integration.name}
              className="bg-[var(--card)] rounded-xl px-4 py-3 flex items-center justify-between opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{integration.icon}</span>
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-[10px] text-slate-500">{integration.desc}</p>
                </div>
              </div>
              <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{integration.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
