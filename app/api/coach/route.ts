import { NextRequest, NextResponse } from "next/server";
import { anthropic, HEALTH_SYSTEM_PROMPT } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    // Build messages array from history
    const messages = [
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: HEALTH_SYSTEM_PROMPT,
      messages,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "No response" }, { status: 500 });
    }

    return NextResponse.json({ response: textContent.text });
  } catch (error) {
    console.error("Coach error:", error);
    return NextResponse.json({ error: "Failed to get coach response" }, { status: 500 });
  }
}
