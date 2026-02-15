"use client";

interface WaterTrackerProps {
  currentOz: number;
  goalOz: number;
  onAddWater: (oz: number) => void;
}

export default function WaterTracker({ currentOz, goalOz, onAddWater }: WaterTrackerProps) {
  const percentage = Math.min(100, (currentOz / goalOz) * 100);
  const glasses = Math.floor(currentOz / 8);

  // SVG progress ring
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-[var(--card)] rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Progress Ring */}
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#334155"
                strokeWidth="4"
              />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              💧
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold">Hydration</p>
            <p className="text-xs text-slate-400">
              {currentOz}oz of {goalOz}oz ({glasses} glasses)
            </p>
          </div>
        </div>

        {/* Quick add buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onAddWater(8)}
            className="bg-sky-900/50 text-sky-300 px-3 py-1.5 rounded-lg text-xs font-medium active:bg-sky-800"
          >
            +8oz
          </button>
          <button
            onClick={() => onAddWater(16)}
            className="bg-sky-900/50 text-sky-300 px-3 py-1.5 rounded-lg text-xs font-medium active:bg-sky-800"
          >
            +16oz
          </button>
        </div>
      </div>
    </div>
  );
}
