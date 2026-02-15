import { NextRequest, NextResponse } from "next/server";
import { anthropic, HEALTH_SYSTEM_PROMPT } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `${HEALTH_SYSTEM_PROMPT}

You are analyzing a food photo. Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "items": [
    {
      "name": "food item name",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "portion_size": "description like '1 cup' or '6 oz'",
      "portion_notes": "assessment of the portion"
    }
  ],
  "total_calories": number,
  "total_protein_g": number,
  "total_carbs_g": number,
  "total_fat_g": number,
  "portion_assessment": "Overall portion size assessment, e.g. 'This looks like about 1.5 standard servings'",
  "suggestion": "Brief suggestion about portion or nutrition, e.g. 'Consider reducing to 1 serving to stay within your 1800 cal target'"
}

Be accurate but lean toward overestimating portions slightly to help with weight loss goals. Always comment on portion size.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Analyze this food photo. Identify all food items, estimate calories, macros, and assess portion size. Return JSON only.",
            },
          ],
        },
      ],
    });

    // Parse Claude's response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
    }

    // Clean up response -- remove any markdown code fences if present
    let jsonStr = textContent.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysis = JSON.parse(jsonStr);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Food analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze food image" },
      { status: 500 }
    );
  }
}
