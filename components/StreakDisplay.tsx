"use client";

import type { Streak } from "@/lib/types";

interface StreakDisplayProps {
  streak: Streak | null;
}

export default function StreakDisplay({ streak }: StreakDisplayProps) {
  if (!streak) return null;

  const { current_streak, longest_streak, streak_freezes_remaining } = streak;

  // Milestone messages
  let milestone = "";
  if (current_streak >= 100) milestone = "🏆 100 day legend!";
  else if (current_streak >= 30) milestone = "🔥 30 day warrior!";
  else if (current_streak >= 7) milestone = "⭐ 7 day streak!";

  return (
    <div className="bg-[var(--card)] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{current_streak > 0 ? "🔥" : "📅"}</span>
          <div>
            <p className="text-sm font-semibold">
              {current_streak > 0
                ? `${current_streak} day streak`
                : "Start your streak today!"}
            </p>
            <p className="text-xs text-slate-400">
              Best: {longest_streak} days
              {streak_freezes_remaining > 0 &&
                ` · ${streak_freezes_remaining} freeze available`}
            </p>
          </div>
        </div>

        {milestone && (
          <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-1 rounded-full">
            {milestone}
          </span>
        )}
      </div>
    </div>
  );
}
