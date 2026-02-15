"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { FoodFavorite, FoodLog, FoodAnalysisResult, MealType } from "@/lib/types";

type TabMode = "camera" | "voice" | "favorites" | "log";

export default function FoodPage() {
  const [activeTab, setActiveTab] = useState<TabMode>("log");
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [todayLogs, setTodayLogs] = useState<FoodLog[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResult | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("lunch");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse URL params for initial mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    if (mode === "voice" || mode === "favorites" || mode === "camera") {
      setActiveTab(mode);
    }
  }, []);

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];

    const [{ data: favs }, { data: logs }] = await Promise.all([
      supabase.from("food_favorites").select("*").order("sort_order"),
      supabase
        .from("food_logs")
        .select("*")
        .gte("timestamp", `${today}T00:00:00`)
        .lte("timestamp", `${today}T23:59:59`)
        .order("timestamp", { ascending: false }),
    ]);

    if (favs) setFavorites(favs as FoodFavorite[]);
    if (logs) setTodayLogs(logs as FoodLog[]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Camera / Photo Analysis ---
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setActiveTab("camera");

    try {
      // Convert to base64
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
          const result = await res.json();
          setAnalysisResult(result);
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

  // --- Voice Input ---
  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser. Try Chrome or Safari.");
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
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
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
        const result = await res.json();
        setAnalysisResult(result);
      } else {
        alert("Failed to analyze. Please try again.");
      }
    } catch {
      alert("Error analyzing food description.");
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Save food log ---
  const saveFoodLog = async (inputMethod: "camera" | "voice" | "favorite" | "manual") => {
    if (!analysisResult) return;

    const { error } = await supabase.from("food_logs").insert({
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
      loadData();
    }
  };

  // --- Quick log favorite ---
  const logFavorite = async (fav: FoodFavorite) => {
    const { error } = await supabase.from("food_logs").insert({
      meal_type: fav.meal_type,
      items: [
        {
          name: fav.name,
          calories: fav.default_calories,
          protein_g: fav.default_protein_g,
          carbs_g: fav.default_carbs_g,
          fat_g: fav.default_fat_g,
          portion_size: "1 serving",
          portion_notes: "Quick-logged favorite",
        },
      ],
      total_calories: fav.default_calories,
      protein_g: fav.default_protein_g,
      carbs_g: fav.default_carbs_g,
      fat_g: fav.default_fat_g,
      input_method: "favorite",
      confirmed: true,
    });

    if (!error) {
      loadData();
    }
  };

  const todayCalories = todayLogs.reduce((sum, l) => sum + (l.total_calories || 0), 0);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 safe-top page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Food Tracker</h1>
          <p className="text-xs text-slate-400">
            {todayCalories} of 1,800 cal today
          </p>
        </div>
        <a href="/" className="text-slate-400 text-sm">← Home</a>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1 mb-4">
        {(["camera", "voice", "favorites", "log"] as TabMode[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab
                ? "bg-[var(--accent)] text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab === "camera" && "📸 Photo"}
            {tab === "voice" && "🎤 Voice"}
            {tab === "favorites" && "⭐ Quick"}
            {tab === "log" && "📋 Log"}
          </button>
        ))}
      </div>

      {/* Analysis Result (shown above all tabs when present) */}
      {analysisResult && (
        <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-xl p-4 mb-4">
          <h3 className="font-semibold mb-2 text-emerald-300">AI Analysis</h3>

          {analysisResult.items.map((item, i) => (
            <div key={i} className="flex justify-between py-1 border-b border-slate-700 last:border-0">
              <span className="text-sm">{item.name}</span>
              <span className="text-sm font-semibold">{item.calories} cal</span>
            </div>
          ))}

          <div className="mt-3 pt-2 border-t border-emerald-700/40">
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{analysisResult.total_calories} cal</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              P: {analysisResult.total_protein_g}g · C: {analysisResult.total_carbs_g}g · F: {analysisResult.total_fat_g}g
            </p>
          </div>

          {analysisResult.portion_assessment && (
            <p className="text-xs text-amber-300 mt-2">
              📏 {analysisResult.portion_assessment}
            </p>
          )}
          {analysisResult.suggestion && (
            <p className="text-xs text-sky-300 mt-1">
              💡 {analysisResult.suggestion}
            </p>
          )}

          {/* Meal type selector */}
          <div className="flex gap-2 mt-3">
            {(["breakfast", "lunch", "dinner", "snack", "drink"] as MealType[]).map((mt) => (
              <button
                key={mt}
                onClick={() => setSelectedMealType(mt)}
                className={`text-xs px-2 py-1 rounded-full ${
                  selectedMealType === mt
                    ? "bg-[var(--accent)] text-white"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {mt}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => saveFoodLog(activeTab === "voice" ? "voice" : "camera")}
              className="flex-1 bg-[var(--success)] text-white py-2 rounded-lg text-sm font-semibold active:opacity-80"
            >
              ✅ Confirm & Save
            </button>
            <button
              onClick={() => setAnalysisResult(null)}
              className="bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm active:opacity-80"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Camera Tab */}
      {activeTab === "camera" && !analysisResult && (
        <div className="text-center py-8">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />
          {analyzing ? (
            <div>
              <div className="text-5xl mb-4 animate-pulse">🔍</div>
              <p className="text-slate-300">Analyzing your food...</p>
              <p className="text-xs text-slate-400 mt-1">Claude is estimating calories and portions</p>
            </div>
          ) : (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 bg-[var(--accent)] rounded-full flex items-center justify-center mx-auto mb-4 active:opacity-80 text-5xl"
              >
                📸
              </button>
              <p className="text-sm text-slate-300">Tap to take a photo of your meal</p>
              <p className="text-xs text-slate-400 mt-1">
                AI will analyze portions, calories, and macros
              </p>
            </>
          )}
        </div>
      )}

      {/* Voice Tab */}
      {activeTab === "voice" && !analysisResult && (
        <div className="text-center py-8">
          {analyzing ? (
            <div>
              <div className="text-5xl mb-4 animate-pulse">🔍</div>
              <p className="text-slate-300">Analyzing your food description...</p>
            </div>
          ) : (
            <>
              <button
                onClick={startListening}
                className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl ${
                  isListening
                    ? "bg-red-600 animate-pulse"
                    : "bg-[var(--card)] border-2 border-slate-600"
                }`}
              >
                🎤
              </button>
              <p className="text-sm text-slate-300">
                {isListening
                  ? "Listening... speak now"
                  : "Tap to describe what you ate"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Example: &quot;Turkey sandwich and a handful of chips&quot;
              </p>

              {/* Text input fallback */}
              <div className="mt-6 px-4">
                <input
                  type="text"
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  placeholder="Or type what you ate..."
                  className="w-full bg-[var(--card)] border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
                />
                {voiceText && (
                  <button
                    onClick={analyzeVoiceText}
                    className="mt-3 w-full bg-[var(--accent)] text-white py-3 rounded-xl font-semibold active:opacity-80"
                  >
                    Analyze &quot;{voiceText}&quot;
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <div>
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((fav) => (
              <button
                key={fav.id}
                onClick={() => logFavorite(fav)}
                className="bg-[var(--card)] border border-slate-700 rounded-xl p-4 text-left card-press hover:border-[var(--accent)]/50"
              >
                <span className="text-2xl">{fav.icon}</span>
                <p className="text-sm font-medium mt-1">{fav.name}</p>
                <p className="text-xs text-slate-400">{fav.default_calories} cal</p>
              </button>
            ))}
          </div>
          {favorites.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">
              No favorites yet. They&apos;ll appear once the database is seeded.
            </p>
          )}
        </div>
      )}

      {/* Today's Food Log */}
      {activeTab === "log" && (
        <div>
          {todayLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🍽️</p>
              <p className="text-slate-400">No food logged yet today</p>
              <p className="text-xs text-slate-500 mt-1">Use Photo, Voice, or Quick Log to start</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[var(--card)] rounded-xl px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {log.meal_type === "breakfast" ? "🌅" :
                         log.meal_type === "lunch" ? "☀️" :
                         log.meal_type === "dinner" ? "🌙" :
                         log.meal_type === "drink" ? "🥤" : "🍽️"}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {log.items && Array.isArray(log.items)
                            ? (log.items as Array<{ name: string }>).map((i) => i.name).join(", ")
                            : log.meal_type}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                          {" · "}
                          {log.input_method === "camera" && "📸"}
                          {log.input_method === "voice" && "🎤"}
                          {log.input_method === "favorite" && "⭐"}
                          {log.input_method === "manual" && "✏️"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{log.total_calories} cal</p>
                      <p className="text-xs text-slate-400">
                        P:{log.protein_g}g C:{log.carbs_g}g F:{log.fat_g}g
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Daily total */}
              <div className="bg-[var(--card)] border border-slate-600 rounded-xl px-4 py-3 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Today&apos;s Total</span>
                  <span>{todayCalories} cal</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
