import { NextResponse } from "next/server";
import { anthropic, HEALTH_SYSTEM_PROMPT } from "@/lib/claude";

export async function POST() {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `${HEALTH_SYSTEM_PROMPT}

You are generating a weekly meal plan. Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "plan": [
    {
      "day": "Monday",
      "breakfast": {
        "id": "b1",
        "name": "meal name",
        "meal_type": "breakfast",
        "calories": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number,
        "ingredients": ["ingredient 1", "ingredient 2"],
        "prep_notes": "preparation instructions",
        "prep_time_min": number
      },
      "lunch": { same structure },
      "dinner": { same structure },
      "snacks": [],
      "total_calories": number,
      "total_protein_g": number
    }
  ]
}

RULES:
- Target ~1,800 cal/day
- Minimum 135g protein/day
- Breakfast is always: coffee (cream, no sugar) + banana + nonfat Greek yogurt + blueberries + Ezekiel cereal (~390 cal, 22g protein)
- 5 days (Mon-Fri)
- Lunches should be 450-550 cal, 35g+ protein, minimal prep
- Dinners should be 500-600 cal, 35g+ protein
- Use Costco-friendly ingredients
- Vary the lunches and dinners across the week`,
      messages: [
        {
          role: "user",
          content: "Generate a fresh weekly meal plan for me. Prioritize high protein, easy prep, and Costco-friendly ingredients.",
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const data = JSON.parse(jsonStr);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Plan generation error:", error);
    return NextResponse.json({ error: "Failed to generate meal plan" }, { status: 500 });
  }
}
