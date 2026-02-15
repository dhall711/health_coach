"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import type { FoodFavorite, FoodLog, FoodAnalysisResult, MealType, WorkoutType } from "@/lib/types";

type TrackType = "food" | "weight" | "workout" | "water" | "mobility" | "selfie";

// Deduplicated food item from recent history (past 10 days)
interface RecentFoodItem {
  key: string;          // dedupe key (item names joined)
  name: string;         // display name
  meal_type: MealType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: FoodLog["items"];
  lastEaten: string;    // ISO timestamp of most recent occurrence
  count: number;        // how many times eaten in the window
}

export default function TrackPage() {
  const [activeType, setActiveType] = useState<TrackType>("food");
  const [foodMode, setFoodMode] = useState<"camera" | "voice" | "favorites">("camera");
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("lunch");
  const [recentEntries, setRecentEntries] = useState<FoodLog[]>([]);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [editingResult, setEditingResult] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editCarbs, setEditCarbs] = useState("");
  const [editFat, setEditFat] = useState("");
  const [recentHistory, setRecentHistory] = useState<RecentFoodItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workout form
  const [workoutType, setWorkoutType] = useState<WorkoutType>("amt885");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [workoutNotes, setWorkoutNotes] = useState("");

  // Weight form
  const [weightValue, setWeightValue] = useState("");

  // Parse URL params for initial type
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    if (type && ["food", "weight", "workout", "water", "mobility", "selfie"].includes(type)) {
      setActiveType(type as TrackType);
    }
  }, []);

  const loadData = useCallback(async () => {
    // Compute local day boundaries as UTC ISO strings
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    // Past 10 days (excluding today) for recent history
    const historyStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 0, 0, 0, 0).toISOString();
    const historyEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).toISOString();

    const [{ data: favs }, { data: logs }, { data: historyLogs }] = await Promise.all([
      db.from("food_favorites").select("*").order("sort_order"),
      db
        .from("food_logs")
        .select("*")
        .gte("timestamp", dayStart)
        .lte("timestamp", dayEnd)
        .order("timestamp", { ascending: false }),
      db
        .from("food_logs")
        .select("*")
        .gte("timestamp", historyStart)
        .lte("timestamp", historyEnd)
        .order("timestamp", { ascending: false }),
    ]);

    if (favs) setFavorites(favs as FoodFavorite[]);
    if (logs) setRecentEntries(logs as FoodLog[]);

    // Deduplicate history by item names
    if (historyLogs && historyLogs.length > 0) {
      const histMap = new Map<string, RecentFoodItem>();
      for (const log of historyLogs as FoodLog[]) {
        const itemNames = log.items && Array.isArray(log.items)
          ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
          : log.meal_type;
        const key = itemNames.toLowerCase().trim();
        if (histMap.has(key)) {
          const existing = histMap.get(key)!;
          existing.count += 1;
          // Keep the most recent occurrence's data
          if (log.timestamp > existing.lastEaten) {
            existing.lastEaten = log.timestamp;
          }
        } else {
          histMap.set(key, {
            key,
            name: itemNames,
            meal_type: log.meal_type as MealType,
            calories: log.total_calories,
            protein_g: log.protein_g,
            carbs_g: log.carbs_g,
            fat_g: log.fat_g,
            items: log.items,
            lastEaten: log.timestamp,
            count: 1,
          });
        }
      }
      // Sort by most recently eaten, then by frequency
      const deduped = Array.from(histMap.values()).sort((a, b) => {
        // Frequent items first, then by recency
        if (b.count !== a.count) return b.count - a.count;
        return b.lastEaten.localeCompare(a.lastEaten);
      });
      setRecentHistory(deduped);
    } else {
      setRecentHistory([]);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flash success message
  const showSuccess = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(null), 2000);
  };

  // --- Photo Analysis ---
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const mimeType = file.type || "image/jpeg";
        const res = await fetch("/api/food/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        if (res.ok) {
          setAnalysisResult(await res.json());
        } else {
          alert("Failed to analyze image. Please try again.");
        }
        setAnalyzing(false);
      };
      reader.readAsDataURL(file);
    } catch {
      alert("Error processing image.");
      setAnalyzing(false);
    }
  };

  // --- Voice ---
  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported. Try Chrome or Safari.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      setVoiceText(event.results[0][0].transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const analyzeVoiceText = async () => {
    if (!voiceText.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/food/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceText }),
      });
      if (res.ok) {
        setAnalysisResult(await res.json());
      } else {
        alert("Failed to analyze. Please try again.");
      }
    } catch {
      alert("Error analyzing food description.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Re-analyze with manual correction ---
  const analyzeCorrection = async () => {
    if (!correctionText.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/food/analyze-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: correctionText }),
      });
      if (res.ok) {
        setAnalysisResult(await res.json());
        setShowCorrection(false);
        setCorrectionText("");
      } else {
        alert("Failed to analyze. Please try again.");
      }
    } catch {
      alert("Error analyzing food description.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Update analysis result field ---
  const updateResultField = (field: "total_calories" | "total_protein_g" | "total_carbs_g" | "total_fat_g", value: string) => {
    if (!analysisResult) return;
    setAnalysisResult({ ...analysisResult, [field]: parseInt(value) || 0 });
  };

  // --- Save food ---
  const saveFoodLog = async (inputMethod: "camera" | "voice" | "favorite" | "manual") => {
    if (!analysisResult) return;
    const { error } = await db.from("food_logs").insert({
      meal_type: selectedMealType,
      items: analysisResult.items,
      total_calories: analysisResult.total_calories,
      protein_g: analysisResult.total_protein_g,
      carbs_g: analysisResult.total_carbs_g,
      fat_g: analysisResult.total_fat_g,
      portion_notes: analysisResult.portion_assessment,
      input_method: inputMethod,
      confirmed: true,
    });
    if (!error) {
      setAnalysisResult(null);
      setVoiceText("");
      showSuccess(`Logged ${analysisResult.total_calories} cal`);
      loadData();
    }
  };

  // --- Quick log favorite ---
  const logFavorite = async (fav: FoodFavorite) => {
    const { error } = await db.from("food_logs").insert({
      meal_type: fav.meal_type,
      items: [{ name: fav.name, calories: fav.default_calories, protein_g: fav.default_protein_g, carbs_g: fav.default_carbs_g, fat_g: fav.default_fat_g, portion_size: "1 serving", portion_notes: "" }],
      total_calories: fav.default_calories,
      protein_g: fav.default_protein_g,
      carbs_g: fav.default_carbs_g,
      fat_g: fav.default_fat_g,
      input_method: "favorite",
      confirmed: true,
    });
    if (!error) {
      showSuccess(`${fav.name} logged`);
      loadData();
    }
  };

  // --- Save workout ---
  const saveWorkout = async () => {
    if (!duration) return;
    const { error } = await db.from("workouts").insert({
      type: workoutType,
      duration_min: parseInt(duration),
      calories_burned: calories ? parseInt(calories) : 0,
      avg_hr: avgHr ? parseInt(avgHr) : null,
      notes: workoutNotes || null,
      source: "manual",
    });
    if (!error) {
      setDuration("");
      setCalories("");
      setAvgHr("");
      setWorkoutNotes("");
      showSuccess("Workout logged!");
    }
  };

  // --- Save weight ---
  const saveWeight = async () => {
    if (!weightValue) return;
    const w = parseFloat(weightValue);
    if (isNaN(w)) return;
    const { error } = await db.from("weight_logs").insert({
      weight: w,
      source: "manual",
    });
    if (!error) {
      setWeightValue("");
      showSuccess(`${w} lbs logged`);
    }
  };

  // --- Add water ---
  const addWater = async (oz: number) => {
    const { error } = await db.from("water_logs").insert({ amount_oz: oz });
    if (!error) showSuccess(`+${oz}oz water`);
  };

  // --- Delete food log ---
  const deleteFoodLog = async (id: string) => {
    if (!confirm("Delete this food entry?")) return;
    const { error } = await db.from("food_logs").delete().eq("id", id);
    if (!error) {
      showSuccess("Entry deleted");
      loadData();
    }
  };

  // --- Start editing a food log ---
  const startEditLog = (log: FoodLog) => {
    setEditingLogId(log.id);
    setEditCalories(String(log.total_calories || 0));
    setEditProtein(String(log.protein_g || 0));
    setEditCarbs(String(log.carbs_g || 0));
    setEditFat(String(log.fat_g || 0));
  };

  // --- Save edited food log ---
  const saveEditLog = async (id: string) => {
    const { error } = await db.from("food_logs").update({
      total_calories: parseInt(editCalories) || 0,
      protein_g: parseInt(editProtein) || 0,
      carbs_g: parseInt(editCarbs) || 0,
      fat_g: parseInt(editFat) || 0,
    }).eq("id", id);
    if (!error) {
      setEditingLogId(null);
      showSuccess("Entry updated");
      loadData();
    }
  };

  // --- Save food log as favorite ---
  const saveAsFavorite = async (log: FoodLog) => {
    const itemNames = log.items && Array.isArray(log.items)
      ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
      : log.meal_type;
    const { error } = await db.from("food_favorites").insert({
      name: itemNames.length > 30 ? itemNames.substring(0, 27) + "..." : itemNames,
      icon: log.meal_type === "breakfast" ? "🌅" : log.meal_type === "lunch" ? "☀️" : log.meal_type === "dinner" ? "🌙" : log.meal_type === "drink" ? "🥤" : "🍽️",
      default_calories: log.total_calories,
      default_protein_g: log.protein_g,
      default_carbs_g: log.carbs_g,
      default_fat_g: log.fat_g,
      meal_type: log.meal_type,
      sort_order: favorites.length,
    });
    if (!error) {
      showSuccess("Saved as favorite!");
      loadData();
    }
  };

  // --- Re-log from recent history ---
  const reLogFromHistory = async (item: RecentFoodItem) => {
    const { error } = await db.from("food_logs").insert({
      meal_type: item.meal_type,
      items: item.items,
      total_calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      input_method: "favorite" as const,
      confirmed: true,
    });
    if (!error) {
      showSuccess(`${item.name} logged (${item.calories} cal)`);
      loadData();
    }
  };

  // --- Save history item as favorite ---
  const saveHistoryAsFavorite = async (item: RecentFoodItem) => {
    const { error } = await db.from("food_favorites").insert({
      name: item.name.length > 30 ? item.name.substring(0, 27) + "..." : item.name,
      icon: item.meal_type === "breakfast" ? "🌅" : item.meal_type === "lunch" ? "☀️" : item.meal_type === "dinner" ? "🌙" : item.meal_type === "drink" ? "🥤" : "🍽️",
      default_calories: item.calories,
      default_protein_g: item.protein_g,
      default_carbs_g: item.carbs_g,
      default_fat_g: item.fat_g,
      meal_type: item.meal_type,
      sort_order: favorites.length,
    });
    if (!error) {
      showSuccess("Saved as favorite!");
      loadData();
    }
  };

  // --- Log selfie ---
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; date: string; photo_url: string; weight_at_time: number | null }>>([]);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await fetch("/api/photos");
      if (res.ok) {
        const data = await res.json();
        setRecentPhotos(data.slice(0, 6));
      }
    } catch {}
  }, []);

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const handleSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type, notes: "Daily progress selfie" }),
        });
        if (res.ok) {
          showSuccess("Progress photo saved!");
          loadPhotos();
        }
        setSelfieUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setSelfieUploading(false);
    }
    if (selfieInputRef.current) selfieInputRef.current.value = "";
  };

  const todayCalories = recentEntries.reduce((sum, l) => sum + (l.total_calories || 0), 0);

  const trackTypes: { type: TrackType; icon: string; label: string }[] = [
    { type: "food", icon: "🍽️", label: "Food" },
    { type: "weight", icon: "⚖️", label: "Weight" },
    { type: "workout", icon: "💪", label: "Workout" },
    { type: "water", icon: "💧", label: "Water" },
    { type: "mobility", icon: "🧘", label: "Mobility" },
    { type: "selfie", icon: "📸", label: "Selfie" },
  ];

  const workoutTypes: { type: WorkoutType; icon: string; label: string }[] = [
    { type: "amt885", icon: "🏃", label: "AMT 885" },
    { type: "mobility", icon: "🧘", label: "Mobility" },
    { type: "flexibility", icon: "🤸", label: "Flex" },
    { type: "walk", icon: "🚶", label: "Walk" },
    { type: "other", icon: "💪", label: "Other" },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="w-8 h-8 bg-[var(--card)] rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        </Link>
        <div>
        <h1 className="text-xl font-bold text-white">Track</h1>
        <p className="text-xs text-slate-400">
          Log anything in under 5 seconds
          {todayCalories > 0 && ` · ${todayCalories} cal today`}
        </p>
        </div>
      </div>

      {/* Success banner */}
      {saveSuccess && (
        <div className="bg-green-900/40 border border-green-700/40 text-green-300 rounded-xl px-4 py-2.5 mb-4 text-sm font-medium text-center animate-[fadeIn_0.2s_ease-out]">
          {saveSuccess}
        </div>
      )}

      {/* Type Selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {trackTypes.map((t) => (
          <button
            key={t.type}
            onClick={() => setActiveType(t.type)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeType === t.type
                ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20"
                : "bg-[var(--card)] text-slate-400 hover:text-white"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* FOOD TRACKING */}
      {activeType === "food" && (
        <div>
          {/* Analysis Result */}
          {analysisResult && (
            <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-emerald-300 text-sm">AI Analysis</h3>
                <button
                  onClick={() => setEditingResult(!editingResult)}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors px-2 py-0.5 rounded-full bg-slate-700/50"
                >
                  {editingResult ? "Done editing" : "Edit values"}
                </button>
              </div>

              {analysisResult.items.map((item, i) => (
                <div key={i} className="flex justify-between py-1 border-b border-slate-700/50 last:border-0">
                  <span className="text-sm">{item.name}</span>
                  <span className="text-sm font-semibold">{item.calories} cal</span>
                </div>
              ))}

              {/* Totals -- editable or read-only */}
              {editingResult ? (
                <div className="mt-2 pt-2 border-t border-emerald-700/40 grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Calories</label>
                    <input
                      type="number"
                      value={analysisResult.total_calories}
                      onChange={(e) => updateResultField("total_calories", e.target.value)}
                      className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Protein</label>
                    <input
                      type="number"
                      value={analysisResult.total_protein_g}
                      onChange={(e) => updateResultField("total_protein_g", e.target.value)}
                      className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Carbs</label>
                    <input
                      type="number"
                      value={analysisResult.total_carbs_g}
                      onChange={(e) => updateResultField("total_carbs_g", e.target.value)}
                      className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Fat</label>
                    <input
                      type="number"
                      value={analysisResult.total_fat_g}
                      onChange={(e) => updateResultField("total_fat_g", e.target.value)}
                      className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-2 pt-2 border-t border-emerald-700/40 flex justify-between font-semibold text-sm">
                    <span>Total</span>
                    <span>{analysisResult.total_calories} cal</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    P: {analysisResult.total_protein_g}g · C: {analysisResult.total_carbs_g}g · F: {analysisResult.total_fat_g}g
                  </p>
                </>
              )}

              {analysisResult.portion_assessment && (
                <p className="text-xs text-amber-300 mt-2">📏 {analysisResult.portion_assessment}</p>
              )}
              {analysisResult.suggestion && (
                <p className="text-xs text-sky-300 mt-1">💡 {analysisResult.suggestion}</p>
              )}

              {/* Meal type selector */}
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {(["breakfast", "lunch", "dinner", "snack", "drink"] as MealType[]).map((mt) => (
                  <button key={mt} onClick={() => setSelectedMealType(mt)} className={`text-xs px-2.5 py-1 rounded-full ${selectedMealType === mt ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-300"}`}>
                    {mt}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <button onClick={() => saveFoodLog(foodMode === "voice" ? "voice" : "camera")} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold active:opacity-80">
                  Confirm & Save
                </button>
                <button onClick={() => setAnalysisResult(null)} className="bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm">
                  Discard
                </button>
              </div>

              {/* Not accurate? Describe manually */}
              <div className="mt-3 pt-3 border-t border-emerald-700/30">
                {!showCorrection ? (
                  <button
                    onClick={() => setShowCorrection(true)}
                    className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors py-1.5 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                    Not accurate? Describe what you actually ate
                  </button>
                ) : (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Describe the food and portions for a new analysis:</p>
                    <textarea
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      placeholder="e.g. A large bowl of pasta with meat sauce, about 2 cups, with garlic bread on the side"
                      rows={3}
                      className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={analyzeCorrection}
                        disabled={!correctionText.trim() || analyzing}
                        className="flex-1 bg-sky-600 text-white py-2 rounded-lg text-sm font-semibold active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        {analyzing ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Re-analyzing...
                          </>
                        ) : (
                          "Re-analyze"
                        )}
                      </button>
                      <button
                        onClick={() => { setShowCorrection(false); setCorrectionText(""); }}
                        className="bg-slate-700 text-slate-400 px-3 py-2 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!analysisResult && (
            <>
              {/* Food Input Mode */}
              <div className="flex gap-2 mb-4">
                {(["camera", "voice", "favorites"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFoodMode(mode)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      foodMode === mode ? "bg-[var(--card)] text-white border border-slate-600" : "text-slate-500"
                    }`}
                  >
                    {mode === "camera" && "📷 Photo"}
                    {mode === "voice" && "🎤 Voice"}
                    {mode === "favorites" && "⭐ Quick"}
                  </button>
                ))}
              </div>

              {/* Camera */}
              {foodMode === "camera" && (
                <div className="text-center py-6">
                  <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoCapture} className="hidden" />
                  {analyzing ? (
                    <div>
                      <div className="w-12 h-12 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-sm text-slate-300">Analyzing your food...</p>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 bg-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-3 active:opacity-80 shadow-lg shadow-sky-600/20">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                        </svg>
                      </button>
                      <p className="text-sm text-slate-300">Tap to snap your meal</p>
                      <p className="text-xs text-slate-500 mt-1">AI analyzes portions, calories, and macros</p>
                    </>
                  )}
                </div>
              )}

              {/* Voice */}
              {foodMode === "voice" && (
                <div className="text-center py-6">
                  {analyzing ? (
                    <div>
                      <div className="w-12 h-12 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-sm text-slate-300">Analyzing...</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={startListening}
                        className={`w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg ${isListening ? "bg-red-600 animate-pulse shadow-red-600/20" : "bg-[var(--card)] border border-slate-600"}`}
                      >
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                        </svg>
                      </button>
                      <p className="text-sm text-slate-300">{isListening ? "Listening..." : "Tap to describe what you ate"}</p>
                      <div className="mt-4 px-2">
                        <input
                          type="text"
                          value={voiceText}
                          onChange={(e) => setVoiceText(e.target.value)}
                          placeholder="Or type what you ate..."
                          className="w-full bg-[var(--card)] border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        {voiceText && (
                          <button onClick={analyzeVoiceText} className="mt-2 w-full bg-sky-600 text-white py-2.5 rounded-xl font-semibold text-sm active:opacity-80">
                            Analyze &quot;{voiceText}&quot;
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Favorites */}
              {foodMode === "favorites" && (
                <div className="grid grid-cols-3 gap-2">
                  {favorites.map((fav) => (
                    <button key={fav.id} onClick={() => logFavorite(fav)} className="bg-[var(--card)] border border-slate-700 rounded-xl p-3 text-center card-press hover:border-slate-500 transition-colors">
                      <span className="text-2xl">{fav.icon}</span>
                      <p className="text-xs font-medium mt-1 truncate">{fav.name}</p>
                      <p className="text-[10px] text-slate-500">{fav.default_calories} cal</p>
                    </button>
                  ))}
                  {favorites.length === 0 && (
                    <p className="col-span-3 text-center text-slate-500 py-8 text-sm">No favorites yet</p>
                  )}
                </div>
              )}

              {/* Recent History (past 10 days) */}
              {recentHistory.length > 0 && (
                <div className="mt-5">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Recent Foods (Past 10 Days)
                  </h2>
                  <div className="space-y-1.5">
                    {recentHistory.map((item) => {
                      const daysAgo = Math.round(
                        (Date.now() - new Date(item.lastEaten).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isFav = favorites.some(
                        (f) => f.name.toLowerCase() === item.name.toLowerCase().substring(0, 30)
                          || f.name.toLowerCase() === (item.name.length > 30 ? item.name.substring(0, 27).toLowerCase() + "..." : item.name.toLowerCase())
                      );
                      return (
                        <div
                          key={item.key}
                          className="bg-[var(--card)] rounded-lg px-3 py-2.5 flex items-center gap-2"
                        >
                          {/* Icon */}
                          <span className="text-sm flex-shrink-0">
                            {item.meal_type === "breakfast" ? "🌅" : item.meal_type === "lunch" ? "☀️" : item.meal_type === "dinner" ? "🌙" : item.meal_type === "drink" ? "🥤" : "🍽️"}
                          </span>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {item.calories} cal · P:{item.protein_g}g C:{item.carbs_g}g F:{item.fat_g}g
                              {item.count > 1 && <span className="ml-1 text-sky-400">· {item.count}x</span>}
                              <span className="ml-1">· {daysAgo === 1 ? "yesterday" : `${daysAgo}d ago`}</span>
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Quick re-add */}
                            <button
                              onClick={() => reLogFromHistory(item)}
                              title="Log again today"
                              className="px-2.5 py-1 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-[10px] font-semibold transition-colors"
                            >
                              + Log
                            </button>
                            {/* Save as favorite (only show if not already a fav) */}
                            {!isFav && (
                              <button
                                onClick={() => saveHistoryAsFavorite(item)}
                                title="Save as favorite"
                                className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                </svg>
                              </button>
                            )}
                            {isFav && (
                              <span className="p-1.5 text-amber-400" title="Already a favorite">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* WEIGHT */}
      {activeType === "weight" && (
        <div className="bg-[var(--card)] rounded-xl p-5">
          <h2 className="font-semibold mb-1">Log Weight</h2>
          <p className="text-xs text-slate-400 mb-4">Morning, fasted -- most accurate</p>
          <div className="flex gap-3">
            <input
              type="number"
              step="0.1"
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
              placeholder="e.g. 218.5"
              className="flex-1 bg-slate-700 rounded-xl px-4 py-3 text-lg font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button onClick={saveWeight} className="bg-sky-600 text-white px-6 py-3 rounded-xl font-semibold active:opacity-80">
              Save
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Units: lbs</p>
        </div>
      )}

      {/* WORKOUT */}
      {activeType === "workout" && (
        <div className="bg-[var(--card)] rounded-xl p-5">
          <h2 className="font-semibold mb-3">Log Workout</h2>
          <div className="mb-3">
            <label className="text-xs text-slate-400 mb-1.5 block">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {workoutTypes.map((wt) => (
                <button key={wt.type} onClick={() => setWorkoutType(wt.type)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${workoutType === wt.type ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-300"}`}>
                  {wt.icon} {wt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Duration</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="min" className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Calories</label>
              <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="cal" className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Avg HR</label>
              <input type="number" value={avgHr} onChange={(e) => setAvgHr(e.target.value)} placeholder="bpm" className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1 block">Notes</label>
            <input type="text" value={workoutNotes} onChange={(e) => setWorkoutNotes(e.target.value)} placeholder="How did it feel?" className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
          <button onClick={saveWorkout} disabled={!duration} className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed">
            Save Workout
          </button>
        </div>
      )}

      {/* WATER */}
      {activeType === "water" && (
        <div className="bg-[var(--card)] rounded-xl p-5 text-center">
          <h2 className="font-semibold mb-1">Log Water</h2>
          <p className="text-xs text-slate-400 mb-6">Quick taps to stay hydrated</p>
          <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
            {[8, 12, 16, 24].map((oz) => (
              <button key={oz} onClick={() => addWater(oz)} className="bg-sky-900/40 border border-sky-700/30 text-sky-300 py-4 rounded-xl text-lg font-semibold active:opacity-80 card-press">
                +{oz}oz
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">8oz = 1 glass · 16oz = 1 bottle</p>
        </div>
      )}

      {/* MOBILITY */}
      {activeType === "mobility" && (
        <div className="space-y-3">
          <a href="/mobility" className="block bg-[var(--card)] border border-slate-700 rounded-xl p-5 card-press hover:border-slate-500 transition-colors">
            <div className="flex items-center gap-4">
              <span className="text-3xl">⚡</span>
              <div>
                <p className="font-semibold">Quick Mobility</p>
                <p className="text-sm text-slate-400">5 minutes · 5 exercises</p>
                <p className="text-xs text-slate-500 mt-0.5">Perfect for between meetings</p>
              </div>
              <svg className="w-5 h-5 text-slate-500 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </a>
          <a href="/mobility" className="block bg-[var(--card)] border border-slate-700 rounded-xl p-5 card-press hover:border-slate-500 transition-colors">
            <div className="flex items-center gap-4">
              <span className="text-3xl">🧘</span>
              <div>
                <p className="font-semibold">Full Mobility Routine</p>
                <p className="text-sm text-slate-400">10 minutes · 10 exercises</p>
                <p className="text-xs text-slate-500 mt-0.5">Comprehensive hip, spine, and hamstring work</p>
              </div>
              <svg className="w-5 h-5 text-slate-500 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </a>
        </div>
      )}

      {/* SELFIE */}
      {activeType === "selfie" && (
        <div>
          <div className="text-center py-6">
            <input type="file" accept="image/*" capture="user" ref={selfieInputRef} onChange={handleSelfie} className="hidden" />
            <button
              onClick={() => selfieInputRef.current?.click()}
              disabled={selfieUploading}
              className="w-24 h-24 bg-[var(--card)] border-2 border-dashed border-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-3 active:opacity-80 disabled:opacity-50 hover:border-sky-500 transition-colors"
            >
              {selfieUploading ? (
                <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
              )}
            </button>
            <p className="text-sm text-slate-300">{selfieUploading ? "Uploading..." : "Take a daily progress photo"}</p>
            <p className="text-xs text-slate-500 mt-1">Private -- stored securely, only visible to you</p>
          </div>

          {/* Recent Photos Grid */}
          {recentPhotos.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Recent Photos</h3>
                <Link href="/progress" className="text-xs text-sky-400 hover:text-sky-300">View all &rarr;</Link>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {recentPhotos.map((photo) => (
                  <div key={photo.id} className="aspect-[3/4] rounded-lg overflow-hidden relative">
                    <img src={photo.photo_url} alt={`Progress ${photo.date}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                      <p className="text-[10px] text-white font-medium">
                        {new Date(photo.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      {photo.weight_at_time && (
                        <p className="text-[9px] text-slate-300">{photo.weight_at_time} lbs</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent entries -- only on food tab */}
      {activeType === "food" && recentEntries.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Today&apos;s Food Log
          </h2>
          <div className="space-y-2">
            {recentEntries.map((log) => (
              <div key={log.id} className="bg-[var(--card)] rounded-lg overflow-hidden">
                {editingLogId === log.id ? (
                  /* Inline edit mode */
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-400 mb-2">
                      {log.items && Array.isArray(log.items)
                        ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
                        : log.meal_type}
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block">Cal</label>
                        <input type="number" value={editCalories} onChange={(e) => setEditCalories(e.target.value)} className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Protein</label>
                        <input type="number" value={editProtein} onChange={(e) => setEditProtein(e.target.value)} className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Carbs</label>
                        <input type="number" value={editCarbs} onChange={(e) => setEditCarbs(e.target.value)} className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">Fat</label>
                        <input type="number" value={editFat} onChange={(e) => setEditFat(e.target.value)} className="w-full bg-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEditLog(log.id)} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-semibold">Save</button>
                      <button onClick={() => setEditingLogId(null)} className="bg-slate-700 text-slate-400 px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* Normal display */
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm">
                        {log.meal_type === "breakfast" ? "🌅" : log.meal_type === "lunch" ? "☀️" : log.meal_type === "dinner" ? "🌙" : log.meal_type === "drink" ? "🥤" : "🍽️"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">
                          {log.items && Array.isArray(log.items)
                            ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
                            : log.meal_type}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-semibold">{log.total_calories} cal</span>
                      <button onClick={() => saveAsFavorite(log)} title="Save as favorite" className="p-1 text-slate-500 hover:text-amber-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                        </svg>
                      </button>
                      <button onClick={() => startEditLog(log)} title="Edit" className="p-1 text-slate-500 hover:text-sky-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button onClick={() => deleteFoodLog(log.id)} title="Delete" className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
