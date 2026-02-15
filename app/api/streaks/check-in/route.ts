import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

function getLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getLocalDayBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * POST /api/streaks/check-in
 *
 * Called when the dashboard loads. Checks whether the user has logged
 * any activity today and updates the streak accordingly.
 *
 * A "check-in" requires at least ONE of:
 *   - Food log entry
 *   - Workout log entry
 *   - Weight log entry
 *   - Mobility log entry
 *   - Water log entry (>= 8oz total)
 *
 * Streak rules:
 *   - last_check_in_date === today  → already checked in, no change
 *   - last_check_in_date === yesterday AND activity today → increment streak
 *   - last_check_in_date is older → reset streak to 1 (if activity today)
 *   - Use streak freeze if missed exactly 1 day and freezes are available
 */
export async function POST() {
  try {
    const now = new Date();
    const today = getLocalDate(now);
    const { start: todayStart, end: todayEnd } = getLocalDayBounds(now);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDate(yesterday);

    // Get or create streak record
    let streakRows = await sql`SELECT * FROM streaks LIMIT 1`;

    if (streakRows.length === 0) {
      await sql`INSERT INTO streaks (current_streak, longest_streak, streak_freezes_remaining) VALUES (0, 0, 1)`;
      streakRows = await sql`SELECT * FROM streaks LIMIT 1`;
    }

    const streak = streakRows[0];

    // Already checked in today -- no update needed
    if (streak.last_check_in_date === today) {
      return NextResponse.json({
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        last_check_in_date: streak.last_check_in_date,
        status: "already_checked_in",
      });
    }

    // Check for today's activity
    const [foodCount, workoutCount, weightCount, mobilityCount, waterLogs] = await Promise.all([
      sql`SELECT COUNT(*) as c FROM food_logs WHERE timestamp >= ${todayStart}::timestamptz AND timestamp <= ${todayEnd}::timestamptz`,
      sql`SELECT COUNT(*) as c FROM workouts WHERE timestamp >= ${todayStart}::timestamptz AND timestamp <= ${todayEnd}::timestamptz`,
      sql`SELECT COUNT(*) as c FROM weight_logs WHERE timestamp >= ${todayStart}::timestamptz AND timestamp <= ${todayEnd}::timestamptz`,
      sql`SELECT COUNT(*) as c FROM mobility_logs WHERE date = ${today}`,
      sql`SELECT COALESCE(SUM(amount_oz), 0) as total FROM water_logs WHERE timestamp >= ${todayStart}::timestamptz AND timestamp <= ${todayEnd}::timestamptz`,
    ]);

    const hasActivity =
      Number(foodCount[0].c) > 0 ||
      Number(workoutCount[0].c) > 0 ||
      Number(weightCount[0].c) > 0 ||
      Number(mobilityCount[0].c) > 0 ||
      Number(waterLogs[0].total) >= 8;

    if (!hasActivity) {
      return NextResponse.json({
        current_streak: streak.current_streak,
        longest_streak: streak.longest_streak,
        last_check_in_date: streak.last_check_in_date,
        status: "no_activity_today",
      });
    }

    // Determine new streak value
    let newStreak: number;
    let freezeUsed = false;

    if (streak.last_check_in_date === yesterdayStr) {
      // Consecutive day -- increment
      newStreak = Number(streak.current_streak) + 1;
    } else if (streak.last_check_in_date) {
      // Missed a day -- check if we can use a freeze
      const lastDate = new Date(streak.last_check_in_date + "T12:00:00");
      const daysMissed = Math.floor((now.getTime() - lastDate.getTime()) / 86400000) - 1;

      if (daysMissed === 1 && Number(streak.streak_freezes_remaining) > 0) {
        // Use a freeze to bridge the gap
        newStreak = Number(streak.current_streak) + 1;
        freezeUsed = true;
      } else {
        // Streak broken -- reset
        newStreak = 1;
      }
    } else {
      // First ever check-in
      newStreak = 1;
    }

    const newLongest = Math.max(Number(streak.longest_streak), newStreak);

    if (freezeUsed) {
      await sql`
        UPDATE streaks SET
          current_streak = ${newStreak},
          longest_streak = ${newLongest},
          last_check_in_date = ${today},
          streak_freezes_remaining = streak_freezes_remaining - 1,
          streak_freezes_used = streak_freezes_used + 1,
          updated_at = NOW()
        WHERE id = ${streak.id}
      `;
    } else {
      await sql`
        UPDATE streaks SET
          current_streak = ${newStreak},
          longest_streak = ${newLongest},
          last_check_in_date = ${today},
          updated_at = NOW()
        WHERE id = ${streak.id}
      `;
    }

    return NextResponse.json({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_check_in_date: today,
      status: freezeUsed ? "freeze_used" : newStreak === 1 && Number(streak.current_streak) > 1 ? "streak_reset" : "streak_updated",
      freeze_used: freezeUsed,
    });
  } catch (err: unknown) {
    console.error("Streak check-in error:", err);
    return NextResponse.json({ error: "Failed to update streak" }, { status: 500 });
  }
}
