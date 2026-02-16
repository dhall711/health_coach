import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Vibration, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/lib/db";
import { getToday } from "@/lib/dates";
import { C, base } from "@/lib/theme";
import { QUICK_ROUTINE, FULL_ROUTINE } from "@/lib/mobilityRoutines";
import type { MobilityRoutineDefinition, Exercise } from "@/lib/mobilityRoutines";

export default function MobilityScreen() {
  const router = useRouter();
  const [selectedRoutine, setSelectedRoutine] = useState<MobilityRoutineDefinition | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [routineDone, setRoutineDone] = useState(false);
  const [painLevel, setPainLevel] = useState(3);
  const [notes, setNotes] = useState("");
  const [todayDone, setTodayDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkToday = useCallback(async () => {
    const today = getToday();
    const { data } = await db.from("mobility_logs").select("id").eq("date", today).limit(1);
    setTodayDone(!!(data && data.length > 0));
  }, []);

  useEffect(() => { checkToday(); }, [checkToday]);

  // Timer
  useEffect(() => {
    if (running && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && running) {
      setRunning(false);
      if (Platform.OS !== "web") Vibration.vibrate(500);
      if (selectedRoutine && currentIdx < selectedRoutine.exercises.length - 1) {
        const ex = selectedRoutine.exercises[currentIdx];
        setCompleted(prev => [...prev, ex.id]);
        const nextIdx = currentIdx + 1;
        setCurrentIdx(nextIdx);
        setTimeLeft(selectedRoutine.exercises[nextIdx].duration_seconds);
      } else if (selectedRoutine) {
        const ex = selectedRoutine.exercises[currentIdx];
        setCompleted(prev => [...prev, ex.id]);
        setRoutineDone(true);
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, timeLeft, currentIdx, selectedRoutine]);

  const startRoutine = (routine: MobilityRoutineDefinition) => {
    setSelectedRoutine(routine);
    setCurrentIdx(0);
    setCompleted([]);
    setRoutineDone(false);
    setTimeLeft(routine.exercises[0].duration_seconds);
    setRunning(false);
  };

  const skipExercise = () => {
    if (!selectedRoutine) return;
    setRunning(false);
    const ex = selectedRoutine.exercises[currentIdx];
    setCompleted(prev => [...prev, ex.id]);
    if (currentIdx < selectedRoutine.exercises.length - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      setTimeLeft(selectedRoutine.exercises[nextIdx].duration_seconds);
    } else {
      setRoutineDone(true);
    }
  };

  const saveRoutine = async () => {
    if (!selectedRoutine) return;
    const { error } = await db.from("mobility_logs").insert({
      routine_type: selectedRoutine.id,
      exercises_completed: completed,
      flexibility_notes: notes || null,
      pain_level: painLevel,
    });
    if (!error) {
      setSelectedRoutine(null);
      setRoutineDone(false);
      checkToday();
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const curEx: Exercise | null = selectedRoutine && !routineDone ? selectedRoutine.exercises[currentIdx] : null;
  const progress = selectedRoutine ? ((currentIdx + (running ? (1 - timeLeft / (curEx?.duration_seconds || 1)) : 0)) / selectedRoutine.exercises.length) * 100 : 0;

  return (
    <SafeAreaView style={S.screen}>
      {/* Header */}
      <View style={[base.row, { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 12 }]}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={18} color={C.textSec} />
        </Pressable>
        <View style={base.flex1}>
          <Text style={base.h1}>Mobility</Text>
          <Text style={base.caption}>Gentle exercises for flexibility · Safe for DISH/OA</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Today status */}
        {todayDone && !selectedRoutine && (
          <View style={S.doneBanner}>
            <Text style={{ fontSize: 13, color: "#6ee7b7" }}>✅ Mobility routine completed today! Great job.</Text>
          </View>
        )}

        {/* Routine Selection */}
        {!selectedRoutine && (
          <View style={{ gap: 10 }}>
            <Pressable style={S.routineCard} onPress={() => startRoutine(QUICK_ROUTINE)}>
              <Text style={{ fontSize: 28 }}>⚡</Text>
              <View style={base.flex1}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>Quick Mobility</Text>
                <Text style={{ fontSize: 12, color: C.textSec }}>5 minutes · {QUICK_ROUTINE.exercises.length} exercises</Text>
                <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Perfect for between meetings</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textDim} />
            </Pressable>

            <Pressable style={S.routineCard} onPress={() => startRoutine(FULL_ROUTINE)}>
              <Text style={{ fontSize: 28 }}>🧘</Text>
              <View style={base.flex1}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.text }}>Full Mobility Routine</Text>
                <Text style={{ fontSize: 12, color: C.textSec }}>10 minutes · {FULL_ROUTINE.exercises.length} exercises</Text>
                <Text style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Comprehensive hip, spine, and hamstring work</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textDim} />
            </Pressable>

            {/* Exercise list preview */}
            <View style={{ marginTop: 16 }}>
              <Text style={[base.label, { marginBottom: 8 }]}>All Exercises</Text>
              {FULL_ROUTINE.exercises.map((ex, i) => (
                <View key={ex.id} style={S.exercisePreview}>
                  <View style={S.exerciseNum}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: C.accent }}>{i + 1}</Text>
                  </View>
                  <View style={base.flex1}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{ex.name}</Text>
                    <Text style={{ fontSize: 11, color: C.textDim }}>{ex.description} · {ex.duration_seconds}s</Text>
                  </View>
                  {ex.caution && <Ionicons name="alert-circle-outline" size={14} color="#fbbf24" />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Active Routine */}
        {curEx && !routineDone && (
          <View>
            {/* Progress dots */}
            <View style={[base.row, { gap: 3, marginBottom: 16 }]}>
              {selectedRoutine!.exercises.map((_, i) => (
                <View
                  key={i}
                  style={[S.progressDot, {
                    backgroundColor: i < currentIdx ? C.emerald : i === currentIdx ? C.accent : "rgba(100,116,139,0.3)",
                  }]}
                />
              ))}
            </View>

            {/* Exercise Card */}
            <View style={S.activeCard}>
              <Text style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>
                Exercise {currentIdx + 1} of {selectedRoutine!.exercises.length}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "700", color: C.text, marginBottom: 6 }}>{curEx.name}</Text>
              <Text style={{ fontSize: 13, color: C.textSec, lineHeight: 20, marginBottom: 20 }}>{curEx.description}</Text>

              {/* Timer */}
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <Text style={S.timer}>{fmt(timeLeft)}</Text>
                <View style={[S.timerTrack, { marginTop: 8 }]}>
                  <View style={[S.timerFill, {
                    width: `${curEx.duration_seconds > 0 ? ((curEx.duration_seconds - timeLeft) / curEx.duration_seconds) * 100 : 0}%`,
                  }]} />
                </View>
              </View>

              {/* Controls */}
              <View style={[base.row, { gap: 10 }]}>
                <Pressable
                  style={[S.controlBtn, { flex: 2, backgroundColor: running ? "#d97706" : C.accent }]}
                  onPress={() => setRunning(!running)}
                >
                  <Ionicons name={running ? "pause" : "play"} size={18} color="white" />
                  <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>{running ? "Pause" : "Start"}</Text>
                </Pressable>
                <Pressable style={[S.controlBtn, { flex: 1, backgroundColor: C.cardAlt }]} onPress={skipExercise}>
                  <Text style={{ color: C.textSec, fontSize: 14, fontWeight: "600" }}>Skip →</Text>
                </Pressable>
              </View>
            </View>

            {/* Instructions */}
            <View style={S.instructionCard}>
              <Text style={[base.label, { marginBottom: 8 }]}>Instructions</Text>
              {curEx.instructions.map((step, i) => (
                <View key={i} style={[base.row, { gap: 8, marginBottom: 6 }]}>
                  <View style={S.stepNum}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: C.accent }}>{i + 1}</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: C.textSec, flex: 1, lineHeight: 19 }}>{step}</Text>
                </View>
              ))}
              {curEx.caution && (
                <View style={[base.row, { gap: 6, marginTop: 8, backgroundColor: "rgba(251,191,36,0.1)", borderRadius: 8, padding: 8 }]}>
                  <Ionicons name="alert-circle" size={14} color="#fbbf24" />
                  <Text style={{ fontSize: 12, color: "#fbbf24", flex: 1 }}>{curEx.caution}</Text>
                </View>
              )}
            </View>

            {/* Cancel */}
            <Pressable
              style={{ alignItems: "center", paddingVertical: 12 }}
              onPress={() => { setRunning(false); setSelectedRoutine(null); }}
            >
              <Text style={{ fontSize: 13, color: C.textDim }}>Cancel routine</Text>
            </Pressable>
          </View>
        )}

        {/* Routine Complete */}
        {routineDone && (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 56, marginBottom: 12 }}>🎉</Text>
            <Text style={{ fontSize: 20, fontWeight: "700", color: C.text, marginBottom: 4 }}>Routine Complete!</Text>
            <Text style={{ fontSize: 13, color: C.textSec, marginBottom: 24 }}>
              You finished {completed.length} exercises. Great work on your flexibility!
            </Text>

            {/* Pain Level */}
            <View style={[base.card, { width: "100%", marginBottom: 12 }]}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 10 }}>How was your pain level?</Text>
              <View style={[base.row, { gap: 6 }]}>
                {[1, 2, 3, 4, 5].map(lvl => (
                  <Pressable
                    key={lvl}
                    style={[S.painBtn, painLevel === lvl && S.painBtnActive]}
                    onPress={() => setPainLevel(lvl)}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: painLevel === lvl ? "white" : C.textSec }}>{lvl}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[base.caption, { marginTop: 6 }]}>1 = no pain · 5 = significant pain</Text>
            </View>

            {/* Notes */}
            <View style={[base.card, { width: "100%", marginBottom: 16 }]}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: C.text, marginBottom: 8 }}>Flexibility notes (optional)</Text>
              <TextInput
                style={S.noteInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="e.g. 'Reached further today' or 'Hip felt tight'"
                placeholderTextColor={C.textDim}
              />
            </View>

            <Pressable style={S.saveBtn} onPress={saveRoutine}>
              <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>✅ Save & Complete</Text>
            </Pressable>
            <Pressable
              style={{ paddingVertical: 12 }}
              onPress={() => { setSelectedRoutine(null); setRoutineDone(false); }}
            >
              <Text style={{ fontSize: 13, color: C.textDim }}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  doneBanner: { backgroundColor: "rgba(6,78,59,0.3)", borderWidth: 1, borderColor: "rgba(6,78,59,0.4)", borderRadius: 12, padding: 14, marginBottom: 16 },
  routineCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 },
  exercisePreview: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.borderLight },
  exerciseNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(14,165,233,0.1)", alignItems: "center", justifyContent: "center" },
  progressDot: { flex: 1, height: 4, borderRadius: 2 },
  activeCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12 },
  timer: { fontSize: 56, fontWeight: "800", color: C.accent, fontVariant: ["tabular-nums"] },
  timerTrack: { width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(100,116,139,0.2)" },
  timerFill: { height: 4, borderRadius: 2, backgroundColor: C.accent },
  controlBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  instructionCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(14,165,233,0.1)", alignItems: "center", justifyContent: "center" },
  painBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: C.cardAlt, alignItems: "center" },
  painBtnActive: { backgroundColor: C.accent },
  noteInput: { backgroundColor: C.cardAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 13 },
  saveBtn: { width: "100%", backgroundColor: C.emerald, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
});
