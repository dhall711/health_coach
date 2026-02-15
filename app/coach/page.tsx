"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/db";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Simple markdown-to-JSX renderer
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-sm font-bold mt-3 mb-1">{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-base font-bold mt-3 mb-1">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-lg font-bold mt-3 mb-1">{renderInline(line.slice(2))}</h1>);
    }
    // Bullet points
    else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-slate-500 flex-shrink-0">&#x2022;</span>
          <span>{renderInline(line.replace(/^[-*] /, ""))}</span>
        </div>
      );
    }
    // Numbered lists
    else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="text-slate-500 flex-shrink-0 min-w-[1.2em] text-right">{num}.</span>
          <span>{renderInline(line.replace(/^\d+\. /, ""))}</span>
        </div>
      );
    }
    // Empty lines
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    }
    // Regular paragraphs
    else {
      elements.push(<p key={i} className="py-0.5">{renderInline(line)}</p>);
    }
  }

  return <div className="text-sm text-slate-300 leading-relaxed">{elements}</div>;
}

// Render inline markdown (bold, italic, code)
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++} className="font-semibold text-white">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/`(.+?)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, codeMatch.index)}</span>);
      }
      parts.push(<code key={key++} className="bg-slate-700 px-1.5 py-0.5 rounded text-xs text-sky-300">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // No more patterns
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export default function CoachPage() {
  const [mode, setMode] = useState<"daily" | "review" | "chat">("daily");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [dailyReview, setDailyReview] = useState<string | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Read tab from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "daily") setMode("daily");
    else if (tab === "review") setMode("review");
    else if (tab === "chat") setMode("chat");
  }, []);

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
            "Hey Doug! I'm your AI health coach. I know your background -- Forestier's disease, your goal to hit 185 lbs, and your history of losing 35 lbs before.\n\nI can help with:\n- **Meal planning** and calorie guidance\n- **Workout suggestions** for the AMT 885\n- **Mobility routines** safe for your back and hips\n- **Pattern analysis** -- why overeating happens and how to fix it\n\nAsk me anything, or use the Daily Review for today's assessment.",
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

  // --- Daily Review ---
  const generateDailyReview = async () => {
    setDailyLoading(true);
    try {
      const res = await fetch("/api/coach/daily-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tzOffset: new Date().getTimezoneOffset() }),
      });
      if (res.ok) {
        const data = await res.json();
        setDailyReview(data.review);
      } else {
        setDailyReview("Unable to generate daily review. Log some data first to get a personalized assessment.");
      }
    } catch {
      setDailyReview("Connection error. Please try again.");
    } finally {
      setDailyLoading(false);
    }
  };

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
    "Give me a 3-day AMT 885 plan",
  ];

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen safe-top">
      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 bg-[var(--card)] rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">AI Coach</h1>
              <p className="text-xs text-slate-400">Your accountability partner</p>
            </div>
          </div>
        </div>

        {/* Mode Toggle -- 3 tabs */}
        <div className="flex gap-1 bg-[var(--card)] rounded-xl p-1">
          <button
            onClick={() => setMode("daily")}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              mode === "daily" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Daily Review
          </button>
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

      {/* DAILY REVIEW MODE */}
      {mode === "daily" && (
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          <div className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 border border-emerald-700/30 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">📋</span>
              <div>
                <h2 className="font-semibold text-white">Daily Check-In</h2>
                <p className="text-xs text-emerald-300/70">How&apos;s today going? Get your daily grade and tomorrow&apos;s plan.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Your AI coach reviews everything you&apos;ve logged today -- food, workouts, water, weight -- then gives you an honest grade, highlights wins, flags concerns, and plans tomorrow.
            </p>
            <button
              onClick={generateDailyReview}
              disabled={dailyLoading}
              className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {dailyLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reviewing your day...
                </>
              ) : (
                "Generate Daily Review"
              )}
            </button>
          </div>

          {dailyReview && (
            <div className="bg-[var(--card)] rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📋</span>
                <h3 className="font-semibold text-sm">Today&apos;s Review</h3>
              </div>
              <MarkdownContent text={dailyReview} />
            </div>
          )}

          {!dailyReview && !dailyLoading && (
            <div className="space-y-3">
              <h3 className="text-xs text-slate-400 uppercase tracking-wider font-semibold">What you&apos;ll get</h3>
              {[
                { icon: "📊", title: "Today's Grade", desc: "Honest A-F score based on your logged data" },
                { icon: "🎯", title: "What Went Well", desc: "Celebrate wins, no matter how small" },
                { icon: "⚠️", title: "Watch Out", desc: "Overeating, missed workouts, hydration gaps" },
                { icon: "📅", title: "Tomorrow's Plan", desc: "3 specific, actionable items for tomorrow" },
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
                <p className="text-xs text-purple-300/70">Data-driven weekly analysis, not emotional</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Analyzes last 7 days of weight, calories, protein, workouts, and patterns -- then delivers the single highest-leverage adjustment.
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

          {weeklyReview && (
            <div className="bg-[var(--card)] rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📊</span>
                <h3 className="font-semibold text-sm">Your Weekly Report</h3>
              </div>
              <MarkdownContent text={weeklyReview} />
            </div>
          )}

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
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-sky-600 text-white rounded-br-md"
                    : "bg-[var(--card)] text-slate-200 rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <MarkdownContent text={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
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
