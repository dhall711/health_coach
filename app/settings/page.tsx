"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/types";

interface IntegrationStatus {
  connected: boolean;
  lastSync: { last_sync_at: string; status: string; records_synced: number } | null;
}

interface AllStatuses {
  google: IntegrationStatus;
  withings: IntegrationStatus;
  apple_health: IntegrationStatus;
  precor: IntegrationStatus;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Integration statuses
  const [integrations, setIntegrations] = useState<AllStatuses | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ provider: string; message: string; success: boolean } | null>(null);

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

  // Precor import state
  const [precorImporting, setPrecorImporting] = useState(false);
  const [precorResult, setPrecorResult] = useState<{
    success?: boolean;
    imported?: number;
    skipped?: number;
    total?: number;
    error?: string;
  } | null>(null);
  const precorFileRef = useRef<HTMLInputElement>(null);

  // Apple Health webhook secret display
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);

  // URL params for OAuth callbacks
  const [flashMessage, setFlashMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadProfile = useCallback(async () => {
    const { data } = await db
      .from("profiles")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      const p = data as Profile;
      if (p.target_date && p.target_date.includes("T")) {
        p.target_date = p.target_date.split("T")[0];
      }
      setProfile(p);
    }
    setLoading(false);
  }, []);

  const loadIntegrationStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data);
      }
    } catch (err) {
      console.error("Failed to load integration statuses:", err);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadIntegrationStatuses();

    // Check URL params for OAuth callback messages
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    if (success) {
      const messages: Record<string, string> = {
        google_connected: "Google Calendar connected successfully!",
        withings_connected: "Withings Scale connected successfully!",
      };
      setFlashMessage({ type: "success", text: messages[success] || "Connected!" });
      loadIntegrationStatuses(); // Refresh statuses
      // Clean URL
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      const messages: Record<string, string> = {
        google_denied: "Google Calendar authorization was denied.",
        google_auth_failed: "Google Calendar setup failed. Check your credentials.",
        google_no_code: "Google Calendar authorization code missing.",
        google_token_failed: "Google Calendar token exchange failed.",
        withings_denied: "Withings authorization was denied.",
        withings_auth_failed: "Withings setup failed. Check your credentials.",
        withings_no_code: "Withings authorization code missing.",
        withings_token_failed: "Withings token exchange failed.",
      };
      setFlashMessage({ type: "error", text: messages[error] || "Connection failed." });
      window.history.replaceState({}, "", "/settings");
    }
  }, [loadProfile, loadIntegrationStatuses]);

  // Auto-dismiss flash messages
  useEffect(() => {
    if (flashMessage) {
      const t = setTimeout(() => setFlashMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [flashMessage]);

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePrecorImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrecorImporting(true);
    setPrecorResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/integrations/precor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: text }),
      });
      const result = await res.json();
      setPrecorResult(result);
    } catch {
      setPrecorResult({ error: "Failed to read or upload file." });
    } finally {
      setPrecorImporting(false);
      if (precorFileRef.current) precorFileRef.current.value = "";
    }
  };

  const handleDisconnect = async (provider: "google" | "withings") => {
    if (!confirm(`Disconnect ${provider === "google" ? "Google Calendar" : "Withings Scale"}?`)) return;
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: "POST" });
      loadIntegrationStatuses();
      setSyncResult({ provider, message: "Disconnected.", success: true });
    } catch {
      setSyncResult({ provider, message: "Failed to disconnect.", success: false });
    }
  };

  const handleSync = async (provider: "withings") => {
    setSyncing(provider);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult({
          provider,
          message: `Synced ${data.newRecords || 0} new records.`,
          success: true,
        });
        loadIntegrationStatuses();
      } else {
        setSyncResult({ provider, message: data.error || "Sync failed.", success: false });
      }
    } catch {
      setSyncResult({ provider, message: "Sync failed.", success: false });
    } finally {
      setSyncing(null);
    }
  };

  const formatLastSync = (lastSync: IntegrationStatus["lastSync"]) => {
    if (!lastSync) return null;
    const date = new Date(lastSync.last_sync_at);
    const ago = Math.round((Date.now() - date.getTime()) / 60000);
    if (ago < 1) return "Just now";
    if (ago < 60) return `${ago}m ago`;
    if (ago < 1440) return `${Math.round(ago / 60)}h ago`;
    return `${Math.round(ago / 1440)}d ago`;
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

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/integrations/apple-health/webhook`
    : "";

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Settings</h1>
        <Link href="/" className="text-slate-400 text-sm hover:text-white transition-colors">&larr; Back</Link>
      </div>

      {/* Flash messages from OAuth callbacks */}
      {flashMessage && (
        <div className={`rounded-xl p-3 mb-4 ${
          flashMessage.type === "success"
            ? "bg-emerald-900/30 border border-emerald-700/40 text-emerald-300"
            : "bg-red-900/30 border border-red-700/40 text-red-300"
        }`}>
          <p className="text-sm">{flashMessage.text}</p>
        </div>
      )}

      {saved && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-3 mb-4">
          <p className="text-sm text-emerald-300">Settings saved!</p>
        </div>
      )}

      {/* Profile Fields */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Display Name</label>
          <input type="text" value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Age</label>
            <input type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || 0 })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Height (inches)</label>
            <input type="number" value={profile.height_inches} onChange={(e) => setProfile({ ...profile, height_inches: parseFloat(e.target.value) || 0 })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Current Weight (lbs)</label>
            <input type="number" step="0.1" value={profile.current_weight} onChange={(e) => setProfile({ ...profile, current_weight: parseFloat(e.target.value) || 0 })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Goal Weight (lbs)</label>
            <input type="number" step="0.1" value={profile.goal_weight} onChange={(e) => setProfile({ ...profile, goal_weight: parseFloat(e.target.value) || 0 })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Target Date</label>
          <input type="date" value={profile.target_date} onChange={(e) => setProfile({ ...profile, target_date: e.target.value })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Daily Calorie Target</label>
            <input type="number" value={profile.daily_calorie_target} onChange={(e) => setProfile({ ...profile, daily_calorie_target: parseInt(e.target.value) || 0 })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Daily Water Goal (oz)</label>
            <input type="number" value={profile.daily_water_goal_oz} onChange={(e) => setProfile({ ...profile, daily_water_goal_oz: parseInt(e.target.value) || 0 })} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Preferred Workout Times</label>
          <input type="text" value={profile.preferred_workout_times} onChange={(e) => setProfile({ ...profile, preferred_workout_times: e.target.value })} placeholder="e.g. 11am-1pm, after 4pm" className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Medical Notes</label>
          <textarea value={profile.medical_notes} onChange={(e) => setProfile({ ...profile, medical_notes: e.target.value })} rows={3} className="w-full bg-[var(--card)] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>

      <button onClick={saveProfile} disabled={saving} className="w-full bg-[var(--accent)] text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:opacity-80 mb-6">
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* ============ INTEGRATIONS ============ */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Integrations
        </h2>
        <div className="space-y-3">

          {/* --- Google Calendar --- */}
          <div className="bg-[var(--card)] border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">📅</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Google Calendar</p>
                <p className="text-xs text-slate-400">Schedule workouts around your meetings</p>
              </div>
              {integrations?.google.connected ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">Connected</span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Not connected</span>
              )}
            </div>

            {integrations?.google.connected ? (
              <div>
                {integrations.google.lastSync && (
                  <p className="text-xs text-slate-500 mb-2">
                    Last sync: {formatLastSync(integrations.google.lastSync)} ({integrations.google.lastSync.records_synced} events)
                  </p>
                )}
                <button
                  onClick={() => handleDisconnect("google")}
                  className="w-full bg-slate-700 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Requires Google Cloud project with Calendar API enabled.
                </p>
                <a
                  href="/api/integrations/google/auth"
                  className="block w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold text-center active:opacity-80"
                >
                  Connect Google Calendar
                </a>
              </div>
            )}
            {syncResult?.provider === "google" && (
              <p className={`text-xs mt-2 ${syncResult.success ? "text-emerald-400" : "text-red-400"}`}>{syncResult.message}</p>
            )}
          </div>

          {/* --- Withings Scale --- */}
          <div className="bg-[var(--card)] border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">⚖️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Withings Scale</p>
                <p className="text-xs text-slate-400">Auto-sync weight and body fat data</p>
              </div>
              {integrations?.withings.connected ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">Connected</span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Not connected</span>
              )}
            </div>

            {integrations?.withings.connected ? (
              <div>
                {integrations.withings.lastSync && (
                  <p className="text-xs text-slate-500 mb-2">
                    Last sync: {formatLastSync(integrations.withings.lastSync)} ({integrations.withings.lastSync.records_synced} records)
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSync("withings")}
                    disabled={syncing === "withings"}
                    className="flex-1 bg-sky-600 text-white py-2 rounded-lg text-sm font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {syncing === "withings" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync Now"
                    )}
                  </button>
                  <button
                    onClick={() => handleDisconnect("withings")}
                    className="bg-slate-700 text-slate-300 py-2 px-4 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Requires a Withings developer app at developer.withings.com.
                </p>
                <a
                  href="/api/integrations/withings/auth"
                  className="block w-full bg-teal-600 text-white py-2.5 rounded-lg text-sm font-semibold text-center active:opacity-80"
                >
                  Connect Withings
                </a>
              </div>
            )}
            {syncResult?.provider === "withings" && (
              <p className={`text-xs mt-2 ${syncResult.success ? "text-emerald-400" : "text-red-400"}`}>{syncResult.message}</p>
            )}
          </div>

          {/* --- Apple Health --- */}
          <div className="bg-[var(--card)] border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">❤️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Apple Health</p>
                <p className="text-xs text-slate-400">Steps, heart rate, sleep via Health Auto Export app</p>
              </div>
              {integrations?.apple_health.lastSync ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">Receiving</span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Not set up</span>
              )}
            </div>

            {integrations?.apple_health.lastSync && (
              <p className="text-xs text-slate-500 mb-2">
                Last data: {formatLastSync(integrations.apple_health.lastSync)}
              </p>
            )}

            <button
              onClick={() => setShowWebhookUrl(!showWebhookUrl)}
              className="w-full bg-slate-700 text-slate-300 py-2 rounded-lg text-sm hover:bg-slate-600 transition-colors mb-2"
            >
              {showWebhookUrl ? "Hide Setup Instructions" : "Show Setup Instructions"}
            </button>

            {showWebhookUrl && (
              <div className="text-xs text-slate-500 bg-slate-800 rounded-lg p-3 space-y-2">
                <p className="font-medium text-slate-400">Setup with Health Auto Export app:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Install <a href="https://apps.apple.com/us/app/health-auto-export-json-csv/id1115567069" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline">Health Auto Export</a> from the App Store</li>
                  <li>Create a new REST API automation</li>
                  <li>Set URL to:</li>
                </ol>
                <div className="bg-slate-900 rounded p-2 font-mono text-[10px] text-sky-300 break-all">
                  {webhookUrl}
                </div>
                <p>4. Add header: <code className="text-sky-300">Authorization: Bearer YOUR_SECRET</code></p>
                <p>5. Set the <code className="text-sky-300">APPLE_HEALTH_WEBHOOK_SECRET</code> env var on Vercel to match</p>
                <p>6. Select metrics: Steps, Active Energy, Resting Heart Rate, Sleep Analysis</p>
                <p>7. Set format to JSON, frequency to hourly</p>
              </div>
            )}
          </div>

          {/* --- Precor Preva --- */}
          <div className="bg-[var(--card)] border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">🏃</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Precor Preva</p>
                <p className="text-xs text-slate-400">Import AMT 885 workout data</p>
              </div>
              {integrations?.precor.lastSync ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full">Imported</span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">No data</span>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-2">
              Export workout history from my.preva.com as CSV, then upload here.
              Format: Date, Duration (min), Calories, Avg HR, Distance
            </p>

            <input type="file" accept=".csv,.txt" ref={precorFileRef} onChange={handlePrecorImport} className="hidden" />

            <button
              onClick={() => precorFileRef.current?.click()}
              disabled={precorImporting}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg text-sm font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {precorImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload Preva CSV
                </>
              )}
            </button>

            {precorResult && (
              <div className={`mt-2 rounded-lg p-2.5 text-xs ${
                precorResult.success
                  ? "bg-green-900/30 border border-green-700/40 text-green-300"
                  : "bg-red-900/30 border border-red-700/40 text-red-300"
              }`}>
                {precorResult.success
                  ? `Imported ${precorResult.imported} workouts (${precorResult.skipped} skipped).`
                  : precorResult.error || "Import failed."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ DATA IMPORT ============ */}
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
              <p className="text-xs text-slate-400">Import historical weight data from trendweight.com</p>
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

          <input type="file" accept=".csv,.txt" ref={fileInputRef} onChange={handleTrendWeightImport} className="hidden" />

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
                  {importResult.skipped ? <p className="text-xs">{importResult.skipped} rows skipped</p> : null}
                  {importResult.dateRange && (
                    <p className="text-xs mt-1">Range: {importResult.dateRange.earliest} to {importResult.dateRange.latest}</p>
                  )}
                </div>
              ) : (
                <p>{importResult.error || "Import failed."}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
