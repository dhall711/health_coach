import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/neon";
import { logSync } from "@/lib/integrations";

/**
 * Webhook endpoint for the "Health Auto Export" iOS app.
 * Receives JSON payloads of Apple Health data and upserts into daily_summaries.
 *
 * Expected payload format from Health Auto Export (REST API automation):
 * {
 *   "data": {
 *     "metrics": [
 *       { "name": "step_count", "data": [{ "date": "2026-02-14", "qty": 8523 }] },
 *       { "name": "active_energy", "data": [{ "date": "2026-02-14", "qty": 342.5 }] },
 *       { "name": "resting_heart_rate", "data": [{ "date": "2026-02-14", "qty": 62 }] },
 *       { "name": "sleep_analysis", "data": [{ "date": "2026-02-14", "qty": 7.2 }] }
 *     ]
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  // Validate bearer token
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.APPLE_HEALTH_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();

    // Health Auto Export sends data in various formats; normalize
    const metrics = body?.data?.metrics || body?.metrics || [];

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { error: "No metrics found in payload" },
        { status: 400 }
      );
    }

    // Group data by date
    const dateMap = new Map<string, {
      steps?: number;
      active_calories?: number;
      resting_hr?: number;
      sleep_hours?: number;
    }>();

    for (const metric of metrics) {
      const name = (metric.name || "").toLowerCase();
      const dataPoints = metric.data || metric.dataPoints || [];

      for (const dp of dataPoints) {
        const date = dp.date?.split("T")[0] || dp.date;
        if (!date) continue;

        const existing = dateMap.get(date) || {};
        const qty = Number(dp.qty ?? dp.value ?? 0);

        if (name.includes("step")) existing.steps = Math.round(qty);
        else if (name.includes("active_energy") || name.includes("activeenergy")) existing.active_calories = Math.round(qty);
        else if (name.includes("resting_heart") || name.includes("restingheart")) existing.resting_hr = Math.round(qty);
        else if (name.includes("sleep")) existing.sleep_hours = Math.round(qty * 10) / 10;

        dateMap.set(date, existing);
      }
    }

    let synced = 0;

    for (const [date, data] of dateMap.entries()) {
      // Build dynamic SET clause for only the fields we received
      const fields: string[] = [];
      const values: unknown[] = [date];
      let paramIdx = 2;

      if (data.steps !== undefined) {
        fields.push(`steps = $${paramIdx}`);
        values.push(data.steps);
        paramIdx++;
      }
      if (data.active_calories !== undefined) {
        fields.push(`active_calories = $${paramIdx}`);
        values.push(data.active_calories);
        paramIdx++;
      }
      if (data.resting_hr !== undefined) {
        fields.push(`resting_hr = $${paramIdx}`);
        values.push(data.resting_hr);
        paramIdx++;
      }
      if (data.sleep_hours !== undefined) {
        fields.push(`sleep_hours = $${paramIdx}`);
        values.push(data.sleep_hours);
        paramIdx++;
      }

      if (fields.length === 0) continue;

      // Upsert into daily_summaries
      await query(
        `INSERT INTO daily_summaries (date, ${fields.map((f) => f.split(" = ")[0]).join(", ")}, updated_at)
         VALUES ($1, ${values.slice(1).map((_, i) => `$${i + 2}`).join(", ")}, NOW())
         ON CONFLICT (date)
         DO UPDATE SET ${fields.join(", ")}, updated_at = NOW()`,
        values
      );
      synced++;
    }

    await logSync("apple_health", "success", synced);

    return NextResponse.json({
      success: true,
      datesProcessed: synced,
    });
  } catch (err) {
    console.error("Apple Health webhook error:", err);
    await logSync("apple_health", "error", 0, String(err));
    return NextResponse.json(
      { error: "Failed to process health data" },
      { status: 500 }
    );
  }
}
