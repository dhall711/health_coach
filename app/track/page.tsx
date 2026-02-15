"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/db";
import type { FoodFavorite, FoodLog, FoodAnalysisResult, MealType, WorkoutType } from "@/lib/types";

type TrackType = "food" | "weight" | "workout" | "water" | "mobility" | "selfie";

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
    const today = new Date().toISOString().split("T")[0];

    const [{ data: favs }, { data: logs }] = await Promise.all([
      db.from("food_favorites").select("*").order("sort_order"),
      db
        .from("food_logs")
        .select("*")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`)
        .order("timestamp", { ascending: false }),
    ]);

    if (favs) setFavorites(favs as FoodFavorite[]);
    if (logs) setRecentEntries(logs as FoodLog[]);
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

  // --- Log selfie ---
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const handleSelfie = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For now, store a placeholder. Full implementation requires Supabase Storage.
    const { error } = await db.from("progress_photos").insert({
      photo_url: "pending_upload",
      notes: "Daily progress selfie",
    });
    if (!error) showSuccess("Selfie logged!");
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
      <div className="mb-4">
        <h1 className="text-xl font-bold text-white">Track</h1>
        <p className="text-xs text-slate-400">
          Log anything in under 5 seconds
          {todayCalories > 0 && ` · ${todayCalories} cal today`}
        </p>
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
        <div className="text-center py-6">
          <input type="file" accept="image/*" capture="user" ref={selfieInputRef} onChange={handleSelfie} className="hidden" />
          <button onClick={() => selfieInputRef.current?.click()} className="w-24 h-24 bg-[var(--card)] border-2 border-dashed border-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-3 active:opacity-80">
            <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </button>
          <p className="text-sm text-slate-300">Take a daily progress selfie</p>
          <p className="text-xs text-slate-500 mt-1">Private -- stored securely, only visible to you</p>
        </div>
      )}

      {/* Recent entries */}
      {recentEntries.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Today&apos;s Food Log
          </h2>
          <div className="space-y-2">
            {recentEntries.slice(0, 5).map((log) => (
              <div key={log.id} className="bg-[var(--card)] rounded-lg px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {log.meal_type === "breakfast" ? "🌅" : log.meal_type === "lunch" ? "☀️" : log.meal_type === "dinner" ? "🌙" : log.meal_type === "drink" ? "🥤" : "🍽️"}
                  </span>
                  <div>
                    <p className="text-xs font-medium">
                      {log.items && Array.isArray(log.items)
                        ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
                        : log.meal_type}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold">{log.total_calories} cal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
