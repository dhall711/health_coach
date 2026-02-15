import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "@/lib/db";
import { C, base } from "@/lib/theme";
import ScreenHeader from "@/components/ScreenHeader";
import { rollingWeightAverage, estimateGoalDate, weeklyCalorieAdherence, macroBreakdown, weeklyWeightChangeRate, deduplicateWeightLogs } from "@/lib/trendAnalysis";
import { detectOvereatingPatterns, type PatternInsight } from "@/lib/patternDetection";
import type { WeightLog, FoodLog, Workout } from "@/lib/types";

type Tab = "overview" | "weight" | "nutrition" | "patterns";
type WeightRange = "30d" | "90d" | "1y" | "all";

export default function InsightsScreen() {
  const [tab, setTab] = useState<Tab>("overview");
  const [weightRange, setWeightRange] = useState<WeightRange>("90d");
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const calorieTarget = 1800;
  const goalWeight = 185;

  const load = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const shortCutoff = thirtyDaysAgo.toISOString();

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const longCutoff = twoYearsAgo.toISOString();

    try {
      const [{ data: weights }, { data: foods }, { data: wkts }] = await Promise.all([
        db.from("weight_logs").select("*").gte("timestamp", longCutoff).order("timestamp", { ascending: true }),
        db.from("food_logs").select("*").gte("timestamp", shortCutoff).order("timestamp", { ascending: true }),
        db.from("workouts").select("*").gte("timestamp", shortCutoff).order("timestamp", { ascending: true }),
      ]);
      if (weights) setWeightLogs(deduplicateWeightLogs(weights as WeightLog[]));
      if (foods) setFoodLogs(foods as FoodLog[]);
      if (wkts) setWorkouts(wkts as Workout[]);
    } catch (err) {
      console.warn("Insights load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={S.screen}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={[base.bodySec, { marginTop: 12 }]}>Analyzing your data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Computed analytics
  const rollingAvgs = rollingWeightAverage(weightLogs);
  const goalDate = estimateGoalDate(rollingAvgs, goalWeight);
  const weeklyAdherence = weeklyCalorieAdherence(foodLogs, calorieTarget);
  const recent7dFood = foodLogs.filter((f) => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return new Date(f.timestamp) >= d;
  });
  const macros = macroBreakdown(recent7dFood);
  const weeklyRate = weeklyWeightChangeRate(rollingAvgs);
  const patterns = detectOvereatingPatterns(foodLogs, workouts, calorieTarget);
  const latestAvg = rollingAvgs.length > 0 ? rollingAvgs[rollingAvgs.length - 1].avg : null;
  const workoutCount7d = workouts.filter((w) => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return new Date(w.timestamp) >= d;
  }).length;

  // Weight data filtered by range
  const filteredWeights = weightLogs.filter((w) => {
    const d = new Date(w.timestamp);
    const now = new Date();
    if (weightRange === "30d") { const c = new Date(now); c.setDate(c.getDate() - 30); return d >= c; }
    if (weightRange === "90d") { const c = new Date(now); c.setDate(c.getDate() - 90); return d >= c; }
    if (weightRange === "1y") { const c = new Date(now); c.setFullYear(c.getFullYear() - 1); return d >= c; }
    return true;
  });
  const filteredAvgs = rollingWeightAverage(filteredWeights);
  const fMinW = filteredAvgs.length > 0 ? Math.min(...filteredAvgs.map(a => a.avg)) : 0;
  const fMaxW = filteredAvgs.length > 0 ? Math.max(...filteredAvgs.map(a => a.avg)) : 0;
  const fRange = fMaxW - fMinW || 1;

  // Workout heatmap data (30 days)
  const heatDays: { date: string; count: number }[] = [];
  const hToday = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hToday); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    heatDays.push({ date: ds, count: workouts.filter(w => w.timestamp.split("T")[0] === ds).length });
  }

  const tabs: { t: Tab; label: string }[] = [
    { t: "overview", label: "Overview" },
    { t: "weight", label: "Weight" },
    { t: "nutrition", label: "Nutrition" },
    { t: "patterns", label: "Patterns" },
  ];

  return (
    <SafeAreaView style={S.screen}>
      <ScreenHeader title="Insights" subtitle="Your data tells a story" />

      {/* Tab selector */}
      <View style={S.tabBar}>
        {tabs.map(t => (
          <Pressable key={t.t} style={[S.tabBtn, tab === t.t && S.tabBtnActive]} onPress={() => setTab(t.t)}>
            <Text style={[S.tabLabel, tab === t.t && S.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>

        {/* ===== OVERVIEW TAB ===== */}
        {tab === "overview" && (
          <View>
            {/* Status Card */}
            <View style={S.statusCard}>
              <Text style={[base.label, { marginBottom: 12 }]}>Are We On Track?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={S.statusItem}>
                  <Text style={S.statusLabel}>7-Day Avg Weight</Text>
                  <Text style={S.statusVal}>{latestAvg ?? "---"}<Text style={S.statusUnit}> lbs</Text></Text>
                </View>
                <View style={S.statusItem}>
                  <Text style={S.statusLabel}>Weekly Rate</Text>
                  <Text style={[S.statusVal, { color: weeklyRate !== null && weeklyRate < 0 ? C.green : weeklyRate !== null && weeklyRate > 0 ? C.red : C.text }]}>
                    {weeklyRate !== null ? `${weeklyRate > 0 ? "+" : ""}${weeklyRate}` : "---"}
                    <Text style={S.statusUnit}> lbs/wk</Text>
                  </Text>
                </View>
                <View style={S.statusItem}>
                  <Text style={S.statusLabel}>Projected Goal</Text>
                  <Text style={[S.statusVal, { fontSize: 14, color: C.accent }]}>{goalDate ?? "Need more data"}</Text>
                </View>
                <View style={S.statusItem}>
                  <Text style={S.statusLabel}>Workouts (7d)</Text>
                  <Text style={S.statusVal}>{workoutCount7d}</Text>
                </View>
              </View>
            </View>

            {/* Top Insights */}
            {patterns.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[base.label, { marginBottom: 8 }]}>Top Insights</Text>
                {patterns.slice(0, 3).map(p => <PatternCard key={p.id} pattern={p} />)}
              </View>
            )}

            {/* Macro Summary */}
            <View style={base.card}>
              <Text style={[base.label, { marginBottom: 12 }]}>7-Day Macro Avg</Text>
              <View style={[base.row, { gap: 12 }]}>
                <MacroStat label="Protein" value={macros.protein_g} pct={macros.protein_pct} target={30} color={C.green} />
                <MacroStat label="Carbs" value={macros.carbs_g} pct={macros.carbs_pct} target={40} color={C.blue} />
                <MacroStat label="Fat" value={macros.fat_g} pct={macros.fat_pct} target={30} color={C.amber} />
              </View>
            </View>
          </View>
        )}

        {/* ===== WEIGHT TAB ===== */}
        {tab === "weight" && (
          <View>
            {/* Range selector */}
            <View style={S.rangeBar}>
              {(["30d", "90d", "1y", "all"] as WeightRange[]).map(r => (
                <Pressable key={r} style={[S.rangeBtn, weightRange === r && S.rangeBtnActive]} onPress={() => setWeightRange(r)}>
                  <Text style={[S.rangeLabel, weightRange === r && S.rangeLabelActive]}>
                    {r === "all" ? `All (${weightLogs.length})` : r}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Weight Trend Chart */}
            <View style={base.card}>
              <Text style={[base.h3, { marginBottom: 4 }]}>Weight Trend (7-Day Avg)</Text>
              {filteredAvgs.length >= 3 ? (
                <View style={{ marginTop: 12 }}>
                  {/* Simple bar chart of rolling averages */}
                  <View style={{ height: 120, flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
                    {filteredAvgs.map((w, i) => {
                      const pct = ((w.avg - fMinW) / fRange) * 100;
                      return <View key={i} style={{ flex: 1, backgroundColor: C.green, borderRadius: 2, height: `${Math.max(4, pct)}%`, minHeight: 3, opacity: 0.8 }} />;
                    })}
                  </View>
                  {/* Goal line indicator */}
                  <View style={[base.rowBetween, { marginTop: 4 }]}>
                    <Text style={S.axisLabel}>{filteredAvgs[0].date}</Text>
                    <Text style={[S.axisLabel, { color: C.accent }]}>Goal: {goalWeight}</Text>
                    <Text style={S.axisLabel}>{filteredAvgs[filteredAvgs.length - 1].date}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[base.bodySec, { paddingVertical: 32, textAlign: "center" }]}>
                  {weightLogs.length > 0 ? "Not enough data in this range" : "Log weights to see trends"}
                </Text>
              )}
            </View>

            {/* Stats grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Starting", value: "220", unit: "lbs" },
                { label: "Current Avg", value: latestAvg ? String(latestAvg) : "---", unit: "lbs" },
                { label: "Goal", value: String(goalWeight), unit: "lbs", accent: true },
                { label: "Est. Date", value: goalDate ?? "---", unit: "", accent: true },
              ].map(s => (
                <View key={s.label} style={S.statGrid}>
                  <Text style={S.statGridLabel}>{s.label}</Text>
                  <Text style={[S.statGridVal, s.accent && { color: C.accent }]}>{s.value}{s.unit ? <Text style={S.statusUnit}> {s.unit}</Text> : null}</Text>
                </View>
              ))}
            </View>

            {/* Recent weigh-ins */}
            <View style={base.card}>
              <View style={[base.rowBetween, { marginBottom: 8 }]}>
                <Text style={base.label}>Recent Weigh-ins</Text>
                {weightLogs.length > 0 && <Text style={base.caption}>{weightLogs.length} total</Text>}
              </View>
              {filteredWeights.length === 0 ? (
                <Text style={[base.bodySec, { textAlign: "center", paddingVertical: 16 }]}>No weight data yet</Text>
              ) : (
                [...filteredWeights].reverse().slice(0, 10).map(w => (
                  <View key={w.id} style={[base.rowBetween, { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight }]}>
                    <Text style={{ fontSize: 12, color: C.textSec }}>
                      {new Date(w.timestamp).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{w.weight} lbs</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ===== NUTRITION TAB ===== */}
        {tab === "nutrition" && (
          <View>
            {/* Weekly Calorie Adherence */}
            <View style={base.card}>
              <Text style={[base.label, { marginBottom: 12 }]}>Weekly Calorie Adherence</Text>
              {weeklyAdherence.map(day => {
                const pct = day.calories === 0 ? 0 : Math.min(100, (day.calories / (calorieTarget * 1.3)) * 100);
                const color = day.calories === 0 ? C.cardAlt : day.calories <= calorieTarget * 1.05 ? C.green : day.calories <= calorieTarget * 1.15 ? C.amber : C.red;
                return (
                  <View key={day.date} style={[base.row, { gap: 8, marginBottom: 6 }]}>
                    <Text style={{ width: 28, fontSize: 11, color: C.textDim }}>
                      {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                    </Text>
                    <View style={{ flex: 1, height: 12, backgroundColor: C.cardAlt, borderRadius: 6, overflow: "hidden" }}>
                      <View style={{ height: 12, borderRadius: 6, backgroundColor: color, width: `${pct}%` }} />
                    </View>
                    <Text style={{ width: 42, textAlign: "right", fontSize: 11, fontFamily: "monospace", color: day.calories === 0 ? C.textDim : day.calories <= calorieTarget ? C.green : C.red }}>
                      {day.calories > 0 ? `${day.calories}` : "---"}
                    </Text>
                  </View>
                );
              })}
              <Text style={[base.caption, { textAlign: "center", marginTop: 8 }]}>Target: {calorieTarget} cal/day</Text>
            </View>

            {/* Macro breakdown */}
            <View style={base.card}>
              <Text style={[base.label, { marginBottom: 12 }]}>7-Day Macro Split</Text>
              {/* Stacked bar */}
              <View style={{ flexDirection: "row", height: 24, borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
                {macros.protein_pct > 0 && <View style={{ width: `${macros.protein_pct}%`, backgroundColor: C.green }} />}
                {macros.carbs_pct > 0 && <View style={{ width: `${macros.carbs_pct}%`, backgroundColor: C.blue }} />}
                {macros.fat_pct > 0 && <View style={{ width: `${macros.fat_pct}%`, backgroundColor: C.amber }} />}
                {macros.protein_pct === 0 && macros.carbs_pct === 0 && macros.fat_pct === 0 && <View style={{ width: "100%", backgroundColor: C.cardAlt }} />}
              </View>
              <View style={[base.row, { gap: 12 }]}>
                {[
                  { label: "Protein", pct: macros.protein_pct, g: macros.protein_g, color: C.green, target: 30 },
                  { label: "Carbs", pct: macros.carbs_pct, g: macros.carbs_g, color: C.blue, target: 40 },
                  { label: "Fat", pct: macros.fat_pct, g: macros.fat_g, color: C.amber, target: 30 },
                ].map(m => (
                  <View key={m.label} style={{ flex: 1, alignItems: "center" }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: m.color, marginBottom: 4 }} />
                    <Text style={{ fontSize: 11, color: C.textSec }}>{m.label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{m.pct}%</Text>
                    <Text style={{ fontSize: 10, color: C.textDim }}>{m.g}g avg</Text>
                    <Text style={{ fontSize: 9, color: C.textDim }}>target: {m.target}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ===== PATTERNS TAB ===== */}
        {tab === "patterns" && (
          <View>
            {patterns.length > 0 ? (
              <>
                <Text style={[base.caption, { marginBottom: 12 }]}>AI-detected patterns from the last 14 days</Text>
                {patterns.map(p => <PatternCard key={p.id} pattern={p} expanded />)}
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>🔍</Text>
                <Text style={base.bodySec}>Not enough data for pattern detection yet</Text>
                <Text style={[base.caption, { marginTop: 4 }]}>Keep logging for 7-14 days and insights will appear</Text>
              </View>
            )}

            {/* Workout heatmap */}
            <View style={[base.card, { marginTop: 16 }]}>
              <Text style={[base.label, { marginBottom: 12 }]}>Workout Consistency (30d)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                {heatDays.map(d => (
                  <View key={d.date} style={[S.heatCell, d.count >= 2 ? S.heatHigh : d.count === 1 ? S.heatMed : S.heatNone]}>
                    <Text style={[S.heatText, d.count >= 2 && { color: "white" }, d.count === 1 && { color: "#bbf7d0" }]}>
                      {new Date(d.date + "T12:00:00").getDate()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---- Sub-components ---- */

function PatternCard({ pattern, expanded }: { pattern: PatternInsight; expanded?: boolean }) {
  const bgColors: Record<string, string> = {
    overeating: "rgba(127,29,29,0.2)",
    skipping: "rgba(120,53,15,0.2)",
    correlation: "rgba(30,58,138,0.2)",
    positive: "rgba(6,78,59,0.2)",
    suggestion: "rgba(88,28,135,0.2)",
  };
  const borderColors: Record<string, string> = {
    overeating: "rgba(127,29,29,0.4)",
    skipping: "rgba(120,53,15,0.4)",
    correlation: "rgba(30,58,138,0.4)",
    positive: "rgba(6,78,59,0.4)",
    suggestion: "rgba(88,28,135,0.4)",
  };

  return (
    <View style={[S.patternCard, { backgroundColor: bgColors[pattern.type] || C.card, borderColor: borderColors[pattern.type] || C.border }]}>
      <View style={[base.row, { gap: 12 }]}>
        <Text style={{ fontSize: 20 }}>{pattern.icon}</Text>
        <View style={base.flex1}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{pattern.title}</Text>
          {(expanded || true) && <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{pattern.detail}</Text>}
        </View>
      </View>
    </View>
  );
}

function MacroStat({ label, value, pct, target, color }: { label: string; value: number; pct: number; target: number; color: string }) {
  const diff = pct - target;
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 11, color: C.textDim }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>{value}g</Text>
      <Text style={{ fontSize: 11, color: Math.abs(diff) <= 5 ? C.green : diff > 5 ? C.red : C.amber }}>
        {pct}% {diff > 0 ? `(+${diff})` : diff < 0 ? `(${diff})` : "(on target)"}
      </Text>
      <View style={{ width: "100%", height: 4, backgroundColor: C.cardAlt, borderRadius: 99, marginTop: 4 }}>
        <View style={{ height: 4, borderRadius: 99, backgroundColor: color, width: `${Math.min(100, (pct / target) * 100)}%` }} />
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  tabBar: { flexDirection: "row", marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.accent },
  tabLabel: { fontSize: 11, fontWeight: "500", color: C.textDim },
  tabLabelActive: { color: "white" },
  statusCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  statusItem: { width: "46%" },
  statusLabel: { fontSize: 10, color: C.textDim, marginBottom: 2 },
  statusVal: { fontSize: 20, fontWeight: "700", color: C.text },
  statusUnit: { fontSize: 12, fontWeight: "400", color: C.textSec },
  rangeBar: { flexDirection: "row", backgroundColor: C.card, borderRadius: 8, padding: 4, marginBottom: 16 },
  rangeBtn: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: "center" },
  rangeBtnActive: { backgroundColor: C.accent },
  rangeLabel: { fontSize: 11, fontWeight: "500", color: C.textDim },
  rangeLabelActive: { color: "white" },
  axisLabel: { fontSize: 9, color: C.textDim },
  statGrid: { width: "47%", backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: "center" },
  statGridLabel: { fontSize: 10, color: C.textDim, marginBottom: 2 },
  statGridVal: { fontSize: 18, fontWeight: "700", color: C.text },
  patternCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  heatCell: { width: 24, height: 24, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  heatHigh: { backgroundColor: C.green },
  heatMed: { backgroundColor: "rgba(22,163,74,0.5)" },
  heatNone: { backgroundColor: C.cardAlt },
  heatText: { fontSize: 8, color: C.textDim },
});
