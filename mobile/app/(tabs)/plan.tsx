import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { C, base } from "@/lib/theme";
import ScreenHeader from "@/components/ScreenHeader";
import { API_BASE } from "@/lib/api";
import { generateWeeklyPlan, generateGroceryList, type DayPlan, type MealTemplate } from "@/lib/mealPlanner";

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

interface CalEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface DaySchedule {
  events: CalEvent[];
  freeSlots: CalendarSlot[];
}

type PlanTab = "meals" | "grocery" | "workouts" | "targets";
type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
type WO = "amt885" | "mobility" | "flexibility" | "walk" | "rest" | "other";

const DAYS: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface WorkoutScheduleDay {
  day: DayOfWeek;
  type: WO;
  description: string;
}

const WO_OPTIONS: { type: WO; icon: string; label: string; desc: string }[] = [
  { type: "amt885", icon: "🏃", label: "AMT 885", desc: "AMT 885 (30-45 min) + Mobility" },
  { type: "mobility", icon: "🧘", label: "Mobility", desc: "Mobility routine (5-10 min)" },
  { type: "flexibility", icon: "🤸", label: "Flex", desc: "Flexibility routine (10-15 min)" },
  { type: "walk", icon: "🚶", label: "Walk", desc: "Walk (20-30 min)" },
  { type: "rest", icon: "💤", label: "Rest", desc: "Rest & recovery" },
  { type: "other", icon: "💪", label: "Other", desc: "Other workout" },
];

const DEFAULT_SCHEDULE: WorkoutScheduleDay[] = [
  { day: "Monday", type: "amt885", description: "AMT 885 (30-45 min) + Mobility" },
  { day: "Tuesday", type: "flexibility", description: "Flexibility routine (10-15 min)" },
  { day: "Wednesday", type: "amt885", description: "AMT 885 (30-45 min) + Mobility" },
  { day: "Thursday", type: "mobility", description: "Mobility routine (5-10 min)" },
  { day: "Friday", type: "amt885", description: "AMT 885 (30-45 min) + Mobility" },
  { day: "Saturday", type: "walk", description: "Walk (20-30 min)" },
  { day: "Sunday", type: "rest", description: "Rest & recovery" },
];

export default function PlanScreen() {
  const [tab, setTab] = useState<PlanTab>("meals");
  const [weekPlan, setWeekPlan] = useState<DayPlan[]>([]);
  const [groceryList, setGroceryList] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [workoutSchedule, setWorkoutSchedule] = useState<WorkoutScheduleDay[]>(DEFAULT_SCHEDULE);
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null);

  // Calendar scheduling
  const [calConnected, setCalConnected] = useState<boolean | null>(null);
  const [calLoading, setCalLoading] = useState(false);
  const [topSuggestions, setTopSuggestions] = useState<CalendarSlot[]>([]);
  const [daySchedules, setDaySchedules] = useState<Record<string, DaySchedule>>({});
  const [scheduling, setScheduling] = useState<string | null>(null);

  useEffect(() => {
    const plan = generateWeeklyPlan(0);
    setWeekPlan(plan);
    setGroceryList(generateGroceryList(plan));

    (async () => {
      const saved = await AsyncStorage.getItem("workoutSchedule");
      if (saved) {
        try { setWorkoutSchedule(JSON.parse(saved)); } catch {}
      }
      const savedChecked = await AsyncStorage.getItem("groceryChecked");
      if (savedChecked) {
        try { setCheckedItems(new Set(JSON.parse(savedChecked))); } catch {}
      }
    })();
  }, []);

  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/calendar/smart-schedule?days=7`);
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
    } finally { setCalLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "workouts" && calConnected === null) { loadCalendar(); }
  }, [tab, calConnected, loadCalendar]);

  const scheduleWorkout = async (slot: CalendarSlot) => {
    setScheduling(slot.start);
    try {
      const slotStart = new Date(slot.start);
      const workoutEnd = new Date(slotStart.getTime() + 45 * 60000);
      const res = await fetch(`${API_BASE}/api/integrations/google/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: slotStart.toISOString(),
          endTime: workoutEnd.toISOString(),
          title: "Workout - AMT 885 + Mobility",
          description: "Scheduled by Health Coach Doug",
        }),
      });
      if (res.ok) {
        Alert.alert("Booked!", "Workout added to your calendar as a private event.");
        loadCalendar();
      } else {
        Alert.alert("Error", "Failed to schedule workout");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally { setScheduling(null); }
  };

  const updateDayType = async (day: DayOfWeek, type: WO) => {
    const option = WO_OPTIONS.find(o => o.type === type);
    const newSchedule = workoutSchedule.map(d =>
      d.day === day ? { ...d, type, description: option?.desc || "" } : d
    );
    setWorkoutSchedule(newSchedule);
    await AsyncStorage.setItem("workoutSchedule", JSON.stringify(newSchedule));
    setEditingDay(null);
  };

  const regeneratePlan = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/plan/generate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.plan && data.plan.length > 0) {
          setWeekPlan(data.plan);
          setGroceryList(generateGroceryList(data.plan));
          setGenerating(false);
          return;
        }
      }
    } catch {}
    const offset = Math.floor(Math.random() * 5);
    const plan = generateWeeklyPlan(offset);
    setWeekPlan(plan);
    setGroceryList(generateGroceryList(plan));
    setGenerating(false);
  };

  const toggleGroceryItem = async (item: string) => {
    const next = new Set(checkedItems);
    if (next.has(item)) next.delete(item); else next.add(item);
    setCheckedItems(next);
    await AsyncStorage.setItem("groceryChecked", JSON.stringify([...next]));
  };

  const resetGrocery = async () => {
    setCheckedItems(new Set());
    await AsyncStorage.removeItem("groceryChecked");
  };

  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const woDays = workoutSchedule.filter(s => s.type !== "rest").length;

  const tabs: { t: PlanTab; label: string }[] = [
    { t: "meals", label: "Meals" },
    { t: "grocery", label: "Grocery" },
    { t: "workouts", label: "Workouts" },
    { t: "targets", label: "Targets" },
  ];

  return (
    <SafeAreaView style={S.screen}>
      <View style={[base.rowBetween, { paddingHorizontal: 16 }]}>
        <ScreenHeader title="Plan" subtitle="Your week, pre-decided. Just execute." />
        <Pressable style={S.regenBtn} onPress={regeneratePlan} disabled={generating}>
          <Text style={S.regenText}>{generating ? "..." : "Regen"}</Text>
        </Pressable>
      </View>

      {/* Tab selector */}
      <View style={S.tabBar}>
        {tabs.map(t => (
          <Pressable key={t.t} style={[S.tabBtn, tab === t.t && S.tabBtnActive]} onPress={() => setTab(t.t)}>
            <Text style={[S.tabLabel, tab === t.t && S.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>

        {/* ===== MEALS TAB ===== */}
        {tab === "meals" && (
          <View>
            {weekPlan.map(day => (
              <View key={day.day} style={S.mealDayCard}>
                <Pressable style={[base.rowBetween, { padding: 14 }]} onPress={() => setExpandedDay(expandedDay === day.day ? null : day.day)}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{day.day}</Text>
                    <Text style={{ fontSize: 11, color: C.textSec }}>{day.total_calories} cal · {day.total_protein_g}g protein</Text>
                  </View>
                  <Ionicons name={expandedDay === day.day ? "chevron-up" : "chevron-down"} size={18} color={C.textDim} />
                </Pressable>
                {expandedDay === day.day && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderLight }}>
                    <MealCard meal={day.breakfast} label="Breakfast" icon="🌅" />
                    <MealCard meal={day.lunch} label="Lunch" icon="☀️" />
                    <MealCard meal={day.dinner} label="Dinner" icon="🌙" />
                  </View>
                )}
              </View>
            ))}
            {weekPlan.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                <Text style={base.bodySec}>Generating your meal plan...</Text>
              </View>
            )}
          </View>
        )}

        {/* ===== GROCERY TAB ===== */}
        {tab === "grocery" && (
          <View>
            <View style={[base.rowBetween, { marginBottom: 12 }]}>
              <Text style={base.caption}>{groceryList.length} items · {checkedItems.size} checked</Text>
              <Pressable onPress={resetGrocery}><Text style={{ fontSize: 12, color: C.accent }}>Reset</Text></Pressable>
            </View>
            <View style={base.card}>
              {groceryList.map((item, idx) => {
                const checked = checkedItems.has(item);
                return (
                  <Pressable key={item} style={[S.groceryRow, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderLight }]} onPress={() => toggleGroceryItem(item)}>
                    <View style={[S.checkbox, checked && S.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={12} color="white" />}
                    </View>
                    <Text style={[{ fontSize: 13, color: C.text }, checked && { color: C.textDim, textDecorationLine: "line-through" }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ===== WORKOUTS TAB ===== */}
        {tab === "workouts" && (
          <View>
            <Text style={[base.caption, { marginBottom: 12 }]}>Tap any day to change the workout type. {woDays} active days.</Text>
            {workoutSchedule.map(schedDay => {
              const option = WO_OPTIONS.find(o => o.type === schedDay.type);
              const isRest = schedDay.type === "rest";
              const isToday = schedDay.day === today;
              return (
                <View key={schedDay.day}>
                  <Pressable style={[S.woRow, isToday && S.woRowToday, isRest && { opacity: 0.6 }]} onPress={() => setEditingDay(editingDay === schedDay.day ? null : schedDay.day)}>
                    <Text style={{ fontSize: 20 }}>{option?.icon || "😌"}</Text>
                    <View style={base.flex1}>
                      <Text style={{ fontSize: 13, fontWeight: isToday ? "700" : "500", color: C.text }}>{schedDay.day}</Text>
                      <Text style={{ fontSize: 11, color: C.textSec }}>{schedDay.description}</Text>
                      {isToday && <Text style={{ fontSize: 10, color: C.accent, fontWeight: "600" }}>TODAY</Text>}
                    </View>
                    <Ionicons name={editingDay === schedDay.day ? "chevron-up" : "chevron-down"} size={16} color={C.textDim} />
                  </Pressable>
                  {editingDay === schedDay.day && (
                    <View style={S.woEdit}>
                      {WO_OPTIONS.map(opt => (
                        <Pressable key={opt.type} style={[S.woOption, schedDay.type === opt.type && S.woOptionActive]} onPress={() => updateDayType(schedDay.day, opt.type)}>
                          <Text style={{ fontSize: 12 }}>{opt.icon}</Text>
                          <Text style={{ fontSize: 11, color: schedDay.type === opt.type ? "white" : C.textSec }}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Smart Calendar Scheduling */}
            <View style={{ marginTop: 16 }}>
              <View style={[base.row, { gap: 6, marginBottom: 8 }]}>
                <Ionicons name="calendar-outline" size={16} color="#a78bfa" />
                <Text style={[base.label, { color: "#a78bfa" }]}>Smart Scheduling</Text>
              </View>

              {calLoading && (
                <View style={[base.card, { alignItems: "center", paddingVertical: 24 }]}>
                  <ActivityIndicator color={C.accent} />
                  <Text style={[base.caption, { marginTop: 8 }]}>Reading your calendar...</Text>
                </View>
              )}

              {calConnected === false && !calLoading && (
                <View style={S.calendarCard}>
                  <Ionicons name="calendar-outline" size={20} color="#a78bfa" />
                  <View style={base.flex1}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#a78bfa" }}>Google Calendar</Text>
                    <Text style={{ fontSize: 11, color: C.textSec }}>Connect to auto-schedule workouts around meetings</Text>
                  </View>
                </View>
              )}

              {calConnected && !calLoading && topSuggestions.length > 0 && (
                <>
                  <Text style={[base.caption, { marginBottom: 8 }]}>Best workout windows this week</Text>
                  {topSuggestions.slice(0, 5).map(slot => (
                    <View key={slot.start} style={S.slotCard}>
                      <View style={S.slotIcon}>
                        <Text style={{ fontSize: 16 }}>{slot.score >= 40 ? "🌟" : slot.score >= 25 ? "✅" : "📅"}</Text>
                      </View>
                      <View style={base.flex1}>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{slot.dayOfWeek}</Text>
                        <Text style={base.caption}>{slot.startTime} – {slot.endTime} · {slot.durationMin} min</Text>
                      </View>
                      <Pressable
                        style={[S.bookBtn, scheduling === slot.start && { opacity: 0.5 }]}
                        onPress={() => scheduleWorkout(slot)}
                        disabled={scheduling === slot.start}
                      >
                        <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
                          {scheduling === slot.start ? "..." : "Book"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable onPress={loadCalendar} style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ fontSize: 12, color: C.textDim }}>↻ Refresh calendar</Text>
                  </Pressable>
                </>
              )}

              {calConnected && !calLoading && topSuggestions.length === 0 && (
                <View style={[base.card, { alignItems: "center" }]}>
                  <Text style={base.caption}>No open workout windows found this week</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ===== TARGETS TAB ===== */}
        {tab === "targets" && (
          <View>
            <View style={base.card}>
              <Text style={[base.h3, { marginBottom: 16 }]}>Daily Targets</Text>
              <TargetRow icon="🔥" label="Calories" value={1800} unit="cal/day" />
              <TargetRow icon="🥩" label="Protein" value={135} unit="g/day" />
              <TargetRow icon="🌾" label="Carbs" value={180} unit="g/day" />
              <TargetRow icon="🥑" label="Fat" value={60} unit="g/day" />
              <TargetRow icon="💧" label="Water" value={64} unit="oz/day" />
            </View>

            <View style={base.card}>
              <Text style={[base.h3, { marginBottom: 16 }]}>Weekly Targets</Text>
              <TargetRow icon="🏃" label="AMT 885 Sessions" value={3} unit="sessions" />
              <TargetRow icon="🧘" label="Mobility Routines" value={5} unit="sessions" />
              <TargetRow icon="📉" label="Weight Loss Rate" value={1} unit="lb/week" />
              <TargetRow icon="⚖️" label="Weigh-ins" value={7} unit="daily" />
            </View>

            <View style={S.noteCard}>
              <Text style={{ fontSize: 12, color: C.accent }}>
                These targets auto-adjust based on your weekly trends. Your AI Coach will recommend changes during the Weekly Review.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---- Sub-components ---- */

function MealCard({ meal, label, icon }: { meal: MealTemplate; label: string; icon: string }) {
  const [showIngredients, setShowIngredients] = useState(false);
  return (
    <View style={{ paddingTop: 12 }}>
      <View style={[base.row, { gap: 6, marginBottom: 4 }]}>
        <Text style={{ fontSize: 13 }}>{icon}</Text>
        <Text style={{ fontSize: 10, color: C.textSec, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{meal.name}</Text>
      <Text style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>
        {meal.calories} cal · {meal.protein_g}g P · {meal.carbs_g}g C · {meal.fat_g}g F
      </Text>
      {meal.prep_notes ? <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{meal.prep_notes}</Text> : null}
      <Pressable onPress={() => setShowIngredients(!showIngredients)} style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: C.textDim }}>{showIngredients ? "Hide ingredients" : "Show ingredients"}</Text>
      </Pressable>
      {showIngredients && (
        <View style={{ marginTop: 4, paddingLeft: 12 }}>
          {meal.ingredients.map((ing, i) => (
            <Text key={i} style={{ fontSize: 11, color: C.textDim, paddingVertical: 1 }}>• {ing}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

function TargetRow({ icon, label, value, unit }: { icon: string; label: string; value: number; unit: string }) {
  return (
    <View style={[base.rowBetween, { paddingVertical: 8 }]}>
      <View style={[base.row, { gap: 10 }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ fontSize: 13, color: C.text }}>{label}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{value}</Text>
        <Text style={{ fontSize: 11, color: C.textSec, marginLeft: 4 }}>{unit}</Text>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  regenBtn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  regenText: { fontSize: 11, fontWeight: "500", color: C.textSec },
  tabBar: { flexDirection: "row", marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.accent },
  tabLabel: { fontSize: 11, fontWeight: "500", color: C.textDim },
  tabLabelActive: { color: "white" },
  mealDayCard: { backgroundColor: C.card, borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  groceryRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: C.textDim, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: C.green, borderColor: C.green },
  woRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 6, gap: 12 },
  woRowToday: { borderWidth: 1, borderColor: C.accent },
  woEdit: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  woOption: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.cardAlt },
  woOptionActive: { backgroundColor: C.accent },
  calendarCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(88,28,135,0.2)", borderWidth: 1, borderColor: "rgba(88,28,135,0.3)", borderRadius: 12, padding: 14 },
  noteCard: { backgroundColor: "rgba(14,165,233,0.1)", borderWidth: 1, borderColor: "rgba(14,165,233,0.2)", borderRadius: 12, padding: 14, marginTop: 8 },
  slotCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 6 },
  slotIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(147,51,234,0.1)", alignItems: "center", justifyContent: "center" },
  bookBtn: { backgroundColor: "#7c3aed", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
});
