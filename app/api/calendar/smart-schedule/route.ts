import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient } from "@/lib/google";

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

interface FreeSlot {
  date: string;
  dayOfWeek: string;
  start: string;
  end: string;
  durationMin: number;
  startTime: string; // "2:00 PM" for display
  endTime: string;
  score: number; // higher is better
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * GET /api/calendar/smart-schedule?days=7
 *
 * Reads the user's Google Calendar for the next N days and returns:
 *   - events per day
 *   - free slots per day (30+ min gaps between 6am-9pm)
 *   - ranked workout slot suggestions (prefers 11am-1pm, after 4pm per user's preference)
 *   - today's detailed schedule
 */
export async function GET(req: NextRequest) {
  try {
    const daysParam = req.nextUrl.searchParams.get("days") || "7";
    const numDays = Math.min(14, Math.max(1, parseInt(daysParam)));

    const calendar = await getCalendarClient();

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + numDays);

    const eventsRes = await calendar.events.list({
      calendarId: "primary",
      timeMin: rangeStart.toISOString(),
      timeMax: rangeEnd.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const rawEvents = eventsRes.data.items || [];

    // Process events by day
    const daySchedules: Record<string, { events: CalendarEvent[]; freeSlots: FreeSlot[] }> = {};

    for (let d = 0; d < numDays; d++) {
      const day = new Date(rangeStart);
      day.setDate(day.getDate() + d);
      const dateStr = day.toISOString().split("T")[0];
      const dayOfWeek = DAY_NAMES[day.getDay()];

      const workdayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 6, 0, 0, 0);
      const workdayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 21, 0, 0, 0);

      // Events for this day
      const dayEvents: CalendarEvent[] = rawEvents
        .filter((evt) => {
          const evtStart = evt.start?.dateTime || evt.start?.date || "";
          return evtStart.startsWith(dateStr);
        })
        .map((evt) => ({
          id: evt.id || "",
          summary: evt.summary || "(No title)",
          start: evt.start?.dateTime || evt.start?.date || "",
          end: evt.end?.dateTime || evt.end?.date || "",
          allDay: !!evt.start?.date,
        }));

      // Find free slots
      const busySlots = dayEvents
        .filter((e) => !e.allDay && e.start && e.end)
        .map((e) => ({
          start: new Date(e.start).getTime(),
          end: new Date(e.end).getTime(),
        }))
        .sort((a, b) => a.start - b.start);

      const freeSlots: FreeSlot[] = [];
      let cursor = workdayStart.getTime();

      for (const busy of busySlots) {
        if (busy.start > cursor) {
          const gapMin = (busy.start - cursor) / 60000;
          if (gapMin >= 30) {
            const slotStart = new Date(cursor);
            const slotEnd = new Date(busy.start);
            freeSlots.push({
              date: dateStr,
              dayOfWeek,
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              durationMin: Math.round(gapMin),
              startTime: slotStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              endTime: slotEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
              score: scoreSlot(slotStart, gapMin),
            });
          }
        }
        cursor = Math.max(cursor, busy.end);
      }

      if (cursor < workdayEnd.getTime()) {
        const gapMin = (workdayEnd.getTime() - cursor) / 60000;
        if (gapMin >= 30) {
          const slotStart = new Date(cursor);
          freeSlots.push({
            date: dateStr,
            dayOfWeek,
            start: slotStart.toISOString(),
            end: workdayEnd.toISOString(),
            durationMin: Math.round(gapMin),
            startTime: slotStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            endTime: workdayEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            score: scoreSlot(slotStart, gapMin),
          });
        }
      }

      freeSlots.sort((a, b) => b.score - a.score);

      daySchedules[dateStr] = { events: dayEvents, freeSlots };
    }

    // Build top suggestions across the week
    const allSlots: FreeSlot[] = [];
    for (const dateStr of Object.keys(daySchedules)) {
      for (const slot of daySchedules[dateStr].freeSlots) {
        if (slot.durationMin >= 40) {
          allSlots.push(slot);
        }
      }
    }
    allSlots.sort((a, b) => b.score - a.score);

    const topSuggestions = allSlots.slice(0, 10);

    return NextResponse.json({
      days: numDays,
      daySchedules,
      topSuggestions,
      connected: true,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("not connected") || errMsg.includes("must be set")) {
      return NextResponse.json({ connected: false, error: "Google Calendar not connected" }, { status: 200 });
    }
    console.error("Smart schedule error:", err);
    return NextResponse.json({ error: "Failed to load calendar" }, { status: 500 });
  }
}

/**
 * Score a slot based on Doug's preferred workout windows:
 *   - 11am-1pm (lunch break): +30
 *   - After 4pm: +20
 *   - Before 9am: +10
 *   - 45+ minutes: +15
 *   - 60+ minutes: +10 bonus
 *   - Weekend bonus: +5
 */
function scoreSlot(slotStart: Date, durationMin: number): number {
  const hour = slotStart.getHours();
  const dayOfWeek = slotStart.getDay();
  let score = 0;

  // Preferred time windows
  if (hour >= 11 && hour < 13) score += 30;
  else if (hour >= 16 && hour < 20) score += 20;
  else if (hour >= 6 && hour < 9) score += 10;
  else score += 5;

  // Duration bonuses
  if (durationMin >= 45) score += 15;
  if (durationMin >= 60) score += 10;

  // Weekend bonus (more flexible)
  if (dayOfWeek === 0 || dayOfWeek === 6) score += 5;

  return score;
}
