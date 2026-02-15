import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient } from "@/lib/google";
import { logSync } from "@/lib/integrations";

export async function GET(req: NextRequest) {
  try {
    const calendar = await getCalendarClient();

    // Get date range from query params, default to today
    const dateParam = req.nextUrl.searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch events for the day
    const eventsRes = await calendar.events.list({
      calendarId: "primary",
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const events = (eventsRes.data.items || []).map((event) => ({
      id: event.id,
      summary: event.summary || "(No title)",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      allDay: !!event.start?.date,
      status: event.status,
    }));

    // Find free slots (30+ minute gaps between 6am and 9pm)
    const workdayStart = new Date(dayStart);
    workdayStart.setHours(6, 0, 0, 0);
    const workdayEnd = new Date(dayStart);
    workdayEnd.setHours(21, 0, 0, 0);

    const busySlots = events
      .filter((e) => !e.allDay && e.start && e.end)
      .map((e) => ({
        start: new Date(e.start!).getTime(),
        end: new Date(e.end!).getTime(),
      }))
      .sort((a, b) => a.start - b.start);

    const freeSlots: { start: string; end: string; durationMin: number }[] = [];
    let cursor = workdayStart.getTime();

    for (const busy of busySlots) {
      if (busy.start > cursor) {
        const gapMin = (busy.start - cursor) / 60000;
        if (gapMin >= 30) {
          freeSlots.push({
            start: new Date(cursor).toISOString(),
            end: new Date(busy.start).toISOString(),
            durationMin: Math.round(gapMin),
          });
        }
      }
      cursor = Math.max(cursor, busy.end);
    }

    // After last event to end of workday
    if (cursor < workdayEnd.getTime()) {
      const gapMin = (workdayEnd.getTime() - cursor) / 60000;
      if (gapMin >= 30) {
        freeSlots.push({
          start: new Date(cursor).toISOString(),
          end: workdayEnd.toISOString(),
          durationMin: Math.round(gapMin),
        });
      }
    }

    await logSync("google_calendar", "success", events.length);

    return NextResponse.json({
      date: targetDate.toISOString().split("T")[0],
      events,
      freeSlots,
      suggestedWorkoutSlot: freeSlots.find((s) => s.durationMin >= 45) || freeSlots[0] || null,
    });
  } catch (err) {
    console.error("Google sync error:", err);
    await logSync("google_calendar", "error", 0, String(err));
    return NextResponse.json(
      { error: "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
