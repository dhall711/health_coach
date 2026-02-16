import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "@/lib/db";
import { API_BASE } from "@/lib/api";
import { getGreeting, getTimeOfDay, getTodayRange, getToday } from "@/lib/dates";
import { C, base } from "@/lib/theme";
import type { FoodLog, FoodFavorite, Workout, WaterLog, Streak } from "@/lib/types";
import {
  isHealthKitConnected,
  restoreHealthKitConnection,
  getTodaySteps,
  getTodayActiveCalories,
  getRestingHeartRate,
} from "@/lib/healthkit";

function coachMessage(tod: string, cal: number, target: number, workedOut: boolean, loggedW: boolean, mob: boolean) {
  const h = new Date().getHours();
  if (h < 8 && !loggedW) return "Start your day right — step on the scale before breakfast.";
  if (h < 10 && loggedW && cal === 0) return "Weight logged. Time for coffee and your banana — fuel up.";
  if (tod === "morning" && !workedOut) return "You have a window this morning. How about 30 min on the AMT?";
  if (tod === "afternoon" && !workedOut) return "Still time for your workout today. Even 20 minutes counts.";
  if (tod === "afternoon" && workedOut && !mob) return "Great workout! Now do your 5-min hip and back stretches.";
  if (cal > target * 0.85) return "Close to your calorie limit. Be mindful with your next meal.";
  if (tod === "evening" && workedOut && mob) return "Solid day, Doug. Log dinner and let's wrap up strong.";
  if (tod === "evening") return "How's the day going? Let's review and plan for tomorrow.";
  return "You're building momentum. Keep it up — consistency wins.";
}

export default function TodayScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [cals, setCals] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [calTarget] = useState(1800);
  const [waterOz, setWaterOz] = useState(0);
  const [waterGoal] = useState(64);
  const [curWeight, setCurWeight] = useState<number | null>(null);
  const [loggedWeight, setLoggedWeight] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [mobDone, setMobDone] = useState(false);
  const [goalW, setGoalW] = useState(185);
  const [startW, setStartW] = useState(220);
  const [loading, setLoading] = useState(true);

  // HealthKit data
  const [hkConnected, setHkConnected] = useState(false);
  const [hkSteps, setHkSteps] = useState(0);
  const [hkActiveCal, setHkActiveCal] = useState(0);
  const [hkRHR, setHkRHR] = useState<number | null>(null);

  const load = useCallback(async () => {
    const today = getToday();
    const { start: s, end: e } = getTodayRange();
    try {
      const [flRes, wlRes, twRes, lwRes, woRes, mlRes, pfRes, favRes, strRes] = await Promise.all([
        db.from("food_logs").select("*").gte("timestamp", s).lte("timestamp", e).order("timestamp", { ascending: true }),
        db.from("water_logs").select("*").gte("timestamp", s).lte("timestamp", e),
        db.from("weight_logs").select("*").gte("timestamp", s).lte("timestamp", e).limit(1),
        db.from("weight_logs").select("weight").order("timestamp", { ascending: false }).limit(1),
        db.from("workouts").select("*").gte("timestamp", s).lte("timestamp", e),
        db.from("mobility_logs").select("id").eq("date", today).limit(1),
        db.from("profiles").select("goal_weight").limit(1).single(),
        db.from("food_favorites").select("*").order("sort_order", { ascending: true }),
        db.from("streaks").select("*").limit(1).single(),
      ]);

      if (flRes.data) {
        const l = flRes.data as FoodLog[];
        setFoodLogs(l);
        setCals(l.reduce((a, x) => a + (x.total_calories || 0), 0));
        setProtein(l.reduce((a, x) => a + (x.protein_g || 0), 0));
        setCarbs(l.reduce((a, x) => a + (x.carbs_g || 0), 0));
        setFat(l.reduce((a, x) => a + (x.fat_g || 0), 0));
      }
      if (wlRes.data) setWaterOz((wlRes.data as WaterLog[]).reduce((a, x) => a + (x.amount_oz || 0), 0));
      setLoggedWeight(!!(twRes.data && twRes.data.length > 0));
      if (lwRes.data?.[0]) setCurWeight(lwRes.data[0].weight);
      if (woRes.data) setWorkouts(woRes.data as Workout[]);
      setMobDone(!!(mlRes.data && mlRes.data.length > 0));
      if (pfRes.data?.goal_weight) setGoalW(pfRes.data.goal_weight);
      if (favRes.data) setFavorites(favRes.data as FoodFavorite[]);
      // Streak: trigger server-side check-in to auto-update
      try {
        const streakRes = await fetch(`${API_BASE}/api/streaks/check-in`, { method: "POST" });
        if (streakRes.ok) {
          const sr = await streakRes.json();
          setStreak({ id: "", current_streak: sr.current_streak, longest_streak: sr.longest_streak, last_check_in_date: sr.last_check_in_date, streak_freezes_remaining: 0, streak_freezes_used: 0 });
        } else if (strRes.data) {
          setStreak(strRes.data as Streak);
        }
      } catch {
        if (strRes.data) setStreak(strRes.data as Streak);
      }

      const sv = await AsyncStorage.getItem("startWeight");
      if (sv) setStartW(Number(sv));

      // Load HealthKit data if connected (iOS only)
      if (Platform.OS === "ios") {
        try {
          const connected = await isHealthKitConnected();
          if (connected) {
            await restoreHealthKitConnection();
            setHkConnected(true);
            const [steps, activeCal, rhr] = await Promise.all([
              getTodaySteps(),
              getTodayActiveCalories(),
              getRestingHeartRate(),
            ]);
            setHkSteps(steps);
            setHkActiveCal(activeCal);
            setHkRHR(rhr);
          }
        } catch (e) {
          console.warn("HealthKit load error:", e);
        }
      }
    } catch (err) {
      console.warn("Dashboard load error:", err);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  const addWater = async (oz: number) => { const { error } = await db.from("water_logs").insert({ amount_oz: oz }); if (!error) setWaterOz(p => p + oz); };

  const quickLogFavorite = async (fav: FoodFavorite) => {
    const { error } = await db.from("food_logs").insert({
      meal_type: fav.meal_type,
      items: [{ name: fav.name, calories: fav.default_calories, protein_g: fav.default_protein_g, carbs_g: fav.default_carbs_g, fat_g: fav.default_fat_g, portion_size: "standard", portion_notes: "" }],
      total_calories: fav.default_calories, protein_g: fav.default_protein_g, carbs_g: fav.default_carbs_g, fat_g: fav.default_fat_g,
      input_method: "favorite", confirmed: true,
    });
    if (!error) {
      setCals(p => p + fav.default_calories);
      setProtein(p => p + fav.default_protein_g);
      setCarbs(p => p + fav.default_carbs_g);
      setFat(p => p + fav.default_fat_g);
    }
  };

  const tod = getTimeOfDay();
  const hasWO = workouts.length > 0;
  const remain = Math.max(0, calTarget - cals);
  const calPct = Math.min(100, (cals / calTarget) * 100);
  const wPct = Math.min(100, (waterOz / waterGoal) * 100);
  const totalLose = startW - goalW;
  const lost = curWeight ? startW - curWeight : 0;
  const gPct = totalLose > 0 ? Math.min(100, (lost / totalLose) * 100) : 0;
  const workoutBurned = workouts.reduce((s, w) => s + w.calories_burned, 0);
  const totalBurned = hkActiveCal > workoutBurned ? hkActiveCal : workoutBurned;

  const proteinTarget = 135;
  const carbsTarget = 180;
  const fatTarget = 60;

  const actions = [
    { id: "w", icon: "scale-outline" as const, label: "Log morning weight", done: loggedWeight, tab: "track" },
    { id: "b", icon: "cafe-outline" as const, label: "Log breakfast", done: foodLogs.some(l => l.meal_type === "breakfast"), tab: "track" },
    { id: "x", icon: "fitness-outline" as const, label: "AMT 885 workout", done: hasWO, tab: "track" },
    { id: "m", icon: "body-outline" as const, label: "Mobility stretches", done: mobDone, tab: "track" },
    { id: "l", icon: "sunny-outline" as const, label: "Log lunch", done: foodLogs.some(l => l.meal_type === "lunch"), tab: "track" },
    { id: "h", icon: "water-outline" as const, label: `Drink ${waterGoal}oz water`, done: waterOz >= waterGoal, tab: "track" },
    { id: "d", icon: "moon-outline" as const, label: "Log dinner", done: foodLogs.some(l => l.meal_type === "dinner"), tab: "track" },
    { id: "r", icon: "analytics-outline" as const, label: "Daily review with coach", done: false, tab: "coach" },
  ];
  const doneCount = actions.filter(a => a.done).length;
  const next = actions.find(a => !a.done);
  const dayProgress = (doneCount / actions.length) * 100;

  if (loading) return <SafeAreaView style={S.screen}><View style={S.center}><Text style={base.bodySec}>Loading mission control...</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={S.screen}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>

        {/* Greeting + Streak */}
        <View style={[base.rowBetween, { marginTop: 8 }]}>
          <View>
            <Text style={base.h1}>{getGreeting()}</Text>
            <Text style={base.caption}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
          </View>
          <View style={[base.row, { gap: 8 }]}>
            {streak && streak.current_streak > 0 && (
              <View style={S.streakBadge}>
                <Text style={{ fontSize: 12 }}>🔥</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#fcd34d" }}>{streak.current_streak}</Text>
              </View>
            )}
            <Pressable style={S.settingsBtn} onPress={() => router.push("/settings")}>
              <Ionicons name="settings-outline" size={18} color={C.textSec} />
            </Pressable>
          </View>
        </View>

        {/* AI Coach */}
        <Pressable style={S.coachCard} onPress={() => router.push("/(tabs)/coach")}>
          <View style={[base.rowBetween]}>
            <View style={base.flex1}>
              <Text style={S.coachTitle}>AI Coach</Text>
              <Text style={S.coachBody}>{coachMessage(tod, cals, calTarget, hasWO, loggedWeight, mobDone)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.indigoLight} />
          </View>
        </Pressable>

        {/* Today's Plan */}
        <View style={[base.rowBetween, { marginBottom: 4 }]}>
          <Text style={base.label}>Today's Plan</Text>
          <Text style={base.caption}>{doneCount}/{actions.length} done</Text>
        </View>
        {/* Progress bar */}
        <View style={[base.progressTrack, { marginBottom: 8, height: 6 }]}>
          <View style={[base.progressFill, { height: 6, width: `${dayProgress}%`, backgroundColor: C.emerald }]} />
        </View>
        <View style={[base.card, { padding: 0, overflow: "hidden" }]}>
          {actions.map((a, i) => {
            const isNext = a === next;
            return (
              <Pressable key={a.id} style={[S.actionRow, isNext && S.actionNext, i > 0 && S.actionBorder]}
                onPress={() => router.push(`/(tabs)/${a.tab}` as any)}>
                <View style={[S.checkbox, a.done && S.checkboxDone]}>
                  {a.done && <Ionicons name="checkmark" size={12} color="white" />}
                </View>
                <Ionicons name={a.icon} size={16} color={a.done ? C.textDim : C.textSec} style={{ marginRight: 8 }} />
                <Text style={[S.actionLabel, a.done && S.actionDone]} numberOfLines={1}>{a.label}</Text>
                {isNext && <View style={S.nextBadge}><Text style={S.nextText}>NEXT</Text></View>}
              </Pressable>
            );
          })}
        </View>

        {/* Calorie Budget */}
        <Text style={[base.label, { marginBottom: 8 }]}>Calorie Budget</Text>
        <View style={base.card}>
          <View style={[base.row, { alignItems: "baseline", marginBottom: 4 }]}>
            <Text style={{ fontSize: 32, fontWeight: "800", color: C.text }}>{remain.toLocaleString()}</Text>
            <Text style={[base.bodySec, { marginLeft: 8 }]}>remaining</Text>
          </View>
          <View style={[base.progressTrack, { marginBottom: 8 }]}>
            <View style={[base.progressFill, { width: `${calPct}%`, backgroundColor: calPct > 90 ? C.red : calPct > 70 ? C.amber : C.accent }]} />
          </View>
          <Text style={[base.caption, { textAlign: "center" }]}>
            {cals} eaten{totalBurned > 0 ? ` · ${totalBurned} burned` : ""} · {calTarget} target
          </Text>
          {/* Macros */}
          <View style={[base.row, { gap: 6, marginTop: 12 }]}>
            {[["P", protein, proteinTarget, C.green], ["C", carbs, carbsTarget, C.blue], ["F", fat, fatTarget, C.amber]].map(([l, v, g, c]) => {
              const pct = Math.min(100, ((v as number) / (g as number)) * 100);
              return (
                <View key={l as string} style={S.macroBox}>
                  <Text style={{ fontSize: 10, color: C.textDim, textAlign: "center", marginBottom: 3 }}>
                    {l} {v}/{g}g
                  </Text>
                  <View style={[base.progressTrack, { height: 4 }]}>
                    <View style={[base.progressFill, { height: 4, width: `${pct}%`, backgroundColor: c as string }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={[base.row, { gap: 8, marginBottom: 16 }]}>
          <Pressable style={S.statCard} onPress={() => router.push("/(tabs)/track")}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{curWeight || "--"}</Text>
            <Text style={base.caption}>{curWeight && goalW ? `${(curWeight - goalW).toFixed(1)} to go` : "Weight"}</Text>
          </Pressable>
          <Pressable style={S.statCard} onPress={() => router.push("/(tabs)/track")}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{workouts.length}</Text>
            <Text style={base.caption}>{totalBurned > 0 ? `${totalBurned} cal` : "Workouts"}</Text>
          </Pressable>
          <Pressable style={S.statCard} onPress={() => router.push("/(tabs)/track")}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: C.text }}>{mobDone ? "✓" : "—"}</Text>
            <Text style={base.caption}>{mobDone ? "Done" : "Mobility"}</Text>
          </Pressable>
        </View>

        {/* Apple Health Stats */}
        {hkConnected && (hkSteps > 0 || hkActiveCal > 0) && (
          <View style={{ marginBottom: 16 }}>
            <View style={[base.rowBetween, { marginBottom: 8 }]}>
              <View style={[base.row, { gap: 6 }]}>
                <Ionicons name="heart-circle" size={16} color={C.red} />
                <Text style={base.label}>Apple Health</Text>
              </View>
              <Text style={base.caption}>Live</Text>
            </View>
            <View style={[base.row, { gap: 8 }]}>
              <View style={S.hkStatCard}>
                <Ionicons name="footsteps-outline" size={18} color={C.accent} />
                <Text style={S.hkStatValue}>{hkSteps.toLocaleString()}</Text>
                <Text style={S.hkStatLabel}>steps</Text>
              </View>
              <View style={S.hkStatCard}>
                <Ionicons name="flame-outline" size={18} color={C.amber} />
                <Text style={S.hkStatValue}>{hkActiveCal}</Text>
                <Text style={S.hkStatLabel}>active cal</Text>
              </View>
              {hkRHR && (
                <View style={S.hkStatCard}>
                  <Ionicons name="heart-outline" size={18} color={C.red} />
                  <Text style={S.hkStatValue}>{hkRHR}</Text>
                  <Text style={S.hkStatLabel}>resting bpm</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Hydration */}
        <View style={base.card}>
          <View style={[base.rowBetween, { marginBottom: 12 }]}>
            <View>
              <Text style={base.h3}>Hydration</Text>
              <Text style={base.caption}>{waterOz}oz of {waterGoal}oz ({Math.round(wPct)}%)</Text>
            </View>
          </View>
          <View style={[base.progressTrack, { marginBottom: 12 }]}>
            <View style={[base.progressFill, { width: `${wPct}%`, backgroundColor: C.blue }]} />
          </View>
          <View style={[base.row, { gap: 8 }]}>
            <Pressable style={S.waterBtn} onPress={() => addWater(8)}>
              <Text style={S.waterBtnText}>+8oz</Text>
            </Pressable>
            <Pressable style={S.waterBtn} onPress={() => addWater(16)}>
              <Text style={S.waterBtnText}>+16oz</Text>
            </Pressable>
          </View>
        </View>

        {/* Quick Log Favorites */}
        {favorites.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={[base.label, { marginBottom: 8 }]}>Quick Log</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {favorites.map(fav => (
                <Pressable key={fav.id} style={S.favCard} onPress={() => quickLogFavorite(fav)}>
                  <Text style={{ fontSize: 20 }}>{fav.icon}</Text>
                  <Text style={{ fontSize: 10, color: C.textSec, marginTop: 4 }} numberOfLines={1}>{fav.name}</Text>
                  <Text style={{ fontSize: 9, color: C.textDim }}>{fav.default_calories} cal</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Today's Timeline */}
        {foodLogs.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={[base.rowBetween, { marginBottom: 8 }]}>
              <Text style={base.label}>Today's Log</Text>
              <Text style={base.caption}>{foodLogs.length} entries</Text>
            </View>
            {foodLogs.slice(-5).map(log => {
              const nm = log.items && Array.isArray(log.items) ? (log.items as Array<{name:string}>).map(i => i.name).join(", ") : log.meal_type;
              return (
                <View key={log.id} style={S.timelineRow}>
                  <Text style={{ fontSize: 14 }}>
                    {log.meal_type === "breakfast" ? "🌅" : log.meal_type === "lunch" ? "☀️" : log.meal_type === "dinner" ? "🌙" : log.meal_type === "drink" ? "🥤" : "🍽️"}
                  </Text>
                  <View style={base.flex1}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }} numberOfLines={1}>{nm}</Text>
                    <Text style={base.caption}>{new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{log.total_calories} cal</Text>
                    <Text style={{ fontSize: 10, color: C.textDim }}>{log.protein_g}g P</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Goal Progress */}
        <View style={base.card}>
          <Text style={[base.h3, { marginBottom: 8 }]}>Goal Progress</Text>
          <View style={[base.progressTrack, { marginBottom: 8 }]}>
            <View style={[base.progressFill, { width: `${gPct}%`, backgroundColor: C.emerald }]} />
          </View>
          <View style={base.rowBetween}>
            <Text style={base.caption}>{startW} lbs start</Text>
            <Text style={{ fontSize: 12, fontWeight: "600", color: C.emerald }}>{Math.round(gPct)}%</Text>
            <Text style={base.caption}>{goalW} lbs goal</Text>
          </View>
          {curWeight && lost > 0 && (
            <Text style={[base.caption, { textAlign: "center", marginTop: 4 }]}>Current: {curWeight} lbs · {lost} lbs lost</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  streakBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(120,53,15,0.3)", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  coachCard: { backgroundColor: C.indigo, borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 20 },
  coachTitle: { color: "white", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  coachBody: { color: "#c7d2fe", fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  actionNext: { backgroundColor: "rgba(51,65,85,0.3)" },
  actionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.borderLight },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: C.textDim, marginRight: 12, alignItems: "center", justifyContent: "center" },
  checkboxDone: { backgroundColor: C.green, borderColor: C.green },
  actionLabel: { flex: 1, fontSize: 14, color: C.text },
  actionDone: { color: C.textDim, textDecorationLine: "line-through" },
  nextBadge: { backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  nextText: { color: "white", fontSize: 10, fontWeight: "700" },
  macroBox: { flex: 1, backgroundColor: "rgba(51,65,85,0.5)", borderRadius: 8, padding: 8 },
  statCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: "center" },
  waterBtn: { flex: 1, backgroundColor: C.blueBg, borderWidth: 1, borderColor: C.blueBorder, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  waterBtnText: { color: C.blueText, fontSize: 14, fontWeight: "600" },
  favCard: { width: 72, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  hkStatCard: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "rgba(239,68,68,0.15)", gap: 4 },
  hkStatValue: { fontSize: 18, fontWeight: "700", color: C.text },
  hkStatLabel: { fontSize: 9, color: C.textDim, textTransform: "uppercase" },
});
