import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Dynamically import expo-notifications to avoid crashes on unsupported platforms
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {
  // expo-notifications not available
}

export interface NotificationPrefs {
  enabled: boolean;
  morningWeight: boolean;
  workoutReminder: boolean;
  eveningReview: boolean;
  waterReminder: boolean;
  morningWeightHour: number;
  morningWeightMinute: number;
  workoutReminderHour: number;
  workoutReminderMinute: number;
  eveningReviewHour: number;
  eveningReviewMinute: number;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  morningWeight: true,
  workoutReminder: true,
  eveningReview: true,
  waterReminder: false,
  morningWeightHour: 7,
  morningWeightMinute: 0,
  workoutReminderHour: 11,
  workoutReminderMinute: 0,
  eveningReviewHour: 20,
  eveningReviewMinute: 0,
};

const STORAGE_KEY = "notification_prefs";

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_PREFS;
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications || Platform.OS === "web") return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleAllNotifications(): Promise<void> {
  if (!Notifications) return;

  // Cancel all existing scheduled notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  const prefs = await getNotificationPrefs();
  if (!prefs.enabled) return;

  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (prefs.morningWeight) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚖️ Morning Weigh-in",
        body: "Step on the scale before breakfast for the most accurate reading.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: prefs.morningWeightHour,
        minute: prefs.morningWeightMinute,
      },
    });
  }

  if (prefs.workoutReminder) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏃 Workout Time",
        body: "You have a window for your AMT 885 session. Even 20 minutes counts!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: prefs.workoutReminderHour,
        minute: prefs.workoutReminderMinute,
      },
    });
  }

  if (prefs.eveningReview) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📊 Evening Review",
        body: "Let's review your day and plan for tomorrow.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: prefs.eveningReviewHour,
        minute: prefs.eveningReviewMinute,
      },
    });
  }

  if (prefs.waterReminder) {
    for (let hour = 9; hour <= 18; hour += 2) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 Hydration Check",
          body: "Have you had water recently? Stay on track with your 64oz goal.",
          sound: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
