"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { QUICK_ROUTINE, FULL_ROUTINE } from "@/lib/mobilityRoutines";
import type { MobilityRoutineDefinition, Exercise } from "@/lib/mobilityRoutines";

export default function MobilityPage() {
  const [selectedRoutine, setSelectedRoutine] = useState<MobilityRoutineDefinition | null>(null);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [routineComplete, setRoutineComplete] = useState(false);
  const [painLevel, setPainLevel] = useState(3);
  const [flexNotes, setFlexNotes] = useState("");
  const [todayDone, setTodayDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkTodayStatus = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("mobility_logs")
      .select("id")
      .eq("date", today)
      .limit(1);
    setTodayDone(!!data && data.length > 0);
  }, []);

  useEffect(() => {
    checkTodayStatus();
  }, [checkTodayStatus]);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((t) => t - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
      // Auto-advance to next exercise
      if (selectedRoutine && currentExerciseIdx < selectedRoutine.exercises.length - 1) {
        const currentEx = selectedRoutine.exercises[currentExerciseIdx];
        setCompletedExercises((prev) => [...prev, currentEx.id]);
        setCurrentExerciseIdx((idx) => idx + 1);
        setTimeRemaining(selectedRoutine.exercises[currentExerciseIdx + 1].duration_seconds);
      } else if (selectedRoutine) {
        const currentEx = selectedRoutine.exercises[currentExerciseIdx];
        setCompletedExercises((prev) => [...prev, currentEx.id]);
        setRoutineComplete(true);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeRemaining, currentExerciseIdx, selectedRoutine]);

  const startRoutine = (routine: MobilityRoutineDefinition) => {
    setSelectedRoutine(routine);
    setCurrentExerciseIdx(0);
    setCompletedExercises([]);
    setRoutineComplete(false);
    setTimeRemaining(routine.exercises[0].duration_seconds);
    setIsRunning(false);
  };

  const saveRoutine = async () => {
    if (!selectedRoutine) return;

    const { error } = await supabase.from("mobility_logs").insert({
      routine_type: selectedRoutine.id,
      exercises_completed: completedExercises,
      flexibility_notes: flexNotes || null,
      pain_level: painLevel,
    });

    if (!error) {
      setSelectedRoutine(null);
      setRoutineComplete(false);
      checkTodayStatus();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentExercise: Exercise | null =
    selectedRoutine && !routineComplete
      ? selectedRoutine.exercises[currentExerciseIdx]
      : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Mobility Routine</h1>
          <p className="text-xs text-slate-400">
            Gentle exercises for flexibility · Safe for DISH/OA
          </p>
        </div>
        <a href="/" className="text-slate-400 text-sm">← Home</a>
      </div>

      {/* Today status */}
      {todayDone && !selectedRoutine && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 mb-4">
          <p className="text-sm text-emerald-300">✅ Mobility routine completed today! Great job.</p>
        </div>
      )}

      {/* Routine Selection */}
      {!selectedRoutine && (
        <div className="space-y-3">
          <button
            onClick={() => startRoutine(QUICK_ROUTINE)}
            className="w-full bg-[var(--card)] border border-slate-700 rounded-xl p-5 text-left card-press hover:border-[var(--accent)]/50"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">⚡</span>
              <div>
                <p className="font-semibold">Quick Mobility</p>
                <p className="text-sm text-slate-400">5 minutes · {QUICK_ROUTINE.exercises.length} exercises</p>
                <p className="text-xs text-slate-500 mt-1">Perfect for between meetings</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => startRoutine(FULL_ROUTINE)}
            className="w-full bg-[var(--card)] border border-slate-700 rounded-xl p-5 text-left card-press hover:border-[var(--accent)]/50"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">🧘</span>
              <div>
                <p className="font-semibold">Full Mobility Routine</p>
                <p className="text-sm text-slate-400">10 minutes · {FULL_ROUTINE.exercises.length} exercises</p>
                <p className="text-xs text-slate-500 mt-1">Comprehensive hip, spine, and hamstring work</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Active Routine */}
      {currentExercise && !routineComplete && (
        <div>
          {/* Progress */}
          <div className="flex gap-1 mb-4">
            {selectedRoutine!.exercises.map((_, idx) => (
              <div
                key={idx}
                className={`flex-1 h-1.5 rounded-full ${
                  idx < currentExerciseIdx
                    ? "bg-[var(--success)]"
                    : idx === currentExerciseIdx
                      ? "bg-[var(--accent)]"
                      : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Exercise Card */}
          <div className="bg-[var(--card)] rounded-xl p-6 mb-4">
            <p className="text-xs text-slate-400 mb-2">
              Exercise {currentExerciseIdx + 1} of {selectedRoutine!.exercises.length}
            </p>
            <h2 className="text-xl font-bold mb-2">{currentExercise.name}</h2>
            <p className="text-sm text-slate-300 mb-4">{currentExercise.description}</p>

            {/* Timer */}
            <div className="text-center mb-4">
              <p className="text-5xl font-mono font-bold text-[var(--accent)]">
                {formatTime(timeRemaining)}
              </p>
            </div>

            {/* Start/Pause */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex-1 py-3 rounded-xl font-semibold ${
                  isRunning
                    ? "bg-amber-600 text-white"
                    : "bg-[var(--accent)] text-white"
                }`}
              >
                {isRunning ? "⏸ Pause" : "▶️ Start"}
              </button>
              <button
                onClick={() => {
                  setIsRunning(false);
                  setCompletedExercises((prev) => [...prev, currentExercise.id]);
                  if (currentExerciseIdx < selectedRoutine!.exercises.length - 1) {
                    const nextIdx = currentExerciseIdx + 1;
                    setCurrentExerciseIdx(nextIdx);
                    setTimeRemaining(selectedRoutine!.exercises[nextIdx].duration_seconds);
                  } else {
                    setRoutineComplete(true);
                  }
                }}
                className="bg-slate-700 text-white px-4 py-3 rounded-xl font-semibold"
              >
                Skip →
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[var(--card)] rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Instructions</h3>
            <ol className="space-y-1">
              {currentExercise.instructions.map((step, idx) => (
                <li key={idx} className="text-sm text-slate-300">
                  {idx + 1}. {step}
                </li>
              ))}
            </ol>
            {currentExercise.caution && (
              <p className="text-xs text-amber-300 mt-3">
                ⚠️ {currentExercise.caution}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Routine Complete */}
      {routineComplete && (
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">Routine Complete!</h2>
          <p className="text-sm text-slate-400 mb-6">
            You finished {completedExercises.length} exercises. Great work on your flexibility!
          </p>

          {/* Pain Level */}
          <div className="bg-[var(--card)] rounded-xl p-4 mb-4 text-left">
            <p className="text-sm font-semibold mb-2">How was your pain level? (1-5)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => setPainLevel(level)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    painLevel === level
                      ? "bg-[var(--accent)] text-white"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">1 = no pain · 5 = significant pain</p>
          </div>

          {/* Notes */}
          <div className="bg-[var(--card)] rounded-xl p-4 mb-4 text-left">
            <p className="text-sm font-semibold mb-2">Flexibility notes (optional)</p>
            <input
              type="text"
              value={flexNotes}
              onChange={(e) => setFlexNotes(e.target.value)}
              placeholder="e.g. 'Reached further today' or 'Hip felt tight'"
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <button
            onClick={saveRoutine}
            className="w-full bg-[var(--success)] text-white py-3 rounded-xl font-semibold active:opacity-80"
          >
            ✅ Save & Complete
          </button>

          <button
            onClick={() => {
              setSelectedRoutine(null);
              setRoutineComplete(false);
            }}
            className="w-full text-slate-400 py-2 mt-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
