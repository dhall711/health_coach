import { NextRequest, NextResponse } from "next/server";
import { query as dbQuery } from "@/lib/neon";

/**
 * Import TrendWeight CSV export data.
 *
 * TrendWeight exports CSV with columns like:
 *   Date, Weight, TrendWeight, BodyFat (optional), BMI (optional)
 *
 * We handle the common column name variants.
 */
export async function POST(req: NextRequest) {
  try {
    const { csvData } = await req.json();

    if (!csvData || typeof csvData !== "string") {
      return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });
    }

    // Parse CSV
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV appears empty or has no data rows" },
        { status: 400 }
      );
    }

    // Parse header to find column indices
    const header = lines[0]
      .split(",")
      .map((h) => h.trim().toLowerCase().replace(/"/g, ""));

    const dateIdx = header.findIndex(
      (h) => h === "date" || h === "datetime" || h === "timestamp"
    );
    const weightIdx = header.findIndex(
      (h) =>
        h === "weight" ||
        h === "scaleweight" ||
        h === "scale weight" ||
        h === "scale_weight"
    );
    const trendIdx = header.findIndex(
      (h) =>
        h === "trendweight" ||
        h === "trend" ||
        h === "trend_weight" ||
        h === "trend weight"
    );
    const bodyFatIdx = header.findIndex(
      (h) =>
        h === "bodyfat" ||
        h === "body_fat" ||
        h === "bodyfat%" ||
        h === "body fat" ||
        h === "fat%"
    );

    if (dateIdx === -1) {
      return NextResponse.json(
        {
          error:
            "Could not find a 'Date' column in the CSV header. Found columns: " +
            header.join(", "),
        },
        { status: 400 }
      );
    }

    if (weightIdx === -1 && trendIdx === -1) {
      return NextResponse.json(
        {
          error:
            "Could not find a 'Weight' or 'TrendWeight' column. Found columns: " +
            header.join(", "),
        },
        { status: 400 }
      );
    }

    // Parse data rows
    const records: {
      timestamp: string;
      weight: number;
      body_fat_pct: number | null;
      source: string;
    }[] = [];

    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));

      const dateStr = cols[dateIdx];
      if (!dateStr) {
        skipped++;
        continue;
      }

      let parsedDate: Date;
      try {
        parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) {
          const parts = dateStr.split("/");
          if (parts.length === 3) {
            parsedDate = new Date(
              `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}T08:00:00`
            );
          } else {
            skipped++;
            continue;
          }
        }
      } catch {
        skipped++;
        continue;
      }

      const weightStr =
        weightIdx !== -1
          ? cols[weightIdx]
          : trendIdx !== -1
            ? cols[trendIdx]
            : null;
      if (!weightStr) {
        skipped++;
        continue;
      }

      const weight = parseFloat(weightStr);
      if (isNaN(weight) || weight <= 0 || weight > 500) {
        skipped++;
        continue;
      }

      let bodyFat: number | null = null;
      if (bodyFatIdx !== -1 && cols[bodyFatIdx]) {
        const bf = parseFloat(cols[bodyFatIdx]);
        if (!isNaN(bf) && bf > 0 && bf < 100) {
          bodyFat = bf;
        }
      }

      records.push({
        timestamp: parsedDate.toISOString(),
        weight,
        body_fat_pct: bodyFat,
        source: "trendweight",
      });
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: `No valid records found. ${skipped} rows were skipped.` },
        { status: 400 }
      );
    }

    // Insert in batches using raw SQL
    const batchSize = 200;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        // Build a multi-row INSERT
        const params: unknown[] = [];
        const valueSets: string[] = [];
        for (const r of batch) {
          const offset = params.length;
          params.push(r.timestamp, r.weight, r.body_fat_pct, r.source);
          valueSets.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
          );
        }

        await dbQuery(
          `INSERT INTO weight_logs (timestamp, weight, body_fat_pct, source)
           VALUES ${valueSets.join(", ")}
           ON CONFLICT DO NOTHING`,
          params
        );
        inserted += batch.length;
      } catch (err) {
        console.error("Batch insert error:", err);
        errors += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      imported: inserted,
      skipped,
      errors,
      dateRange: {
        earliest: records[0]?.timestamp?.split("T")[0],
        latest: records[records.length - 1]?.timestamp?.split("T")[0],
      },
    });
  } catch (error) {
    console.error("TrendWeight import error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const safeMessage = message.includes("DATABASE_URL")
      ? "Database not configured"
      : "Failed to import data";
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
