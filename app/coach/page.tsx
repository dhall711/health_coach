"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { db } from "@/lib/db";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function CoachPage() {
  const [mode, setMode] = useState<"review" | "chat">("review");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history
  const loadHistory = useCallback(async () => {
    const { data } = await db
      .from("coach_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    if (data && data.length > 0) {
      setMessages(
        data.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "Hey! I'm your AI health coach. I know your full background -- Forestier's disease, your goal to hit 185 lbs, and that you've crushed this before (35 lbs from 2017-2020).\n\nI can help with:\n- **Weekly Reviews** -- portfolio-style analysis of your progress\n- **Meal planning** and calorie guidance\n- **Workout suggestions** for the AMT 885\n- **Mobility routines** safe for your back and hips\n- **Pattern analysis** -- why you overeat and how to fix it\n\nTry the Weekly Review tab, or ask me anything here.",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (mode === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, mode]);

  // --- Weekly Review ---
  const generateWeeklyReview = async () => {
    setReviewLoading(true);
    try {
      const res = await fetch("/api/coach/weekly-review", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setWeeklyReview(data.review);
      } else {
        setWeeklyReview("Unable to generate review. Make sure you have at least a few days of data logged.");
      }
    } catch {
      setWeeklyReview("Connection error. Please try again.");
    } finally {
      setReviewLoading(false);
    }
  };

  // --- Chat ---
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    try {
      await db.from("coach_messages").insert({ role: "user", content: userMessage });

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: newMessages.slice(-10),
        }),
      });

      if (res.ok) {
        const { response } = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
        await db.from("coach_messages").insert({ role: "assistant", content: response });
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I had trouble responding. Please try again." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Check your network and try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "Why did I overeat this week?",
    "What's the single biggest change I should make?",
    "Suggest a high-protein lunch",
    "How should I adjust my calories?",
    "Am I losing muscle or fat?",
    "Give me a 3-day AMT 885 plan",
  ];

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen safe-top">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-white">AI Coach</h1>
            <p className="text-xs text-slate-400">Your accountability partner</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1">
          <button
            onClick={() => setMode("review")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === "review" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Weekly Review
          </button>
          <button
            onClick={() => setMode("chat")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === "chat" ? "bg-sky-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Chat
          </button>
        </div>
      </div>

      {/* WEEKLY REVIEW MODE */}
      {mode === "review" && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-700/30 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <div>
                <h2 className="font-semibold text-white">Portfolio Review</h2>
                <p className="text-xs text-purple-300/70">Like a weekly check-in -- data-driven, not emotional</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Your AI coach analyzes last week&apos;s weight, calories, protein, workouts, and patterns -- then delivers the single highest-leverage adjustment.
            </p>
            <button
              onClick={generateWeeklyReview}
              disabled={reviewLoading}
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {reviewLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing your week...
                </>
              ) : (
                "Generate Weekly Review"
              )}
            </button>
          </div>

          {/* Review Result */}
          {weeklyReview && (
            <div className="bg-[var(--card)] rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📊</span>
                <h3 className="font-semibold text-sm">Your Weekly Report</h3>
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {weeklyReview}
              </div>
            </div>
          )}

          {/* What the review covers */}
          {!weeklyReview && !reviewLoading && (
            <div className="space-y-3">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">What the review covers</h3>
              {[
                { icon: "⚖️", title: "Weight Trend", desc: "7-day avg, weekly change rate, projected goal date" },
                { icon: "🔥", title: "Calorie Adherence", desc: "Daily avg vs 1,800 target, overshoot analysis" },
                { icon: "🥩", title: "Protein Check", desc: "Are you hitting 135g? Muscle preservation is critical at 55" },
                { icon: "💪", title: "Workout Consistency", desc: "AMT 885 sessions, mobility completion rate" },
                { icon: "🔍", title: "Pattern Detection", desc: "Overeating triggers, skipped meals, day-of-week trends" },
                { icon: "🎯", title: "Top Recommendation", desc: "The single highest-leverage change for next week" },
              ].map((item) => (
                <div key={item.title} className="bg-[var(--card)] rounded-xl p-3 flex items-start gap-3">
                  <span className="text-lg mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CHAT MODE */}
      {mode === "chat" && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-sky-600 text-white rounded-br-md"
                    : "bg-[var(--card)] text-slate-200 rounded-bl-md"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[var(--card)] rounded-2xl px-4 py-3 rounded-bl-md">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400">Thinking...</p>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="bg-[var(--card)] border border-slate-700 rounded-full px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-24 pt-2 border-t border-slate-700/50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask your coach anything..."
                className="flex-1 bg-[var(--card)] border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-sky-600 text-white px-4 py-3 rounded-xl font-semibold disabled:opacity-40 active:opacity-80"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
