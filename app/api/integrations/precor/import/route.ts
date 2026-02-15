import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/neon";
import { logSync } from "@/lib/integrations";

/**
 * Import Precor Preva workout data.
 * Accepts either:
 * 1. CSV text (from Preva export)
 * 2. JSON array of workouts
 *
 * Expected CSV columns: Date, Duration (min), Calories, Avg HR, Distance
 * Expected JSON: [{ date, duration_min, calories_burned, avg_hr?, distance? }]
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    let workouts: {
      date: string;
      duration_min: number;
      calories_burned: number;
      avg_hr?: number;
      distance?: number;
    }[] = [];

    if (body.csvData) {
      // Parse CSV
      const lines = body.csvData.split("\n").map((l: string) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        return NextResponse.json({ error: "CSV must have a header row and at least one data row" }, { status: 400 });
      }

      const headers = lines[0].toLowerCase().split(",").map((h: string) => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v: string) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h: string, idx: number) => {
          row[h] = values[idx] || "";
        });

        const date = row["date"] || row["workout date"] || row["timestamp"];
        const duration = parseFloat(row["duration"] || row["duration (min)"] || row["duration_min"] || "0");
        const calories = parseFloat(row["calories"] || row["calories burned"] || row["calories_burned"] || "0");
        const avgHr = parseFloat(row["avg hr"] || row["avg_hr"] || row["heart rate"] || "0");
        const distance = parseFloat(row["distance"] || row["distance (mi)"] || "0");

        if (date && (duration > 0 || calories > 0)) {
          workouts.push({
            date,
            duration_min: Math.round(duration),
            calories_burned: Math.round(calories),
            avg_hr: avgHr > 0 ? Math.round(avgHr) : undefined,
            distance: distance > 0 ? Math.round(distance * 100) / 100 : undefined,
          });
        }
      }
    } else if (body.workouts && Array.isArray(body.workouts)) {
      workouts = body.workouts;
    } else {
      return NextResponse.json(
        { error: "Provide either csvData or workouts array" },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (const w of workouts) {
      try {
        // Parse date and create timestamp
        const timestamp = new Date(w.date).toISOString();

        const result = await query(
          `INSERT INTO workouts (timestamp, type, duration_min, calories_burned, avg_hr, distance, source)
           VALUES ($1, 'amt885', $2, $3, $4, $5, 'precor')
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [timestamp, w.duration_min, w.calories_burned, w.avg_hr ?? null, w.distance ?? null]
        );

        if (result.length > 0) imported++;
        else skipped++;
      } catch {
        skipped++;
      }
    }

    await logSync("precor", "success", imported);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: workouts.length,
    });
  } catch (err) {
    console.error("Precor import error:", err);
    await logSync("precor", "error", 0, String(err));
    return NextResponse.json(
      { error: "Failed to import Precor data" },
      { status: 500 }
    );
  }
}
