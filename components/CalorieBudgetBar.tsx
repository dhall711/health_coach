"use client";

interface CalorieBudgetBarProps {
  consumed: number;
  target: number;
  burned: number;
}

export default function CalorieBudgetBar({ consumed, target, burned }: CalorieBudgetBarProps) {
  const remaining = target - consumed + burned;
  const percentage = Math.min(100, (consumed / target) * 100);
  const isOverBudget = remaining < 0;

  let barColor = "bg-[var(--accent)]";
  if (percentage > 90) barColor = "bg-[var(--warning)]";
  if (isOverBudget) barColor = "bg-[var(--danger)]";

  return (
    <div className="bg-[var(--card)] rounded-xl p-4 mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Calorie Budget
        </h2>
        <span className="text-xs text-slate-400">
          {burned > 0 && `+${burned} burned`}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span
          className={`text-3xl font-bold ${
            isOverBudget ? "text-[var(--danger)]" : "text-white"
          }`}
        >
          {Math.abs(remaining).toLocaleString()}
        </span>
        <span className="text-sm text-slate-400">
          {isOverBudget ? "over budget" : "remaining"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700 rounded-full h-4 mb-2">
        <div
          className={`${barColor} h-4 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-slate-400">
        <span>{consumed.toLocaleString()} eaten</span>
        <span>{target.toLocaleString()} target</span>
      </div>
    </div>
  );
}
