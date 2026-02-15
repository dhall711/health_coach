import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, date, photo_url, weight_at_time, notes, created_at
      FROM progress_photos
      ORDER BY date DESC
      LIMIT 100
    `;
    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error("GET /api/photos error:", err);
    return NextResponse.json({ error: "Failed to load photos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType, notes } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }

    const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

    // Get the latest weight to associate with this photo
    const weightRows = await sql`
      SELECT weight FROM weight_logs ORDER BY timestamp DESC LIMIT 1
    `;
    const weightAtTime = weightRows.length > 0 ? weightRows[0].weight : null;

    const result = await sql`
      INSERT INTO progress_photos (photo_url, weight_at_time, notes)
      VALUES (${dataUrl}, ${weightAtTime}, ${notes || "Daily progress photo"})
      RETURNING id, date, weight_at_time, notes, created_at
    `;

    return NextResponse.json(result[0]);
  } catch (err: unknown) {
    console.error("POST /api/photos error:", err);
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await sql`DELETE FROM progress_photos WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/photos error:", err);
    return NextResponse.json({ error: "Failed to delete photo" }, { status: 500 });
  }
}
