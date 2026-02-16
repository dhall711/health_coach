"use client";

import { useEffect } from "react";
import { getNotificationPrefs, scheduleAllNotifications, canNotify } from "@/lib/notifications";

export default function NotificationScheduler() {
  useEffect(() => {
    const prefs = getNotificationPrefs();
    if (prefs.enabled && canNotify()) {
      scheduleAllNotifications();
    }
  }, []);

  return null;
}
