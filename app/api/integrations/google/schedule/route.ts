import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient } from "@/lib/google";

export async function POST(req: NextRequest) {
  try {
    const { startTime, endTime, title, description } = await req.json();

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: "startTime and endTime are required" },
        { status: 400 }
      );
    }

    const calendar = await getCalendarClient();

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title || "Workout - AMT 885",
        description: description || "Health Coach scheduled workout session",
        start: { dateTime: startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        visibility: "private",
        colorId: "2", // Sage green
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 15 }],
        },
      },
    });

    return NextResponse.json({
      success: true,
      eventId: event.data.id,
      htmlLink: event.data.htmlLink,
    });
  } catch (err) {
    console.error("Google schedule error:", err);
    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
