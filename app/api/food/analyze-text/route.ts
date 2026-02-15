import { NextRequest, NextResponse } from "next/server";
import { anthropic, HEALTH_SYSTEM_PROMPT } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `${HEALTH_SYSTEM_PROMPT}

You are analyzing a text description of food someone ate. Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "items": [
    {
      "name": "food item name",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "portion_size": "estimated portion like '1 cup' or '6 oz'",
      "portion_notes": "assumption about portion based on description"
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "portion_assessment": "Overall assessment of the described meal",
  "suggestion": "Brief nutrition or portion suggestion"
}

When portion sizes are ambiguous, assume average restaurant portions (which tend to be large). Be honest about calorie estimates.`,
      messages: [
        {
          role: "user",
          content: `I ate: ${text}. Please analyze the nutrition content. Return JSON only.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
    }

    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysis = JSON.parse(jsonStr);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Text food analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze food description" },
      { status: 500 }
    );
  }
}
