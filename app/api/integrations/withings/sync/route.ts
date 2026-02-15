import { NextResponse } from "next/server";
import { fetchWithingsWeightData } from "@/lib/withings";
import { logSync } from "@/lib/integrations";
import { query } from "@/lib/neon";

export async function POST() {
  try {
    // Sync last 30 days of weight data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const measurements = await fetchWithingsWeightData(startDate, endDate);

    let synced = 0;

    for (const m of measurements) {
      // Upsert: insert if no matching timestamp exists
      const result = await query(
        `INSERT INTO weight_logs (timestamp, weight, body_fat_pct, source)
         VALUES ($1, $2, $3, 'withings')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [m.timestamp, m.weight_lbs, m.body_fat_pct]
      );
      if (result.length > 0) synced++;
    }

    await logSync("withings", "success", synced);

    return NextResponse.json({
      success: true,
      totalMeasurements: measurements.length,
      newRecords: synced,
    });
  } catch (err) {
    console.error("Withings sync error:", err);
    await logSync("withings", "error", 0, String(err));
    return NextResponse.json(
      { error: "Failed to sync Withings data" },
      { status: 500 }
    );
  }
}
