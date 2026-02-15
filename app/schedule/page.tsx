"use client";

export default function SchedulePage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Workout Schedule</h1>
          <p className="text-xs text-slate-400">
            Plan workouts around your meetings
          </p>
        </div>
        <a href="/" className="text-slate-400 text-sm">← Home</a>
      </div>

      {/* Placeholder until Google Calendar integration (Phase 2) */}
      <div className="text-center py-16">
        <p className="text-5xl mb-4">📅</p>
        <h2 className="text-lg font-semibold mb-2">Coming in Phase 2</h2>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Google Calendar integration will show your meetings and suggest optimal
          workout windows throughout the day.
        </p>
        <div className="mt-6 space-y-3 text-left max-w-xs mx-auto">
          <div className="bg-[var(--card)] rounded-lg p-3 border border-slate-700 opacity-50">
            <p className="text-xs text-slate-400">9:00 - 10:00 AM</p>
            <p className="text-sm">Team Standup</p>
          </div>
          <div className="bg-emerald-900/20 rounded-lg p-3 border border-emerald-700/30 opacity-50">
            <p className="text-xs text-emerald-400">10:00 - 10:45 AM · Free</p>
            <p className="text-sm text-emerald-300">Suggested: AMT 885 Cardio (45 min)</p>
          </div>
          <div className="bg-[var(--card)] rounded-lg p-3 border border-slate-700 opacity-50">
            <p className="text-xs text-slate-400">11:00 AM - 12:00 PM</p>
            <p className="text-sm">Project Review</p>
          </div>
          <div className="bg-sky-900/20 rounded-lg p-3 border border-sky-700/30 opacity-50">
            <p className="text-xs text-sky-400">12:00 - 12:15 PM · Free</p>
            <p className="text-sm text-sky-300">Suggested: Quick Mobility (10 min)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
