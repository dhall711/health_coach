import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert, RefreshControl, StyleSheet, Platform, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { db } from "@/lib/db";
import { API_BASE } from "@/lib/api";
import { getTodayRange, getHistoryRange, getToday } from "@/lib/dates";
import { C, base } from "@/lib/theme";
import ScreenHeader from "@/components/ScreenHeader";
import type { FoodLog, FoodFavorite, FoodAnalysisResult, MealType, WorkoutType, ProgressPhoto } from "@/lib/types";
import { isHealthKitConnected, restoreHealthKitConnection, getLatestWeight } from "@/lib/healthkit";

type TrackType = "food" | "weight" | "workout" | "water" | "mobility" | "selfie";
interface RecentFoodItem { key: string; name: string; meal_type: MealType; calories: number; protein_g: number; carbs_g: number; fat_g: number; items: FoodLog["items"]; lastEaten: string; count: number; }

export default function TrackScreen() {
  const [tab, setTab] = useState<TrackType>("food");
  const [favs, setFavs] = useState<FoodFavorite[]>([]);
  const [entries, setEntries] = useState<FoodLog[]>([]);
  const [history, setHistory] = useState<RecentFoodItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodAnalysisResult | null>(null);
  const [mealType, setMealType] = useState<MealType>("lunch");
  const [desc, setDesc] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [woType, setWoType] = useState<WorkoutType>("amt885");
  const [dur, setDur] = useState(""); const [woCal, setWoCal] = useState(""); const [hr, setHr] = useState("");
  const [weightVal, setWeightVal] = useState("");
  const [hkWeight, setHkWeight] = useState<number | null>(null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; date: string; photo_url: string; weight_at_time: number | null }>>([]);
  const [mobilityDone, setMobilityDone] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const { start: ds, end: de } = getTodayRange();
    const { start: hs, end: he } = getHistoryRange(10);
    try {
      const [favRes, logRes, histRes] = await Promise.all([
        db.from("food_favorites").select("*").order("sort_order"),
        db.from("food_logs").select("*").gte("timestamp", ds).lte("timestamp", de).order("timestamp", { ascending: false }),
        db.from("food_logs").select("*").gte("timestamp", hs).lte("timestamp", he).order("timestamp", { ascending: false }),
      ]);
      if (favRes.error) console.warn("food_favorites error:", favRes.error.message);
      if (logRes.error) console.warn("food_logs error:", logRes.error.message);
      if (histRes.error) console.warn("food_logs history error:", histRes.error.message);
      if (favRes.data) setFavs(favRes.data as FoodFavorite[]);
      if (logRes.data) setEntries(logRes.data as FoodLog[]);
      if (histRes.data && histRes.data.length > 0) {
        const m = new Map<string, RecentFoodItem>();
        for (const lg of histRes.data as FoodLog[]) {
          const n = lg.items && Array.isArray(lg.items) ? (lg.items as Array<{name:string}>).map(i=>i.name).join(", ") : lg.meal_type;
          const k = n.toLowerCase().trim();
          if (m.has(k)) m.get(k)!.count += 1;
          else m.set(k, { key: k, name: n, meal_type: lg.meal_type as MealType, calories: lg.total_calories, protein_g: lg.protein_g, carbs_g: lg.carbs_g, fat_g: lg.fat_g, items: lg.items, lastEaten: lg.timestamp, count: 1 });
        }
        setHistory(Array.from(m.values()).sort((a, b) => b.count - a.count));
      } else setHistory([]);
      // Load HealthKit weight if available
      if (Platform.OS === "ios") {
        try {
          const connected = await isHealthKitConnected();
          if (connected) {
            await restoreHealthKitConnection();
            const w = await getLatestWeight();
            setHkWeight(w);
          }
        } catch (e) {
          console.warn("HealthKit weight error:", e);
        }
      }
    } catch (err) {
      console.warn("Track data load error:", err);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Needed", "Camera access is required to take food photos."); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
    if (r.canceled || !r.assets[0].base64) return;
    setAnalyzing(true);
    try { const res = await fetch(`${API_BASE}/api/food/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: r.assets[0].base64, mimeType: "image/jpeg" }) }); if (res.ok) setResult(await res.json()); else Alert.alert("Error", "Failed"); } catch { Alert.alert("Error", "Network error"); } finally { setAnalyzing(false); }
  };
  const analyzeText = async () => { if (!desc.trim()) return; setAnalyzing(true); try { const res = await fetch(`${API_BASE}/api/food/analyze-text`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: desc }) }); if (res.ok) setResult(await res.json()); } catch {} finally { setAnalyzing(false); } };
  const saveFood = async () => { if (!result) return; await db.from("food_logs").insert({ meal_type: mealType, items: result.items, total_calories: result.total_calories, protein_g: result.total_protein_g, carbs_g: result.total_carbs_g, fat_g: result.total_fat_g, portion_notes: result.portion_assessment, input_method: "camera", confirmed: true }); setResult(null); setDesc(""); load(); };
  const logFav = async (f: FoodFavorite) => { await db.from("food_logs").insert({ meal_type: f.meal_type, items: [{ name: f.name, calories: f.default_calories, protein_g: f.default_protein_g, carbs_g: f.default_carbs_g, fat_g: f.default_fat_g, portion_size: "1 serving", portion_notes: "" }], total_calories: f.default_calories, protein_g: f.default_protein_g, carbs_g: f.default_carbs_g, fat_g: f.default_fat_g, input_method: "favorite", confirmed: true }); load(); };
  const reLog = async (it: RecentFoodItem) => { await db.from("food_logs").insert({ meal_type: it.meal_type, items: it.items, total_calories: it.calories, protein_g: it.protein_g, carbs_g: it.carbs_g, fat_g: it.fat_g, input_method: "favorite", confirmed: true }); load(); };
  const deleteEntry = async (id: string) => {
    Alert.alert("Delete Entry", "Remove this food log entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await db.from("food_logs").delete().eq("id", id);
        load();
      }},
    ]);
  };
  const saveWO = async () => { if (!dur) return; await db.from("workouts").insert({ type: woType, duration_min: parseInt(dur), calories_burned: woCal ? parseInt(woCal) : 0, avg_hr: hr ? parseInt(hr) : null, source: "manual" }); setDur(""); setWoCal(""); setHr(""); Alert.alert("Saved", "Workout logged!"); };
  const saveW = async () => { const w = parseFloat(weightVal); if (isNaN(w)) return; await db.from("weight_logs").insert({ weight: w, source: "manual" }); setWeightVal(""); Alert.alert("Saved", `${w} lbs logged`); };
  const addWater = async (oz: number) => { await db.from("water_logs").insert({ amount_oz: oz }); Alert.alert("Logged", `+${oz}oz`); };

  // --- Selfie / Progress Photos ---
  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/photos`);
      if (res.ok) {
        const data = await res.json();
        setRecentPhotos(data.slice(0, 6));
      }
    } catch {}
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  // Check mobility status for today
  useEffect(() => {
    const checkMobility = async () => {
      const today = getToday();
      const { data } = await db.from("mobility_logs").select("id").eq("date", today).limit(1);
      setMobilityDone(!!(data && data.length > 0));
    };
    checkMobility();
  }, []);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Needed", "Camera access is required to take progress photos."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
    if (result.canceled || !result.assets[0].base64) return;
    setSelfieUploading(true);
    try {
      const res = await fetch(`${API_BASE}/api/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg", notes: "Progress photo" }),
      });
      if (res.ok) {
        Alert.alert("Saved", "Progress photo saved!");
        loadPhotos();
      } else {
        Alert.alert("Error", "Failed to upload photo");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setSelfieUploading(false);
    }
  };

  const pickSelfieFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Needed", "Photo library access is required to choose photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, base64: true });
    if (result.canceled || !result.assets[0].base64) return;
    setSelfieUploading(true);
    try {
      const res = await fetch(`${API_BASE}/api/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: result.assets[0].base64, mimeType: "image/jpeg", notes: "Progress photo" }),
      });
      if (res.ok) {
        Alert.alert("Saved", "Progress photo saved!");
        loadPhotos();
      } else {
        Alert.alert("Error", "Failed to upload photo");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setSelfieUploading(false);
    }
  };

  const logMobility = async (routineType: "quick_5min" | "full_10min") => {
    const exercises = routineType === "quick_5min"
      ? ["Cat-Cow", "Hip Circles", "Seated Twist", "Hamstring Stretch", "Ankle Circles"]
      : ["Cat-Cow", "Hip Circles", "Seated Twist", "Hamstring Stretch", "Ankle Circles", "Child's Pose", "Thread the Needle", "Hip Flexor Stretch", "Spinal Decompression", "Shoulder Rolls"];
    await db.from("mobility_logs").insert({
      routine_type: routineType,
      exercises_completed: exercises,
      pain_level: 3,
    });
    setMobilityDone(true);
    Alert.alert("Logged", `${routineType === "quick_5min" ? "Quick 5-minute" : "Full 10-minute"} mobility routine completed!`);
  };

  const tabs: { t: TrackType; icon: string; label: string }[] = [{ t: "food", icon: "🍽️", label: "Food" }, { t: "weight", icon: "⚖️", label: "Weight" }, { t: "workout", icon: "💪", label: "Workout" }, { t: "water", icon: "💧", label: "Water" }, { t: "mobility", icon: "🧘", label: "Mobility" }, { t: "selfie", icon: "📸", label: "Selfie" }];
  const woTypes: { t: WorkoutType; icon: string; label: string }[] = [{ t: "amt885", icon: "🏃", label: "AMT 885" }, { t: "mobility", icon: "🧘", label: "Mobility" }, { t: "flexibility", icon: "🤸", label: "Flex" }, { t: "walk", icon: "🚶", label: "Walk" }, { t: "other", icon: "💪", label: "Other" }];
  const todayCal = entries.reduce((s, l) => s + (l.total_calories || 0), 0);

  return (
    <SafeAreaView style={S.screen}>
      <ScreenHeader title="Track" subtitle={`Log anything in under 5 seconds${todayCal > 0 ? ` · ${todayCal} cal today` : ""}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}>

        {/* Tab pills */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {tabs.map(t => (
            <Pressable key={t.t} style={[S.pill, tab === t.t && S.pillActive]} onPress={() => setTab(t.t)}>
              <Text style={{ fontSize: 13 }}>{t.icon}</Text>
              <Text style={[S.pillText, tab === t.t && S.pillTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* FOOD TAB */}
        {tab === "food" && (
          <View>
            {result ? (
              <View style={S.resultCard}>
                <Text style={{ fontWeight: "600", color: C.emerald, fontSize: 14, marginBottom: 8 }}>AI Analysis</Text>
                {result.items.map((it, i) => (
                  <View key={i} style={[base.rowBetween, { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight }]}>
                    <Text style={{ fontSize: 13, color: C.text }}>{it.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{it.calories} cal</Text>
                  </View>
                ))}
                <View style={[base.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(6,78,59,0.4)" }]}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>Total</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: C.text }}>{result.total_calories} cal</Text>
                </View>
                <Text style={[base.caption, { marginTop: 4 }]}>P: {result.total_protein_g}g · C: {result.total_carbs_g}g · F: {result.total_fat_g}g</Text>
                <View style={[base.row, { flexWrap: "wrap", gap: 6, marginTop: 12 }]}>
                  {(["breakfast", "lunch", "dinner", "snack", "drink"] as MealType[]).map(mt => (
                    <Pressable key={mt} onPress={() => setMealType(mt)} style={[S.mealPill, mealType === mt && S.mealPillActive]}>
                      <Text style={{ fontSize: 12, color: mealType === mt ? "white" : C.textSec }}>{mt}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={[base.row, { gap: 8, marginTop: 12 }]}>
                  <Pressable style={[S.saveBtn, base.flex1]} onPress={saveFood}><Text style={S.saveBtnText}>Confirm & Save</Text></Pressable>
                  <Pressable style={S.discardBtn} onPress={() => setResult(null)}><Text style={{ color: C.textSec, fontSize: 14 }}>Discard</Text></Pressable>
                </View>
              </View>
            ) : (
              <>
                <Pressable style={S.cameraBtn} onPress={pickPhoto} disabled={analyzing}>
                  {analyzing ? <Text style={{ color: "white", fontSize: 14 }}>Analyzing your food...</Text> : (
                    <><Ionicons name="camera" size={40} color="white" /><Text style={{ color: "white", fontSize: 14, marginTop: 8 }}>Tap to snap your meal</Text><Text style={{ color: "#7dd3fc", fontSize: 12, marginTop: 4 }}>AI analyzes portions, calories, and macros</Text></>
                  )}
                </Pressable>
                <TextInput style={S.input} placeholder="Or describe what you ate..." placeholderTextColor={C.textDim} value={desc} onChangeText={setDesc} />
                {desc.trim().length > 0 && <Pressable style={[S.analyzeBtn, { marginTop: 8, marginBottom: 12 }]} onPress={analyzeText}><Text style={S.saveBtnText}>Analyze</Text></Pressable>}
                <View style={{ marginTop: 12, marginBottom: 12 }}>
                  <Text style={[base.label, { marginBottom: 8 }]}>Quick Favorites</Text>
                  {favs.length > 0 ? (
                    <View style={[base.row, { flexWrap: "wrap", gap: 8 }]}>
                      {favs.map(f => (
                        <Pressable key={f.id} onPress={() => logFav(f)} style={S.favCard}>
                          <Text style={{ fontSize: 20 }}>{f.icon}</Text>
                          <Text style={{ fontSize: 11, fontWeight: "500", color: C.text, marginTop: 4 }} numberOfLines={1}>{f.name}</Text>
                          <Text style={{ fontSize: 10, color: C.textDim }}>{f.default_calories} cal</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <View style={S.emptyCard}>
                      <Text style={base.caption}>Log foods to build your favorites list</Text>
                    </View>
                  )}
                </View>
                {history.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[base.label, { marginBottom: 8 }]}>Recent Foods (Past 10 Days)</Text>
                    {history.map(it => {
                      const d = Math.round((Date.now() - new Date(it.lastEaten).getTime()) / 864e5);
                      return (
                        <View key={it.key} style={S.histRow}>
                          <View style={base.flex1}>
                            <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }} numberOfLines={1}>{it.name}</Text>
                            <Text style={base.caption}>{it.calories} cal{it.count > 1 ? ` · ${it.count}x` : ""} · {d === 1 ? "yesterday" : `${d}d ago`}</Text>
                          </View>
                          <Pressable style={S.logBtn} onPress={() => reLog(it)}><Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>+ Log</Text></Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
            {/* Today's Food Log -- always visible */}
            <View style={{ marginTop: 16, marginBottom: 8 }}>
              <View style={[base.rowBetween, { marginBottom: 8 }]}>
                <Text style={base.label}>Today's Food Log</Text>
                {entries.length > 0 && <Text style={base.caption}>{todayCal} cal total</Text>}
              </View>
              {entries.length === 0 ? (
                <View style={S.emptyCard}>
                  <Ionicons name="restaurant-outline" size={28} color={C.textDim} />
                  <Text style={[base.bodySec, { marginTop: 8 }]}>No food logged yet today</Text>
                  <Text style={base.caption}>Snap a photo or describe your meal above</Text>
                </View>
              ) : (
                entries.map(lg => {
                  const nm = lg.items && Array.isArray(lg.items) ? (lg.items as Array<{name:string}>).map(i=>i.name).join(", ") : lg.meal_type;
                  return (
                    <Pressable key={lg.id} style={S.logEntry} onLongPress={() => deleteEntry(lg.id)}>
                      <View style={S.mealBadge}><Text style={{ fontSize: 12 }}>{lg.meal_type === "breakfast" ? "🌅" : lg.meal_type === "lunch" ? "☀️" : lg.meal_type === "dinner" ? "🌙" : lg.meal_type === "snack" ? "🍪" : "🥤"}</Text></View>
                      <View style={base.flex1}>
                        <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }} numberOfLines={1}>{nm}</Text>
                        <Text style={base.caption}>{lg.meal_type} · {new Date(lg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }}>{lg.total_calories} cal</Text>
                        <Text style={{ fontSize: 10, color: C.textDim }}>P:{lg.protein_g}g C:{lg.carbs_g}g F:{lg.fat_g}g</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* WEIGHT TAB */}
        {tab === "weight" && (
          <View style={base.card}>
            <Text style={base.h3}>Log Weight</Text>
            <Text style={[base.caption, { marginBottom: 16 }]}>Morning, fasted — most accurate</Text>
            {hkWeight && !weightVal && (
              <Pressable
                style={S.hkSuggest}
                onPress={() => setWeightVal(String(hkWeight))}
              >
                <View style={[base.row, { gap: 6 }]}>
                  <Ionicons name="heart-circle" size={16} color={C.red} />
                  <Text style={{ fontSize: 13, color: C.textSec }}>
                    Apple Health: <Text style={{ fontWeight: "700", color: C.text }}>{hkWeight} lbs</Text>
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: C.accent, fontWeight: "500" }}>Use</Text>
              </Pressable>
            )}
            <View style={[base.row, { gap: 12 }]}>
              <TextInput style={[S.input, base.flex1, { fontSize: 18 }]} placeholder="e.g. 218.5" placeholderTextColor={C.textDim} keyboardType="decimal-pad" value={weightVal} onChangeText={setWeightVal} />
              <Pressable style={S.analyzeBtn} onPress={saveW}><Text style={S.saveBtnText}>Save</Text></Pressable>
            </View>
          </View>
        )}

        {/* WORKOUT TAB */}
        {tab === "workout" && (
          <View style={base.card}>
            <Text style={[base.h3, { marginBottom: 12 }]}>Log Workout</Text>
            <View style={[base.row, { flexWrap: "wrap", gap: 6, marginBottom: 12 }]}>
              {woTypes.map(w => (
                <Pressable key={w.t} onPress={() => setWoType(w.t)} style={[S.mealPill, woType === w.t && S.mealPillActive]}>
                  <Text style={{ fontSize: 12, color: woType === w.t ? "white" : C.textSec }}>{w.icon} {w.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[base.row, { gap: 8, marginBottom: 12 }]}>
              <View style={base.flex1}><Text style={[base.caption, { marginBottom: 4 }]}>Duration</Text><TextInput style={S.input} placeholder="min" placeholderTextColor={C.textDim} keyboardType="number-pad" value={dur} onChangeText={setDur} /></View>
              <View style={base.flex1}><Text style={[base.caption, { marginBottom: 4 }]}>Calories</Text><TextInput style={S.input} placeholder="cal" placeholderTextColor={C.textDim} keyboardType="number-pad" value={woCal} onChangeText={setWoCal} /></View>
              <View style={base.flex1}><Text style={[base.caption, { marginBottom: 4 }]}>Avg HR</Text><TextInput style={S.input} placeholder="bpm" placeholderTextColor={C.textDim} keyboardType="number-pad" value={hr} onChangeText={setHr} /></View>
            </View>
            <Pressable style={[S.saveBtn, { opacity: dur ? 1 : 0.5 }]} onPress={saveWO} disabled={!dur}><Text style={S.saveBtnText}>Save Workout</Text></Pressable>
          </View>
        )}

        {/* WATER TAB */}
        {tab === "water" && (
          <View style={[base.card, { alignItems: "center" }]}>
            <Text style={base.h3}>Log Water</Text>
            <Text style={[base.caption, { marginBottom: 20 }]}>Quick taps to stay hydrated</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              {[8, 12, 16, 24].map(oz => (
                <Pressable key={oz} onPress={() => addWater(oz)} style={S.waterCard}>
                  <Text style={{ color: C.blueText, fontSize: 18, fontWeight: "600" }}>+{oz}oz</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* MOBILITY TAB */}
        {tab === "mobility" && (
          <View>
            {mobilityDone && (
              <View style={[base.card, { alignItems: "center", marginBottom: 16 }]}>
                <Ionicons name="checkmark-circle" size={40} color={C.emerald} />
                <Text style={[base.h3, { marginTop: 8 }]}>Mobility Done Today!</Text>
                <Text style={base.caption}>Great job keeping flexible</Text>
              </View>
            )}
            <Pressable
              style={S.mobilityCard}
              onPress={() => router.push("/mobility")}
            >
              <View style={[base.row, { gap: 12 }]}>
                <Text style={{ fontSize: 28 }}>⚡</Text>
                <View style={base.flex1}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>Start Guided Routine</Text>
                  <Text style={{ fontSize: 12, color: C.textSec }}>Step-by-step timer with instructions</Text>
                  <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Choose Quick (5 min) or Full (10 min)</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textDim} />
              </View>
            </Pressable>
            <View style={[base.card, { marginTop: 12 }]}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: C.textSec, marginBottom: 4 }}>About these routines</Text>
              <Text style={{ fontSize: 12, color: C.textDim, lineHeight: 18 }}>
                All exercises are designed for Forestier&apos;s disease (DISH) and osteoarthritis. Seated options available. Focus on gentle spinal mobility, hip flexibility, and hamstring range.
              </Text>
            </View>
          </View>
        )}

        {/* SELFIE TAB */}
        {tab === "selfie" && (
          <View>
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Pressable
                style={S.selfieBtn}
                onPress={takeSelfie}
                disabled={selfieUploading}
              >
                {selfieUploading ? (
                  <Text style={{ color: "white", fontSize: 14 }}>Uploading...</Text>
                ) : (
                  <>
                    <Ionicons name="camera" size={40} color="white" />
                    <Text style={{ color: "white", fontSize: 14, marginTop: 8 }}>Take Progress Photo</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={S.galleryBtn} onPress={pickSelfieFromGallery} disabled={selfieUploading}>
                <Ionicons name="images-outline" size={18} color={C.accent} />
                <Text style={{ color: C.accent, fontSize: 13, fontWeight: "500" }}>Choose from Gallery</Text>
              </Pressable>
              <Text style={[base.caption, { marginTop: 8 }]}>Private — stored securely, only visible to you</Text>
            </View>

            {/* Recent Photos Grid */}
            {recentPhotos.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text style={[base.label, { marginBottom: 8 }]}>Recent Photos</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {recentPhotos.map((photo) => (
                    <View key={photo.id} style={S.photoThumb}>
                      <Image source={{ uri: photo.photo_url }} style={S.photoImg} />
                      <View style={S.photoOverlay}>
                        <Text style={{ fontSize: 9, color: "white", fontWeight: "600" }}>
                          {new Date(photo.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </Text>
                        {photo.weight_at_time && (
                          <Text style={{ fontSize: 8, color: "#d1d5db" }}>{photo.weight_at_time} lbs</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: C.card },
  pillActive: { backgroundColor: C.accent },
  pillText: { fontSize: 12, fontWeight: "500", color: C.textDim },
  pillTextActive: { color: "white" },
  cameraBtn: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 24, alignItems: "center", marginBottom: 12 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: C.text, fontSize: 14 },
  analyzeBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, alignItems: "center" },
  resultCard: { backgroundColor: "rgba(6,78,59,0.3)", borderWidth: 1, borderColor: "rgba(6,78,59,0.4)", borderRadius: 16, padding: 16, marginBottom: 16 },
  mealPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: C.cardAlt },
  mealPillActive: { backgroundColor: C.accent },
  saveBtn: { backgroundColor: C.green, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  saveBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
  discardBtn: { backgroundColor: C.cardAlt, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  favCard: { width: "30%", backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, alignItems: "center" },
  histRow: { backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", marginBottom: 6 },
  logBtn: { backgroundColor: "rgba(22,163,74,0.8)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  waterCard: { width: "44%", backgroundColor: C.blueBg, borderWidth: 1, borderColor: C.blueBorder, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  emptyCard: { backgroundColor: C.card, borderRadius: 12, padding: 24, alignItems: "center" },
  logEntry: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 6, gap: 10 },
  mealBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.cardAlt, alignItems: "center", justifyContent: "center" },
  hkSuggest: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  mobilityCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 10 },
  selfieBtn: { width: 120, height: 120, backgroundColor: C.accent, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  galleryBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  photoThumb: { width: "31.5%" as unknown as number, aspectRatio: 3 / 4, borderRadius: 10, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%" },
  photoOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", padding: 4, alignItems: "center" },
});
