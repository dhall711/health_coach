// Web push notification helpers using the Notification API
// These schedule local notifications via setTimeout/setInterval

export interface NotificationPrefs {
  enabled: boolean;
  morningWeight: boolean;      // 7:00 AM
  workoutReminder: boolean;    // 11:00 AM or based on calendar
  eveningReview: boolean;      // 8:00 PM
  waterReminder: boolean;      // Every 2 hours between 9 AM-6 PM
  morningWeightTime: string;   // "07:00"
  workoutReminderTime: string; // "11:00"
  eveningReviewTime: string;   // "20:00"
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  morningWeight: true,
  workoutReminder: true,
  eveningReview: true,
  waterReminder: false,
  morningWeightTime: "07:00",
  workoutReminderTime: "11:00",
  eveningReviewTime: "20:00",
};

const STORAGE_KEY = "notification_prefs";

export function getNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_PREFS;
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function canNotify(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return Notification.permission === "granted";
}

export function sendNotification(title: string, body: string, tag?: string): void {
  if (!canNotify()) return;

  new Notification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: tag || undefined,
    silent: false,
  });
}

// Schedule a notification for a specific time today (or tomorrow if time has passed)
function msUntilTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  if (target.getTime() <= now.getTime()) {
    // Time already passed today, schedule for tomorrow
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

const activeTimers: ReturnType<typeof setTimeout>[] = [];

export function clearAllScheduledNotifications(): void {
  activeTimers.forEach(t => clearTimeout(t));
  activeTimers.length = 0;
}

export function scheduleAllNotifications(): void {
  clearAllScheduledNotifications();

  const prefs = getNotificationPrefs();
  if (!prefs.enabled || !canNotify()) return;

  if (prefs.morningWeight) {
    const ms = msUntilTime(prefs.morningWeightTime);
    activeTimers.push(setTimeout(() => {
      sendNotification(
        "⚖️ Morning Weigh-in",
        "Step on the scale before breakfast for the most accurate reading.",
        "morning-weight"
      );
    }, ms));
  }

  if (prefs.workoutReminder) {
    const ms = msUntilTime(prefs.workoutReminderTime);
    activeTimers.push(setTimeout(() => {
      sendNotification(
        "🏃 Workout Time",
        "You have a window for your AMT 885 session. Even 20 minutes counts!",
        "workout-reminder"
      );
    }, ms));
  }

  if (prefs.eveningReview) {
    const ms = msUntilTime(prefs.eveningReviewTime);
    activeTimers.push(setTimeout(() => {
      sendNotification(
        "📊 Evening Review",
        "Let's review your day and plan for tomorrow. Open Health Coach Doug.",
        "evening-review"
      );
    }, ms));
  }

  if (prefs.waterReminder) {
    // Every 2 hours between 9 AM and 6 PM
    const now = new Date();
    for (let hour = 9; hour <= 18; hour += 2) {
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
      const ms = target.getTime() - now.getTime();
      if (ms > 0) {
        activeTimers.push(setTimeout(() => {
          sendNotification(
            "💧 Hydration Check",
            "Have you had water recently? Stay on track with your 64oz goal.",
            "water-reminder"
          );
        }, ms));
      }
    }
  }
}
