"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history
  const loadHistory = useCallback(async () => {
    const { data } = await supabase
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
      // Welcome message
      setMessages([
        {
          role: "assistant",
          content:
            "Hey! I'm your AI health coach. I know your background — the Forestier's disease, your goal to get from ~220 to 185, and that you've done this before (35 lbs from 2017-2020). 💪\n\nI can help with:\n- **Meal planning** and calorie guidance\n- **Workout suggestions** for the AMT 885\n- **Mobility routines** safe for your back and hips\n- **Weekly plans** and schedule optimization\n\nWhat would you like to work on?",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    try {
      // Save user message
      await supabase.from("coach_messages").insert({
        role: "user",
        content: userMessage,
      });

      // Get AI response
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: newMessages.slice(-10), // Last 10 messages for context
        }),
      });

      if (res.ok) {
        const { response } = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);

        // Save assistant message
        await supabase.from("coach_messages").insert({
          role: "assistant",
          content: response,
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I had trouble responding. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please check your network and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "Suggest a workout for today",
    "What should I eat for lunch?",
    "Give me a weekly meal plan",
    "How many calories should I eat today?",
  ];

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen safe-top">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        <div>
          <h1 className="text-xl font-bold">AI Coach</h1>
          <p className="text-xs text-slate-400">Personalized health guidance</p>
        </div>
        <a href="/" className="text-slate-400 text-sm">← Home</a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white rounded-br-md"
                  : "bg-[var(--card)] text-slate-200 rounded-bl-md"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--card)] rounded-2xl px-4 py-3 rounded-bl-md">
              <p className="text-sm text-slate-400 animate-pulse">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts (only show when no conversation yet) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setInput(prompt);
              }}
              className="bg-[var(--card)] border border-slate-600 rounded-full px-3 py-1.5 text-xs text-slate-300 hover:border-[var(--accent)]/50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-24 pt-2 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask your coach anything..."
            className="flex-1 bg-[var(--card)] border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-[var(--accent)] text-white px-4 py-3 rounded-xl font-semibold disabled:opacity-50 active:opacity-80"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
