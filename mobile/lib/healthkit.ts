// Apple HealthKit integration using @kingstinct/react-native-healthkit v13+
// Uses react-native-nitro-modules under the hood for native performance.
// Only works on iOS native — gracefully returns empty/null on web & Android.
//
// DEDUPLICATION: Since Withings syncs to Apple Health, and both connect to this
// app, we apply source-priority dedup to avoid double-counting:
//   Weight:   Withings is authoritative → skip Apple Health if Withings exists
//   Workouts: HealthKit UUID used as external_id → DB unique index prevents dupes
//   Steps:    Only from Apple Health → upsert on date (no dupe concern)

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db } from "./db";

export interface HealthKitWorkout {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number; // minutes
  calories: number;
  heartRate: number | null;
  type: string;
  distance: number | null;
}

export interface HealthKitDaySummary {
  steps: number;
  activeCalories: number;
  weight: number | null;
  restingHeartRate: number | null;
  workouts: HealthKitWorkout[];
}

const HK_CONNECTED_KEY = "healthkit_connected";
const HK_LAST_SYNC_KEY = "healthkit_last_sync";

let hkModule: any = null;
let hkReady = false;

function getHK() {
  if (Platform.OS !== "ios") return null;
  if (hkModule) return hkModule;
  try {
    hkModule = require("@kingstinct/react-native-healthkit");
    return hkModule;
  } catch (e) {
    console.warn("HealthKit module not available:", e);
    return null;
  }
}

export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  const HK = getHK();
  if (!HK) return false;
  try {
    return HK.isHealthDataAvailable();
  } catch {
    return false;
  }
}

export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  const HK = getHK();
  if (!HK) return false;

  try {
    const available = HK.isHealthDataAvailable();
    if (!available) return false;

    await HK.requestAuthorization({
      toRead: [
        "HKQuantityTypeIdentifierStepCount",
        "HKQuantityTypeIdentifierActiveEnergyBurned",
        "HKQuantityTypeIdentifierBodyMass",
        "HKQuantityTypeIdentifierHeartRate",
        "HKQuantityTypeIdentifierRestingHeartRate",
        "HKWorkoutTypeIdentifier",
        "HKCategoryTypeIdentifierSleepAnalysis",
      ],
      toShare: [
        "HKWorkoutTypeIdentifier",
        "HKQuantityTypeIdentifierActiveEnergyBurned",
      ],
    });

    hkReady = true;
    await AsyncStorage.setItem(HK_CONNECTED_KEY, "true");
    return true;
  } catch (error) {
    console.warn("HealthKit init error:", error);
    return false;
  }
}

export async function disconnectHealthKit(): Promise<void> {
  hkReady = false;
  await AsyncStorage.removeItem(HK_CONNECTED_KEY);
  await AsyncStorage.removeItem(HK_LAST_SYNC_KEY);
}

export async function isHealthKitConnected(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  const val = await AsyncStorage.getItem(HK_CONNECTED_KEY);
  return val === "true";
}

export async function getLastSyncTime(): Promise<string | null> {
  return AsyncStorage.getItem(HK_LAST_SYNC_KEY);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getTodaySteps(): Promise<number> {
  if (!hkReady || Platform.OS !== "ios") return 0;
  const HK = getHK();
  if (!HK) return 0;

  try {
    const now = new Date();
    const start = startOfToday();

    const result = await HK.queryStatisticsForQuantity(
      "HKQuantityTypeIdentifierStepCount",
      ["cumulativeSum"],
      { from: start, to: now }
    );
    return Math.round(result?.sumQuantity?.quantity ?? 0);
  } catch (e) {
    console.warn("HealthKit steps error:", e);
    return 0;
  }
}

export async function getTodayActiveCalories(): Promise<number> {
  if (!hkReady || Platform.OS !== "ios") return 0;
  const HK = getHK();
  if (!HK) return 0;

  try {
    const now = new Date();
    const start = startOfToday();

    const result = await HK.queryStatisticsForQuantity(
      "HKQuantityTypeIdentifierActiveEnergyBurned",
      ["cumulativeSum"],
      { from: start, to: now }
    );
    return Math.round(result?.sumQuantity?.quantity ?? 0);
  } catch (e) {
    console.warn("HealthKit active cal error:", e);
    return 0;
  }
}

export async function getLatestWeight(): Promise<number | null> {
  if (!hkReady || Platform.OS !== "ios") return null;
  const HK = getHK();
  if (!HK) return null;

  try {
    const result = await HK.getMostRecentQuantitySample(
      "HKQuantityTypeIdentifierBodyMass"
    );
    if (result?.quantity) {
      // HealthKit stores BodyMass in kg — convert to lbs
      return Math.round(result.quantity * 2.20462 * 10) / 10;
    }
    return null;
  } catch (e) {
    console.warn("HealthKit weight error:", e);
    return null;
  }
}

export async function getRestingHeartRate(): Promise<number | null> {
  if (!hkReady || Platform.OS !== "ios") return null;
  const HK = getHK();
  if (!HK) return null;

  try {
    const result = await HK.getMostRecentQuantitySample(
      "HKQuantityTypeIdentifierRestingHeartRate"
    );
    return result?.quantity ? Math.round(result.quantity) : null;
  } catch (e) {
    console.warn("HealthKit RHR error:", e);
    return null;
  }
}

export async function getTodayWorkouts(): Promise<HealthKitWorkout[]> {
  if (!hkReady || Platform.OS !== "ios") return [];
  const HK = getHK();
  if (!HK) return [];

  try {
    const now = new Date();
    const start = startOfToday();

    const result = await HK.queryWorkoutSamples({
      limit: 0,
      filter: {
        date: {
          startDate: start,
          endDate: now,
        },
      },
    });

    const workouts = Array.isArray(result) ? result : [];
    return workouts.map((w: any) => ({
      uuid: w.uuid || w.id || "",
      startDate: w.startDate?.toISOString?.() || String(w.startDate),
      endDate: w.endDate?.toISOString?.() || String(w.endDate),
      duration: Math.round((w.duration || 0) / 60),
      calories: Math.round(w.totalEnergyBurned?.quantity ?? 0),
      heartRate: null,
      type: w.workoutActivityType || "other",
      distance: w.totalDistance?.quantity
        ? Math.round(w.totalDistance.quantity * 100) / 100
        : null,
    }));
  } catch (e) {
    console.warn("HealthKit workouts error:", e);
    return [];
  }
}

export async function getTodaySummary(): Promise<HealthKitDaySummary> {
  const [steps, activeCalories, weight, restingHeartRate, workouts] =
    await Promise.all([
      getTodaySteps(),
      getTodayActiveCalories(),
      getLatestWeight(),
      getRestingHeartRate(),
      getTodayWorkouts(),
    ]);

  return { steps, activeCalories, weight, restingHeartRate, workouts };
}

// ---------------------------------------------------------------------------
// DEDUP HELPERS
// ---------------------------------------------------------------------------

/**
 * Check if a weight entry from a higher-priority source already exists
 * within ±30 minutes of the given timestamp.
 *
 * Source priority for weight: withings (10) > apple_health (20) > manual (30)
 * If Withings already logged 215.4 at 7:02am, we skip the Apple Health
 * reading of 215.4 at 7:02am that came from the same scale via sync.
 */
async function weightAlreadyExists(
  weightLbs: number,
  timestamp: Date
): Promise<boolean> {
  const windowMs = 30 * 60 * 1000; // 30 minutes
  const start = new Date(timestamp.getTime() - windowMs).toISOString();
  const end = new Date(timestamp.getTime() + windowMs).toISOString();

  const { data } = await db
    .from("weight_logs")
    .select("id,weight,source")
    .gte("timestamp", start)
    .lte("timestamp", end);

  if (!data || data.length === 0) return false;

  // Check if any entry is close enough in value (within 0.5 lbs)
  // from a higher-priority source (withings or manual)
  return data.some((entry: any) => {
    const diff = Math.abs(entry.weight - weightLbs);
    const isHigherPriority =
      entry.source === "withings" || entry.source === "manual";
    return diff < 0.5 && isHigherPriority;
  });
}

/**
 * Check if a workout with the same external_id or similar timing already exists.
 */
async function workoutAlreadyExists(
  externalId: string,
  startTimestamp: string,
  durationMin: number
): Promise<boolean> {
  // First: exact match on external_id (same HealthKit UUID synced before)
  if (externalId) {
    const { data: exact } = await db
      .from("workouts")
      .select("id")
      .eq("external_id", externalId);
    if (exact && exact.length > 0) return true;
  }

  // Second: fuzzy match — same time window (±15 min) and similar duration (±5 min)
  const windowMs = 15 * 60 * 1000;
  const ts = new Date(startTimestamp);
  const start = new Date(ts.getTime() - windowMs).toISOString();
  const end = new Date(ts.getTime() + windowMs).toISOString();

  const { data: fuzzy } = await db
    .from("workouts")
    .select("id,duration_min")
    .gte("timestamp", start)
    .lte("timestamp", end);

  if (!fuzzy || fuzzy.length === 0) return false;

  return fuzzy.some(
    (w: any) => Math.abs(w.duration_min - durationMin) <= 5
  );
}

// ---------------------------------------------------------------------------
// SYNC (with dedup)
// ---------------------------------------------------------------------------

/**
 * Sync HealthKit data to the backend, skipping duplicates.
 *
 * Dedup rules:
 *   Weight:   Skip if Withings/manual entry exists within ±30min with similar value
 *   Workouts: Skip if external_id already stored OR if fuzzy time+duration match
 *   Steps:    Upsert by date — always takes the latest reading (no dupe issue)
 */
export async function syncHealthKitData(): Promise<{
  synced: string[];
  skipped: string[];
  errors: string[];
}> {
  const synced: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  try {
    // ---- Weight ----
    const weight = await getLatestWeight();
    if (weight) {
      const now = new Date();
      const isDupe = await weightAlreadyExists(weight, now);
      if (isDupe) {
        skipped.push(`weight: ${weight} lbs (already from Withings/manual)`);
      } else {
        const { error } = await db.from("weight_logs").insert({
          weight,
          source: "apple_health",
        });
        if (!error) synced.push(`weight: ${weight} lbs`);
        else errors.push(`weight: ${error.message}`);
      }
    }

    // ---- Workouts ----
    const workouts = await getTodayWorkouts();
    for (const workout of workouts) {
      const isDupe = await workoutAlreadyExists(
        workout.uuid,
        workout.startDate,
        workout.duration
      );
      if (isDupe) {
        skipped.push(`workout: ${workout.type} (duplicate)`);
        continue;
      }

      const { error } = await db.from("workouts").insert({
        type: "other",
        duration_min: workout.duration,
        calories_burned: workout.calories,
        avg_hr: workout.heartRate,
        distance: workout.distance,
        source: "apple_health",
        external_id: workout.uuid || null,
        notes: `HealthKit: ${workout.type}`,
      });
      if (!error) synced.push(`workout: ${workout.type}`);
      else errors.push(`workout: ${error.message}`);
    }

    // ---- Steps & Active Calories ----
    // These only come from Apple Health (no Withings overlap), so upsert by date
    const steps = await getTodaySteps();
    const activeCal = await getTodayActiveCalories();
    const rhr = await getRestingHeartRate();

    if (steps > 0 || activeCal > 0) {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await db.from("daily_summaries").upsert(
        {
          date: today,
          steps,
          active_calories: activeCal,
          resting_hr: rhr,
          source: "apple_health",
        },
        { onConflict: "date" }
      );
      if (!error) synced.push(`steps: ${steps}, active cal: ${activeCal}`);
      else errors.push(`daily_summaries: ${error.message}`);
    }

    await AsyncStorage.setItem(HK_LAST_SYNC_KEY, new Date().toISOString());
  } catch (e) {
    errors.push(`sync error: ${(e as Error).message}`);
  }

  return { synced, skipped, errors };
}

// Re-init HealthKit from saved state (for app restart)
export async function restoreHealthKitConnection(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  const wasConnected = await AsyncStorage.getItem(HK_CONNECTED_KEY);
  if (wasConnected !== "true") return false;
  return initHealthKit();
}
