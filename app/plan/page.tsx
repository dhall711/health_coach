"use client";

import { useState, useEffect, useCallback } from "react";
import { generateWeeklyPlan, generateGroceryList, type DayPlan, type MealTemplate } from "@/lib/mealPlanner";
import Link from "next/link";

type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type WorkoutDayType = "amt885" | "mobility" | "rest" | "walk";

interface WorkoutScheduleDay {
  day: DayOfWeek;
  type: WorkoutDayType;
  description: string;
}

const DEFAULT_SCHEDULE: WorkoutScheduleDay[] = [
  { day: "Monday", type: "amt885", description: "AMT 885 (30-45 min) + Mobility" },
  { day: "Tuesday", type: "mobility", description: "Mobility routine (5-10 min)" },
  { day: "Wednesday", type: "amt885", description: "AMT 885 (30-45 min) + Mobility" },
  { day: "Thursday", type: "mobility", description: "Mobility routine (5-10 min)" },
  { day: "Friday", type: "amt885", description: "AMT 885 (30-45 min) + Mobility" },
  { day: "Saturday", type: "rest", description: "Rest & recovery" },
  { day: "Sunday", type: "rest", description: "Rest & recovery" },
];

const WORKOUT_OPTIONS: { type: WorkoutDayType; icon: string; label: string; desc: string }[] = [
  { type: "amt885", icon: "🏃", label: "AMT 885", desc: "AMT 885 (30-45 min) + Mobility" },
  { type: "mobility", icon: "🧘", label: "Mobility", desc: "Mobility routine (5-10 min)" },
  { type: "walk", icon: "🚶", label: "Walk", desc: "Walk (20-30 min)" },
  { type: "rest", icon: "😌", label: "Rest", desc: "Rest & recovery" },
];

interface CalendarSlot {
  date: string;
  dayOfWeek: string;
  start: string;
  end: string;
  durationMin: number;
  startTime: string;
  endTime: string;
  score: number;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface DaySchedule {
  events: CalendarEvent[];
  freeSlots: CalendarSlot[];
}

export default function PlanPage() {
  const [tab, setTab] = useState<"meals" | "grocery" | "workouts" | "targets">("meals");
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>([]);
  const [groceryList, setGroceryList] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [workoutSchedule, setWorkoutSchedule] = useState<WorkoutScheduleDay[]>(DEFAULT_SCHEDULE);
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null);

  // Calendar scheduling state
  const [calConnected, setCalConnected] = useState<boolean | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [daySchedules, setDaySchedules] = useState<Record<string, DaySchedule>>({});
  const [topSuggestions, setTopSuggestions] = useState<CalendarSlot[]>([]);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);
  const [expandedCalDay, setExpandedCalDay] = useState<string | null>(null);

  useEffect(() => {
    const plan = generateWeeklyPlan(0);
    setWeekPlan(plan);
    setGroceryList(generateGroceryList(plan));

    const saved = localStorage.getItem("workoutSchedule");
    if (saved) {
      try {
        setWorkoutSchedule(JSON.parse(saved));
      } catch { /* use default */ }
    }
  }, []);

  // Load calendar data when workouts tab is active
  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await fetch("/api/calendar/smart-schedule?days=7");
      if (res.ok) {
        const data = await res.json();
        setCalConnected(data.connected !== false);
        if (data.connected !== false) {
          setDaySchedules(data.daySchedules || {});
          setTopSuggestions(data.topSuggestions || []);
        }
      }
    } catch {
      setCalConnected(false);
    } finally {
      setCalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "workouts" && calConnected === null) {
      loadCalendar();
    }
  }, [tab, calConnected, loadCalendar]);

  const scheduleWorkout = async (slot: CalendarSlot, workoutDuration: number = 45) => {
    setScheduling(slot.start);
    try {
      const slotStart = new Date(slot.start);
      const workoutEnd = new Date(slotStart.getTime() + workoutDuration * 60000);

      const res = await fetch("/api/integrations/google/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: slotStart.toISOString(),
          endTime: workoutEnd.toISOString(),
          title: "Workout - AMT 885 + Mobility",
          description: "Scheduled by Health Coach Doug. 30-45 min AMT 885 + 5-10 min mobility stretches. Remember to warm up!",
        }),
      });

      if (res.ok) {
        setScheduleSuccess(slot.start);
        setTimeout(() => setScheduleSuccess(null), 3000);
        loadCalendar(); // Refresh slots
      }
    } catch {
      // Error handled silently
    } finally {
      setScheduling(null);
    }
  };

  const updateDayType = (day: DayOfWeek, type: WorkoutDayType) => {
    const option = WORKOUT_OPTIONS.find((o) => o.type === type);
    const newSchedule = workoutSchedule.map((d) =>
      d.day === day ? { ...d, type, description: option?.desc || "" } : d
    );
    setWorkoutSchedule(newSchedule);
    localStorage.setItem("workoutSchedule", JSON.stringify(newSchedule));
    setEditingDay(null);
  };

  const regeneratePlan = async () => {
    setGenerating(true);
    // Try AI-generated plan
    try {
      const res = await fetch("/api/plan/generate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.plan && data.plan.length > 0) {
          setWeekPlan(data.plan);
          setGroceryList(generateGroceryList(data.plan));
          setGenerating(false);
          return;
        }
      }
    } catch {
      // Fall through to template rotation
    }
    // Fallback: rotate templates
    const offset = Math.floor(Math.random() * 5);
    const plan = generateWeeklyPlan(offset);
    setWeekPlan(plan);
    setGroceryList(generateGroceryList(plan));
    setGenerating(false);
  };

  const toggleGroceryItem = (item: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  // Weekly targets
  const weeklyCalTarget = 1800;
  const proteinTarget = 135;
  const carbsTarget = 180;
  const fatTarget = 60;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 bg-[var(--card)] rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Plan</h1>
            <p className="text-xs text-slate-400">Your week, pre-decided. Just execute.</p>
          </div>
        </div>
        <button
          onClick={regeneratePlan}
          disabled={generating}
          className="bg-[var(--card)] border border-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium hover:text-white transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 mb-5">
        {(["meals", "grocery", "workouts", "targets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
              tab === t ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "meals" ? "Meals" : t === "grocery" ? "Grocery" : t === "workouts" ? "Workouts" : "Targets"}
          </button>
        ))}
      </div>

      {/* MEALS TAB */}
      {tab === "meals" && (
        <div className="space-y-3">
          {weekPlan.map((day) => (
            <div key={day.day} className="bg-[var(--card)] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="font-semibold">{day.day}</p>
                  <p className="text-xs text-slate-400">{day.total_calories} cal · {day.total_protein_g}g protein</p>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform ${expandedDay === day.day ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {expandedDay === day.day && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
                  <MealCard meal={day.breakfast} label="Breakfast" icon="🌅" />
                  <MealCard meal={day.lunch} label="Lunch" icon="☀️" />
                  <MealCard meal={day.dinner} label="Dinner" icon="🌙" />
                </div>
              )}
            </div>
          ))}

          {weekPlan.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-slate-400 text-sm">Generating your meal plan...</p>
            </div>
          )}
        </div>
      )}

      {/* GROCERY TAB */}
      {tab === "grocery" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-400">{groceryList.length} items · {checkedItems.size} checked</p>
            <button onClick={() => setCheckedItems(new Set())} className="text-xs text-sky-400 hover:text-sky-300">
              Reset
            </button>
          </div>
          <div className="bg-[var(--card)] rounded-xl divide-y divide-slate-700/50">
            {groceryList.map((item) => (
              <button
                key={item}
                onClick={() => toggleGroceryItem(item)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  checkedItems.has(item) ? "bg-green-600 border-green-600" : "border-slate-500"
                }`}>
                  {checkedItems.has(item) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${checkedItems.has(item) ? "text-slate-500 line-through" : "text-white"}`}>
                  {item}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WORKOUTS TAB */}
      {tab === "workouts" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 mb-2">
            Tap any day to change the workout type. Your schedule is saved automatically.
          </p>

          {workoutSchedule.map((schedDay) => {
            const option = WORKOUT_OPTIONS.find((o) => o.type === schedDay.type);
            const isRest = schedDay.type === "rest";

            return (
              <div key={schedDay.day} className="bg-[var(--card)] rounded-xl overflow-hidden">
                <div
                  className={`p-4 flex items-center justify-between cursor-pointer ${isRest ? "opacity-60" : ""}`}
                  onClick={() => setEditingDay(editingDay === schedDay.day ? null : schedDay.day)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{option?.icon || "😌"}</span>
                    <div>
                      <p className="font-medium text-sm">{schedDay.day}</p>
                      <p className="text-xs text-slate-400">{schedDay.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isRest && (
                      <Link
                        href="/track?type=workout"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-sky-400 hover:text-sky-300"
                      >
                        Log
                      </Link>
                    )}
                    <svg className={`w-4 h-4 text-slate-500 transition-transform ${editingDay === schedDay.day ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {editingDay === schedDay.day && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 flex flex-wrap gap-2">
                    {WORKOUT_OPTIONS.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => updateDayType(schedDay.day, opt.type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          schedDay.type === opt.type
                            ? "bg-sky-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Smart Calendar Scheduling */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Smart Scheduling</h3>
            </div>

            {calLoading && (
              <div className="bg-[var(--card)] rounded-xl p-6 text-center">
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Reading your calendar...</p>
              </div>
            )}

            {calConnected === false && !calLoading && (
              <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-4">
                <p className="text-sm font-semibold text-purple-300 mb-1">Google Calendar</p>
                <p className="text-xs text-slate-400 mb-3">
                  Connect your calendar to auto-detect open slots around meetings and schedule workouts as private events.
                </p>
                <Link href="/settings" className="text-xs text-purple-400 hover:text-purple-300 font-medium">
                  Set up in Settings →
                </Link>
              </div>
            )}

            {calConnected && !calLoading && (
              <>
                {/* Top Suggestions */}
                {topSuggestions.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Best workout windows this week (based on your calendar + preferences)</p>
                    <div className="space-y-2">
                      {topSuggestions.slice(0, 5).map((slot) => {
                        const isScheduled = scheduleSuccess === slot.start;
                        const isScheduling = scheduling === slot.start;
                        return (
                          <div key={slot.start} className="bg-[var(--card)] rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-base">
                                  {slot.score >= 40 ? "🌟" : slot.score >= 25 ? "✅" : "📅"}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{slot.dayOfWeek}</p>
                                <p className="text-xs text-slate-400">
                                  {slot.startTime} – {slot.endTime} · {slot.durationMin} min
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => scheduleWorkout(slot)}
                              disabled={isScheduling || isScheduled}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                isScheduled
                                  ? "bg-green-600/20 text-green-400"
                                  : isScheduling
                                    ? "bg-slate-700 text-slate-500"
                                    : "bg-purple-600 text-white hover:bg-purple-700"
                              }`}
                            >
                              {isScheduled ? "✓ Booked" : isScheduling ? "..." : "Book"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Day-by-day breakdown */}
                <p className="text-xs text-slate-500 mb-2">Day-by-day schedule</p>
                <div className="space-y-2">
                  {Object.entries(daySchedules).map(([dateStr, schedule]) => {
                    const d = new Date(dateStr + "T12:00:00");
                    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
                    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    const isExpanded = expandedCalDay === dateStr;
                    const isToday = dateStr === new Date().toISOString().split("T")[0];
                    const meetingCount = schedule.events.filter((e) => !e.allDay).length;
                    const freeCount = schedule.freeSlots.filter((s) => s.durationMin >= 40).length;

                    return (
                      <div key={dateStr} className="bg-[var(--card)] rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedCalDay(isExpanded ? null : dateStr)}
                          className={`w-full flex items-center justify-between p-3 text-left ${isToday ? "bg-sky-500/5" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`text-center w-10 ${isToday ? "text-sky-400" : ""}`}>
                              <p className="text-[10px] text-slate-500 uppercase">{dayName}</p>
                              <p className="text-sm font-bold">{d.getDate()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400">
                                {meetingCount} meeting{meetingCount !== 1 ? "s" : ""} · {freeCount} open slot{freeCount !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isToday && (
                              <span className="text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full">
                                TODAY
                              </span>
                            )}
                            <svg className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-slate-700/50 pt-2 space-y-1.5">
                            {schedule.events.filter((e) => !e.allDay).map((evt) => (
                              <div key={evt.id} className="flex items-center gap-2 text-xs">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                <span className="text-slate-500">
                                  {new Date(evt.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                                <span className="text-slate-300 truncate">{evt.summary}</span>
                              </div>
                            ))}
                            {schedule.freeSlots.filter((s) => s.durationMin >= 30).map((slot) => (
                              <div key={slot.start} className="flex items-center justify-between gap-2 text-xs bg-emerald-500/5 rounded-lg px-2.5 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                  <span className="text-emerald-400">{slot.startTime} – {slot.endTime}</span>
                                  <span className="text-slate-500">({slot.durationMin} min free)</span>
                                </div>
                                {slot.durationMin >= 40 && (
                                  <button
                                    onClick={() => scheduleWorkout(slot)}
                                    disabled={scheduling === slot.start}
                                    className="text-[10px] font-semibold text-purple-400 hover:text-purple-300"
                                  >
                                    {scheduleSuccess === slot.start ? "✓" : scheduling === slot.start ? "..." : "Book"}
                                  </button>
                                )}
                              </div>
                            ))}
                            {schedule.freeSlots.length === 0 && (
                              <p className="text-xs text-slate-500 text-center py-1">No open slots this day</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Refresh button */}
                <button
                  onClick={loadCalendar}
                  className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300 py-2 transition-colors"
                >
                  ↻ Refresh calendar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* TARGETS TAB */}
      {tab === "targets" && (
        <div className="space-y-4">
          <div className="bg-[var(--card)] rounded-xl p-5">
            <h2 className="font-semibold mb-4">Daily Targets</h2>
            <div className="space-y-4">
              <TargetRow label="Calories" value={weeklyCalTarget} unit="cal/day" icon="🔥" />
              <TargetRow label="Protein" value={proteinTarget} unit="g/day" icon="🥩" />
              <TargetRow label="Carbs" value={carbsTarget} unit="g/day" icon="🌾" />
              <TargetRow label="Fat" value={fatTarget} unit="g/day" icon="🥑" />
              <TargetRow label="Water" value={64} unit="oz/day" icon="💧" />
            </div>
          </div>

          <div className="bg-[var(--card)] rounded-xl p-5">
            <h2 className="font-semibold mb-4">Weekly Targets</h2>
            <div className="space-y-4">
              <TargetRow label="AMT 885 Sessions" value={3} unit="sessions" icon="🏃" />
              <TargetRow label="Mobility Routines" value={5} unit="sessions" icon="🧘" />
              <TargetRow label="Weight Loss Rate" value={1} unit="lb/week" icon="📉" />
              <TargetRow label="Weigh-ins" value={7} unit="daily" icon="⚖️" />
            </div>
          </div>

          <div className="bg-sky-900/20 border border-sky-700/30 rounded-xl p-4">
            <p className="text-xs text-sky-300">
              These targets auto-adjust based on your weekly trends. Your AI Coach will recommend changes during the Weekly Review.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function MealCard({ meal, label, icon }: { meal: MealTemplate; label: string; icon: string }) {
  return (
    <div className="pt-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{icon}</span>
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium">{meal.name}</p>
      <p className="text-xs text-slate-400 mt-0.5">
        {meal.calories} cal · {meal.protein_g}g P · {meal.carbs_g}g C · {meal.fat_g}g F
      </p>
      {meal.prep_notes && (
        <p className="text-xs text-slate-500 mt-1">{meal.prep_notes}</p>
      )}
      <div className="mt-2">
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer hover:text-slate-400">Ingredients</summary>
          <ul className="mt-1 space-y-0.5 pl-4 list-disc">
            {meal.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

function TargetRow({ label, value, unit, icon }: { label: string; value: number; unit: string; icon: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-xs text-slate-400 ml-1">{unit}</span>
      </div>
    </div>
  );
}
