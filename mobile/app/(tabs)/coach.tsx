import { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/lib/db";
import { API_BASE } from "@/lib/api";
import { C, base } from "@/lib/theme";
import ScreenHeader from "@/components/ScreenHeader";

interface Msg { role: "user" | "assistant"; content: string }

/** Simple markdown-to-RN renderer */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        if (line.startsWith("### ")) return <Text key={i} style={S.mdH3}>{renderInline(line.slice(4))}</Text>;
        if (line.startsWith("## ")) return <Text key={i} style={S.mdH2}>{renderInline(line.slice(3))}</Text>;
        if (line.startsWith("# ")) return <Text key={i} style={S.mdH1}>{renderInline(line.slice(2))}</Text>;
        if (line.match(/^[-*] /)) return (
          <View key={i} style={S.mdBullet}>
            <Text style={S.mdBulletDot}>•</Text>
            <Text style={S.mdBody}>{renderInline(line.replace(/^[-*] /, ""))}</Text>
          </View>
        );
        if (line.match(/^\d+\. /)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          return (
            <View key={i} style={S.mdBullet}>
              <Text style={S.mdBulletDot}>{num}.</Text>
              <Text style={S.mdBody}>{renderInline(line.replace(/^\d+\. /, ""))}</Text>
            </View>
          );
        }
        if (line.trim() === "") return <View key={i} style={{ height: 6 }} />;
        return <Text key={i} style={S.mdBody}>{renderInline(line)}</Text>;
      })}
    </View>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(<Text key={key++}>{remaining.slice(0, boldMatch.index)}</Text>);
      parts.push(<Text key={key++} style={{ fontWeight: "700", color: C.text }}>{boldMatch[1]}</Text>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }
    const codeMatch = remaining.match(/`(.+?)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) parts.push(<Text key={key++}>{remaining.slice(0, codeMatch.index)}</Text>);
      parts.push(<Text key={key++} style={{ backgroundColor: C.cardAlt, paddingHorizontal: 4, borderRadius: 4, fontSize: 12, color: C.accent }}>{codeMatch[1]}</Text>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }
    parts.push(<Text key={key++}>{remaining}</Text>);
    break;
  }

  return parts.length === 1 ? parts[0] : <Text>{parts}</Text>;
}

const quickPrompts = [
  "Why did I overeat this week?",
  "Suggest a high-protein lunch",
  "Give me a 3-day AMT 885 plan",
  "How should I adjust my calories?",
  "What's the single biggest change I should make?",
];

export default function CoachScreen() {
  const [mode, setMode] = useState<"daily" | "review" | "chat">("daily");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [daily, setDaily] = useState<string | null>(null);
  const [dLoad, setDLoad] = useState(false);
  const [weekly, setWeekly] = useState<string | null>(null);
  const [wLoad, setWLoad] = useState(false);
  const ref = useRef<ScrollView>(null);

  // Load conversation history
  const loadHistory = useCallback(async () => {
    try {
      const { data } = await db.from("coach_messages").select("*").order("created_at", { ascending: true }).limit(50);
      if (data && data.length > 0) {
        setMsgs(data.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })));
      } else {
        setMsgs([{
          role: "assistant",
          content: "Hey Doug! I'm your AI health coach. I know your background -- Forestier's disease, your goal to hit 185 lbs, and your history of losing 35 lbs before.\n\nI can help with:\n- **Meal planning** and calorie guidance\n- **Workout suggestions** for the AMT 885\n- **Mobility routines** safe for your back and hips\n- **Pattern analysis** -- why overeating happens and how to fix it\n\nAsk me anything, or use the Daily Review for today's assessment.",
        }]);
      }
    } catch { /* use default */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const genDaily = async () => {
    setDLoad(true);
    try {
      const r = await fetch(`${API_BASE}/api/coach/daily-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tzOffset: new Date().getTimezoneOffset() }),
      });
      if (r.ok) {
        const d = await r.json();
        setDaily(d.review);
      } else {
        const err = await r.text();
        Alert.alert("Daily Review Error", `Server returned ${r.status}: ${err.slice(0, 200)}`);
      }
    } catch {
      Alert.alert("Network Error", "Could not reach the AI coach. Check your connection.");
    } finally { setDLoad(false); }
  };

  const genWeekly = async () => {
    setWLoad(true);
    try {
      const r = await fetch(`${API_BASE}/api/insights/weekly`, { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        setWeekly(d.summary);
      } else {
        const err = await r.text();
        Alert.alert("Weekly Review Error", `Server returned ${r.status}: ${err.slice(0, 200)}`);
      }
    } catch {
      Alert.alert("Network Error", "Could not reach the AI coach. Check your connection.");
    } finally { setWLoad(false); }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMessage = input.trim();
    const um: Msg = { role: "user", content: userMessage };
    const newMsgs = [...msgs, um];
    setMsgs(newMsgs);
    setInput("");
    setSending(true);
    try {
      await db.from("coach_messages").insert({ role: "user", content: userMessage });
      const r = await fetch(`${API_BASE}/api/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, conversationHistory: newMsgs.slice(-10) }),
      });
      if (r.ok) {
        const d = await r.json();
        setMsgs(p => [...p, { role: "assistant", content: d.response }]);
        await db.from("coach_messages").insert({ role: "assistant", content: d.response });
      } else {
        const err = await r.text();
        setMsgs(p => [...p, { role: "assistant", content: `Sorry, I encountered an error (${r.status}). Please try again.` }]);
        console.warn("Coach API error:", err);
      }
    } catch {
      setMsgs(p => [...p, { role: "assistant", content: "Network error -- couldn't reach the AI coach. Please check your connection." }]);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={S.screen}>
      <ScreenHeader title="AI Coach" subtitle="Your accountability partner" />

      {/* Mode tabs */}
      <View style={S.modeTabs}>
        {(["daily", "review", "chat"] as const).map(m => (
          <Pressable key={m} style={[S.modeTab, mode === m && (m === "daily" ? S.modeTabDaily : m === "review" ? S.modeTabWeekly : S.modeTabChat)]} onPress={() => setMode(m)}>
            <Text style={[S.modeLabel, mode === m && S.modeLabelActive]}>{m === "daily" ? "Daily Review" : m === "review" ? "Weekly" : "Chat"}</Text>
          </Pressable>
        ))}
      </View>

      {/* ===== DAILY REVIEW ===== */}
      {mode === "daily" && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {/* Hero card */}
          <View style={S.dailyHero}>
            <View style={[base.row, { gap: 12, marginBottom: 8 }]}>
              <Text style={{ fontSize: 28 }}>📋</Text>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>Daily Check-In</Text>
                <Text style={{ fontSize: 11, color: "rgba(167,243,208,0.7)" }}>How's today going? Get your daily grade and tomorrow's plan.</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 12 }}>
              Your AI coach reviews everything you've logged today -- food, workouts, water, weight -- then gives you an honest grade.
            </Text>
            <Pressable style={S.dailyBtn} onPress={genDaily} disabled={dLoad}>
              {dLoad ? (
                <View style={[base.row, { gap: 8 }]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={S.dailyBtnText}>Reviewing your day...</Text>
                </View>
              ) : (
                <Text style={S.dailyBtnText}>Generate Daily Review</Text>
              )}
            </Pressable>
          </View>

          {daily && (
            <View style={[base.card, { marginTop: 16 }]}>
              <View style={[base.row, { gap: 8, marginBottom: 8 }]}>
                <Text style={{ fontSize: 16 }}>📋</Text>
                <Text style={[base.h3]}>Today's Review</Text>
              </View>
              <MarkdownText text={daily} />
              <Pressable style={S.refreshBtn} onPress={() => { setDaily(null); genDaily(); }}>
                <Text style={{ color: C.textSec, fontSize: 12 }}>Refresh</Text>
              </Pressable>
            </View>
          )}

          {!daily && !dLoad && (
            <View style={{ marginTop: 16 }}>
              <Text style={[base.label, { marginBottom: 8 }]}>What you'll get</Text>
              {[
                { icon: "📊", title: "Today's Grade", desc: "Honest A-F score based on your logged data" },
                { icon: "🎯", title: "What Went Well", desc: "Celebrate wins, no matter how small" },
                { icon: "⚠️", title: "Watch Out", desc: "Overeating, missed workouts, hydration gaps" },
                { icon: "📅", title: "Tomorrow's Plan", desc: "3 specific, actionable items for tomorrow" },
              ].map(item => (
                <View key={item.title} style={[S.infoCard]}>
                  <Text style={{ fontSize: 16, marginTop: 2 }}>{item.icon}</Text>
                  <View style={base.flex1}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: C.textSec }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ===== WEEKLY REVIEW ===== */}
      {mode === "review" && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          <View style={S.weeklyHero}>
            <View style={[base.row, { gap: 12, marginBottom: 8 }]}>
              <Ionicons name="trending-up" size={28} color="#a78bfa" />
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "white" }}>Portfolio Review</Text>
                <Text style={{ fontSize: 11, color: "rgba(196,181,253,0.7)" }}>Data-driven weekly analysis, not emotional</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: C.textSec, marginBottom: 12 }}>
              Analyzes last 7 days of weight, calories, protein, workouts, and patterns.
            </Text>
            <Pressable style={S.weeklyBtn} onPress={genWeekly} disabled={wLoad}>
              {wLoad ? (
                <View style={[base.row, { gap: 8 }]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={S.dailyBtnText}>Analyzing your week...</Text>
                </View>
              ) : (
                <Text style={S.dailyBtnText}>Generate Weekly Review</Text>
              )}
            </Pressable>
          </View>

          {weekly && (
            <View style={[base.card, { marginTop: 16 }]}>
              <View style={[base.row, { gap: 8, marginBottom: 8 }]}>
                <Text style={{ fontSize: 16 }}>📊</Text>
                <Text style={base.h3}>Your Weekly Report</Text>
              </View>
              <MarkdownText text={weekly} />
            </View>
          )}

          {!weekly && !wLoad && (
            <View style={{ marginTop: 16 }}>
              <Text style={[base.label, { marginBottom: 8 }]}>What the review covers</Text>
              {[
                { icon: "⚖️", title: "Weight Trend", desc: "7-day avg, weekly change rate, projected goal date" },
                { icon: "🔥", title: "Calorie Adherence", desc: "Daily avg vs 1,800 target, overshoot analysis" },
                { icon: "🥩", title: "Protein Check", desc: "Are you hitting 135g? Muscle preservation is critical" },
                { icon: "💪", title: "Workout Consistency", desc: "AMT 885 sessions, mobility completion rate" },
                { icon: "🔍", title: "Pattern Detection", desc: "Overeating triggers, skipped meals, trends" },
                { icon: "🎯", title: "Top Recommendation", desc: "The single highest-leverage change for next week" },
              ].map(item => (
                <View key={item.title} style={S.infoCard}>
                  <Text style={{ fontSize: 16, marginTop: 2 }}>{item.icon}</Text>
                  <View style={base.flex1}>
                    <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{item.title}</Text>
                    <Text style={{ fontSize: 11, color: C.textSec }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ===== CHAT ===== */}
      {mode === "chat" && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={100}>
          <ScrollView ref={ref} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }} onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}>
            {msgs.map((m, i) => (
              <View key={i} style={[{ marginBottom: 10 }, m.role === "user" ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
                <View style={[S.bubble, m.role === "user" ? S.bubbleUser : S.bubbleBot]}>
                  {m.role === "assistant" ? <MarkdownText text={m.content} /> : <Text style={{ color: "white", fontSize: 14, lineHeight: 20 }}>{m.content}</Text>}
                </View>
              </View>
            ))}
            {sending && (
              <View style={{ alignItems: "flex-start", marginBottom: 10 }}>
                <View style={S.bubbleBot}>
                  <View style={[base.row, { gap: 8 }]}>
                    <ActivityIndicator size="small" color={C.accent} />
                    <Text style={{ fontSize: 13, color: C.textSec }}>Thinking...</Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick prompts -- show when few messages */}
          {msgs.length <= 1 && (
            <View style={S.promptsWrap}>
              {quickPrompts.map(p => (
                <Pressable key={p} style={S.promptPill} onPress={() => setInput(p)}>
                  <Text style={{ fontSize: 11, color: C.textSec }}>{p}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={S.chatBar}>
            <TextInput style={S.chatInput} placeholder="Ask your coach anything..." placeholderTextColor={C.textDim} value={input} onChangeText={setInput} onSubmitEditing={send} returnKeyType="send" />
            <Pressable style={[S.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]} onPress={send} disabled={!input.trim() || sending}>
              <Ionicons name="send" size={18} color="white" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  modeTabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: C.card, borderRadius: 12, padding: 4, marginBottom: 16 },
  modeTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeTabDaily: { backgroundColor: C.green },
  modeTabWeekly: { backgroundColor: C.purple },
  modeTabChat: { backgroundColor: C.accent },
  modeLabel: { fontSize: 12, fontWeight: "500", color: C.textDim },
  modeLabelActive: { color: "white" },
  dailyHero: { backgroundColor: "rgba(6,78,59,0.3)", borderWidth: 1, borderColor: "rgba(6,78,59,0.4)", borderRadius: 16, padding: 16 },
  dailyBtn: { backgroundColor: C.green, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  dailyBtnText: { color: "white", fontSize: 14, fontWeight: "600" },
  weeklyHero: { backgroundColor: "rgba(88,28,135,0.3)", borderWidth: 1, borderColor: "rgba(88,28,135,0.4)", borderRadius: 16, padding: 16 },
  weeklyBtn: { backgroundColor: C.purple, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  refreshBtn: { marginTop: 16, backgroundColor: C.cardAlt, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  infoCard: { flexDirection: "row", gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 6 },
  promptsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  promptPill: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10 },
  bubbleUser: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: C.card, borderBottomLeftRadius: 4 },
  chatBar: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chatInput: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: C.text, fontSize: 14 },
  sendBtn: { backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  // Markdown styles
  mdH1: { fontSize: 16, fontWeight: "700", color: C.text, marginTop: 8, marginBottom: 4 },
  mdH2: { fontSize: 14, fontWeight: "700", color: C.text, marginTop: 8, marginBottom: 4 },
  mdH3: { fontSize: 13, fontWeight: "700", color: C.text, marginTop: 6, marginBottom: 2 },
  mdBody: { fontSize: 13, color: C.textSec, lineHeight: 20 },
  mdBullet: { flexDirection: "row", gap: 6, paddingVertical: 1 },
  mdBulletDot: { color: C.textDim, fontSize: 13, width: 14 },
});
