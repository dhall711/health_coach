import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/lib/api";
import { C, base } from "@/lib/theme";
import {
  isHealthKitAvailable,
  isHealthKitConnected,
  initHealthKit,
  disconnectHealthKit,
  syncHealthKitData,
  getLastSyncTime,
  getTodaySummary,
} from "@/lib/healthkit";
import {
  type NotificationPrefs,
  DEFAULT_PREFS,
  getNotificationPrefs,
  saveNotificationPrefs,
  requestNotificationPermission,
  scheduleAllNotifications,
  cancelAllNotifications,
} from "@/lib/notifications";

export default function SettingsScreen() {
  const router = useRouter();
  const [startW, setStartW] = useState("220");
  const [goalW, setGoalW] = useState("185");
  const [calTarget, setCalTarget] = useState("1800");
  const [waterGoal, setWaterGoal] = useState("64");

  // HealthKit state
  const [hkAvailable, setHkAvailable] = useState(false);
  const [hkConnected, setHkConnected] = useState(false);
  const [hkSyncing, setHkSyncing] = useState(false);
  const [hkConnecting, setHkConnecting] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [hkPreview, setHkPreview] = useState<{
    steps: number;
    activeCalories: number;
    weight: number | null;
    restingHeartRate: number | null;
    workouts: number;
  } | null>(null);

  // Integration status
  const [withingsConnected, setWithingsConnected] = useState<boolean | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);

  // Notification state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      const s = await AsyncStorage.getItem("startWeight");
      if (s) setStartW(s);
      const g = await AsyncStorage.getItem("goalWeight");
      if (g) setGoalW(g);
      const c = await AsyncStorage.getItem("calTarget");
      if (c) setCalTarget(c);
      const w = await AsyncStorage.getItem("waterGoal");
      if (w) setWaterGoal(w);

      // HealthKit init
      const available = isHealthKitAvailable();
      setHkAvailable(available);
      if (available) {
        const connected = await isHealthKitConnected();
        setHkConnected(connected);
        const ls = await getLastSyncTime();
        setLastSync(ls);
      }

      // Integration statuses
      try {
        const statusRes = await fetch(`${API_BASE}/api/integrations/status`);
        if (statusRes.ok) {
          const statuses = await statusRes.json();
          setWithingsConnected(statuses?.withings?.connected ?? false);
          setGoogleConnected(statuses?.google?.connected ?? false);
        }
      } catch {
        setWithingsConnected(false);
        setGoogleConnected(false);
      }

      // Notification prefs
      const np = await getNotificationPrefs();
      setNotifPrefs(np);
    })();
  }, []);

  const toggleNotifications = async () => {
    if (!notifPrefs.enabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        const np = { ...notifPrefs, enabled: true };
        setNotifPrefs(np);
        await saveNotificationPrefs(np);
        await scheduleAllNotifications();
        Alert.alert("Enabled", "You'll get daily reminders to stay on track.");
      } else {
        Alert.alert("Permission Required", "Please enable notifications in your device settings.");
      }
    } else {
      const np = { ...notifPrefs, enabled: false };
      setNotifPrefs(np);
      await saveNotificationPrefs(np);
      await cancelAllNotifications();
    }
  };

  const updateNotifPref = async (key: keyof NotificationPrefs, value: boolean) => {
    const np = { ...notifPrefs, [key]: value };
    setNotifPrefs(np);
    await saveNotificationPrefs(np);
    if (np.enabled) await scheduleAllNotifications();
  };

  const loadHkPreview = useCallback(async () => {
    if (!hkConnected) return;
    try {
      const summary = await getTodaySummary();
      setHkPreview({
        steps: summary.steps,
        activeCalories: summary.activeCalories,
        weight: summary.weight,
        restingHeartRate: summary.restingHeartRate,
        workouts: summary.workouts.length,
      });
    } catch (e) {
      console.warn("HK preview error:", e);
    }
  }, [hkConnected]);

  useEffect(() => {
    if (hkConnected) loadHkPreview();
  }, [hkConnected, loadHkPreview]);

  const save = async () => {
    await AsyncStorage.setItem("startWeight", startW);
    await AsyncStorage.setItem("goalWeight", goalW);
    await AsyncStorage.setItem("calTarget", calTarget);
    await AsyncStorage.setItem("waterGoal", waterGoal);
    Alert.alert("Saved", "Settings updated successfully");
  };

  const handleConnectHealthKit = async () => {
    setHkConnecting(true);
    try {
      const success = await initHealthKit();
      if (success) {
        setHkConnected(true);
        Alert.alert("Connected", "Apple Health is now connected. Your health data will sync automatically.");
        await loadHkPreview();
      } else {
        Alert.alert(
          "Connection Failed",
          "Could not connect to Apple Health. Make sure you allow access when prompted."
        );
      }
    } catch (e) {
      Alert.alert("Error", `Failed to connect: ${(e as Error).message}`);
    } finally {
      setHkConnecting(false);
    }
  };

  const handleDisconnectHealthKit = () => {
    Alert.alert(
      "Disconnect Apple Health?",
      "This will stop syncing health data. Your existing data will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await disconnectHealthKit();
            setHkConnected(false);
            setHkPreview(null);
            setLastSync(null);
          },
        },
      ]
    );
  };

  const handleSyncNow = async () => {
    setHkSyncing(true);
    try {
      const result = await syncHealthKitData();
      const synced = result.synced.length;
      const skippedCount = result.skipped.length;
      const errors = result.errors.length;
      const ls = await getLastSyncTime();
      setLastSync(ls);
      await loadHkPreview();

      const skippedNote = skippedCount > 0
        ? `\n${skippedCount} item(s) skipped (already from Withings/manual).`
        : "";

      if (errors > 0) {
        Alert.alert(
          "Sync Partial",
          `Synced ${synced} item(s) with ${errors} error(s).${skippedNote}\n\nErrors:\n${result.errors.join("\n")}`
        );
      } else if (synced > 0) {
        Alert.alert(
          "Sync Complete",
          `Successfully synced ${synced} item(s) from Apple Health.${skippedNote}`
        );
      } else if (skippedCount > 0) {
        Alert.alert(
          "Up to Date",
          `All Apple Health data already exists from higher-priority sources (Withings/manual).${skippedNote}`
        );
      } else {
        Alert.alert("Up to Date", "No new data to sync from Apple Health.");
      }
    } catch (e) {
      Alert.alert("Sync Error", (e as Error).message);
    } finally {
      setHkSyncing(false);
    }
  };

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never";
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <SafeAreaView style={S.screen}>
      <View style={S.header}>
        <Pressable onPress={() => router.back()} style={S.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </Pressable>
        <Text style={base.h2}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Weight Goals */}
        <Text style={[base.label, { marginBottom: 8 }]}>Weight Goals</Text>
        <View style={base.card}>
          <View style={S.field}>
            <Text style={base.body}>Starting Weight (lbs)</Text>
            <TextInput style={S.input} keyboardType="decimal-pad" value={startW} onChangeText={setStartW} />
          </View>
          <View style={S.divider} />
          <View style={S.field}>
            <Text style={base.body}>Goal Weight (lbs)</Text>
            <TextInput style={S.input} keyboardType="decimal-pad" value={goalW} onChangeText={setGoalW} />
          </View>
        </View>

        {/* Daily Targets */}
        <Text style={[base.label, { marginBottom: 8 }]}>Daily Targets</Text>
        <View style={base.card}>
          <View style={S.field}>
            <Text style={base.body}>Calorie Target</Text>
            <TextInput style={S.input} keyboardType="number-pad" value={calTarget} onChangeText={setCalTarget} />
          </View>
          <View style={S.divider} />
          <View style={S.field}>
            <Text style={base.body}>Water Goal (oz)</Text>
            <TextInput style={S.input} keyboardType="number-pad" value={waterGoal} onChangeText={setWaterGoal} />
          </View>
        </View>

        {/* Apple Health Integration */}
        <Text style={[base.label, { marginBottom: 8 }]}>Apple Health</Text>
        {Platform.OS === "ios" && hkAvailable ? (
          <View style={base.card}>
            {/* Connection status */}
            <View style={S.field}>
              <View style={[base.row, { gap: 8 }]}>
                <Ionicons name="heart-circle" size={22} color={C.red} />
                <Text style={base.body}>Apple Health</Text>
              </View>
              <View
                style={[
                  S.statusBadge,
                  { backgroundColor: hkConnected ? C.greenBg : C.cardAlt },
                ]}
              >
                <Text
                  style={{
                    color: hkConnected ? C.emerald : C.textDim,
                    fontSize: 11,
                    fontWeight: "500",
                  }}
                >
                  {hkConnected ? "Connected" : "Not Connected"}
                </Text>
              </View>
            </View>

            {/* Data types shared */}
            {hkConnected && (
              <>
                <View style={S.divider} />
                <View style={{ paddingVertical: 8 }}>
                  <Text style={[base.caption, { marginBottom: 8 }]}>
                    Sharing data:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {["Steps", "Active Cal", "Weight", "Heart Rate", "Workouts", "Sleep"].map(
                      (t) => (
                        <View key={t} style={S.dataBadge}>
                          <Ionicons
                            name="checkmark-circle"
                            size={12}
                            color={C.emerald}
                          />
                          <Text style={{ fontSize: 11, color: C.textSec, marginLeft: 4 }}>
                            {t}
                          </Text>
                        </View>
                      )
                    )}
                  </View>
                </View>
              </>
            )}

            {/* Live preview */}
            {hkConnected && hkPreview && (
              <>
                <View style={S.divider} />
                <View style={{ paddingVertical: 8 }}>
                  <Text style={[base.caption, { marginBottom: 8 }]}>
                    Today from Apple Health:
                  </Text>
                  <View style={[base.row, { flexWrap: "wrap", gap: 8 }]}>
                    <View style={S.previewItem}>
                      <Ionicons name="footsteps-outline" size={16} color={C.accent} />
                      <Text style={S.previewValue}>
                        {hkPreview.steps.toLocaleString()}
                      </Text>
                      <Text style={S.previewLabel}>steps</Text>
                    </View>
                    <View style={S.previewItem}>
                      <Ionicons name="flame-outline" size={16} color={C.amber} />
                      <Text style={S.previewValue}>{hkPreview.activeCalories}</Text>
                      <Text style={S.previewLabel}>active cal</Text>
                    </View>
                    {hkPreview.weight && (
                      <View style={S.previewItem}>
                        <Ionicons name="scale-outline" size={16} color={C.blue} />
                        <Text style={S.previewValue}>{hkPreview.weight}</Text>
                        <Text style={S.previewLabel}>lbs</Text>
                      </View>
                    )}
                    {hkPreview.restingHeartRate && (
                      <View style={S.previewItem}>
                        <Ionicons name="heart-outline" size={16} color={C.red} />
                        <Text style={S.previewValue}>
                          {hkPreview.restingHeartRate}
                        </Text>
                        <Text style={S.previewLabel}>bpm</Text>
                      </View>
                    )}
                    <View style={S.previewItem}>
                      <Ionicons name="fitness-outline" size={16} color={C.emerald} />
                      <Text style={S.previewValue}>{hkPreview.workouts}</Text>
                      <Text style={S.previewLabel}>workouts</Text>
                    </View>
                  </View>
                </View>
              </>
            )}

            <View style={S.divider} />

            {/* Last sync */}
            {hkConnected && (
              <View style={[S.field, { paddingVertical: 8 }]}>
                <Text style={base.caption}>
                  Last synced: {formatLastSync(lastSync)}
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={[base.row, { gap: 8, marginTop: 8 }]}>
              {hkConnected ? (
                <>
                  <Pressable
                    style={[S.hkBtn, { backgroundColor: C.accent, flex: 1 }]}
                    onPress={handleSyncNow}
                    disabled={hkSyncing}
                  >
                    {hkSyncing ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Ionicons name="sync-outline" size={16} color="white" />
                        <Text style={S.hkBtnText}>Sync Now</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[S.hkBtn, { backgroundColor: C.cardAlt }]}
                    onPress={handleDisconnectHealthKit}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={C.red} />
                  </Pressable>
                </>
              ) : (
                <Pressable
                  style={[S.hkBtn, { backgroundColor: C.red, flex: 1 }]}
                  onPress={handleConnectHealthKit}
                  disabled={hkConnecting}
                >
                  {hkConnecting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="heart-circle" size={16} color="white" />
                      <Text style={S.hkBtnText}>Connect Apple Health</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={base.card}>
            <View style={S.field}>
              <View style={[base.row, { gap: 8 }]}>
                <Ionicons name="heart-circle" size={22} color={C.textDim} />
                <View>
                  <Text style={base.body}>Apple Health</Text>
                  <Text style={[base.caption, { marginTop: 2 }]}>
                    {Platform.OS !== "ios"
                      ? "Only available on iOS devices"
                      : "HealthKit not available on this device"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Other Integrations */}
        <Text style={[base.label, { marginBottom: 8 }]}>Other Integrations</Text>
        <View style={base.card}>
          {/* Withings Scale */}
          <Pressable
            style={S.field}
            onPress={() => {
              if (withingsConnected) {
                Alert.alert("Withings Scale", "Connected and syncing weight data automatically.", [
                  { text: "OK", style: "cancel" },
                  {
                    text: "Disconnect",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const res = await fetch(`${API_BASE}/api/integrations/withings/disconnect`, { method: "POST" });
                        if (res.ok) {
                          setWithingsConnected(false);
                          Alert.alert("Disconnected", "Withings has been disconnected.");
                        } else {
                          Alert.alert("Error", "Could not disconnect. Try again later.");
                        }
                      } catch {
                        Alert.alert("Error", "Could not disconnect. Try again later.");
                      }
                    },
                  },
                ]);
              } else {
                Alert.alert("Withings Scale", "Not connected. Connect via the web app to enable weight syncing.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Open Web App", onPress: () => Linking.openURL("https://health-coach-doug.vercel.app/settings") },
                ]);
              }
            }}
          >
            <View style={[base.row, { gap: 8 }]}>
              <Ionicons name="scale" size={20} color={withingsConnected ? C.green : C.textDim} />
              <View>
                <Text style={base.body}>Withings Scale</Text>
                <Text style={{ fontSize: 10, color: C.textDim }}>
                  {withingsConnected === null ? "Checking..." : "Tap to manage"}
                </Text>
              </View>
            </View>
            <View style={[base.row, { gap: 6 }]}>
              <View style={[S.statusBadge, { backgroundColor: withingsConnected ? C.greenBg : C.cardAlt }]}>
                <Text style={{ color: withingsConnected ? C.emerald : C.textDim, fontSize: 11, fontWeight: "500" }}>
                  {withingsConnected === null ? "..." : withingsConnected ? "Connected" : "Not Connected"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.textDim} />
            </View>
          </Pressable>

          <View style={S.divider} />

          {/* Google Calendar */}
          <Pressable
            style={S.field}
            onPress={() => {
              if (googleConnected) {
                Alert.alert("Google Calendar", "Connected for smart workout scheduling.", [
                  { text: "OK", style: "cancel" },
                  {
                    text: "Disconnect",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const res = await fetch(`${API_BASE}/api/integrations/google/disconnect`, { method: "POST" });
                        if (res.ok) {
                          setGoogleConnected(false);
                          Alert.alert("Disconnected", "Google Calendar has been disconnected.");
                        } else {
                          Alert.alert("Error", "Could not disconnect. Try again later.");
                        }
                      } catch {
                        Alert.alert("Error", "Could not disconnect. Try again later.");
                      }
                    },
                  },
                ]);
              } else {
                Alert.alert("Google Calendar", "Not connected. Connect via the web app to enable smart scheduling.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Open Web App", onPress: () => Linking.openURL("https://health-coach-doug.vercel.app/settings") },
                ]);
              }
            }}
          >
            <View style={[base.row, { gap: 8 }]}>
              <Ionicons name="calendar" size={20} color={googleConnected ? C.blue : C.textDim} />
              <View>
                <Text style={base.body}>Google Calendar</Text>
                <Text style={{ fontSize: 10, color: C.textDim }}>
                  {googleConnected === null ? "Checking..." : "Tap to manage"}
                </Text>
              </View>
            </View>
            <View style={[base.row, { gap: 6 }]}>
              <View style={[S.statusBadge, { backgroundColor: googleConnected ? C.greenBg : C.cardAlt }]}>
                <Text style={{ color: googleConnected ? C.emerald : C.textDim, fontSize: 11, fontWeight: "500" }}>
                  {googleConnected === null ? "..." : googleConnected ? "Connected" : "Not Connected"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.textDim} />
            </View>
          </Pressable>
        </View>

        {/* ===== NOTIFICATIONS ===== */}
        <View style={{ marginTop: 24, marginBottom: 8 }}>
          <Text style={[base.label, { marginBottom: 8 }]}>REMINDERS</Text>
          <View style={base.card}>
            {/* Master toggle */}
            <Pressable style={[base.rowBetween, { paddingVertical: 8 }]} onPress={toggleNotifications}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: "500", color: C.text }}>Push Notifications</Text>
                <Text style={{ fontSize: 11, color: C.textDim }}>Daily reminders to stay on track</Text>
              </View>
              <View style={[S.toggle, notifPrefs.enabled && S.toggleOn]}>
                <View style={[S.toggleKnob, notifPrefs.enabled && S.toggleKnobOn]} />
              </View>
            </Pressable>

            {notifPrefs.enabled && (
              <>
                <View style={S.divider} />

                {/* Morning weight */}
                <Pressable style={[base.rowBetween, { paddingVertical: 8 }]} onPress={() => updateNotifPref("morningWeight", !notifPrefs.morningWeight)}>
                  <View style={[base.row, { gap: 8 }]}>
                    <Text style={{ fontSize: 16 }}>⚖️</Text>
                    <View>
                      <Text style={{ fontSize: 13, color: C.text }}>Morning Weigh-in</Text>
                      <Text style={{ fontSize: 11, color: C.textDim }}>7:00 AM</Text>
                    </View>
                  </View>
                  <View style={[S.toggle, notifPrefs.morningWeight && S.toggleOn]}>
                    <View style={[S.toggleKnob, notifPrefs.morningWeight && S.toggleKnobOn]} />
                  </View>
                </Pressable>

                {/* Workout */}
                <Pressable style={[base.rowBetween, { paddingVertical: 8 }]} onPress={() => updateNotifPref("workoutReminder", !notifPrefs.workoutReminder)}>
                  <View style={[base.row, { gap: 8 }]}>
                    <Text style={{ fontSize: 16 }}>🏃</Text>
                    <View>
                      <Text style={{ fontSize: 13, color: C.text }}>Workout Reminder</Text>
                      <Text style={{ fontSize: 11, color: C.textDim }}>11:00 AM</Text>
                    </View>
                  </View>
                  <View style={[S.toggle, notifPrefs.workoutReminder && S.toggleOn]}>
                    <View style={[S.toggleKnob, notifPrefs.workoutReminder && S.toggleKnobOn]} />
                  </View>
                </Pressable>

                {/* Evening review */}
                <Pressable style={[base.rowBetween, { paddingVertical: 8 }]} onPress={() => updateNotifPref("eveningReview", !notifPrefs.eveningReview)}>
                  <View style={[base.row, { gap: 8 }]}>
                    <Text style={{ fontSize: 16 }}>📊</Text>
                    <View>
                      <Text style={{ fontSize: 13, color: C.text }}>Evening Review</Text>
                      <Text style={{ fontSize: 11, color: C.textDim }}>8:00 PM</Text>
                    </View>
                  </View>
                  <View style={[S.toggle, notifPrefs.eveningReview && S.toggleOn]}>
                    <View style={[S.toggleKnob, notifPrefs.eveningReview && S.toggleKnobOn]} />
                  </View>
                </Pressable>

                {/* Water */}
                <Pressable style={[base.rowBetween, { paddingVertical: 8 }]} onPress={() => updateNotifPref("waterReminder", !notifPrefs.waterReminder)}>
                  <View style={[base.row, { gap: 8 }]}>
                    <Text style={{ fontSize: 16 }}>💧</Text>
                    <View>
                      <Text style={{ fontSize: 13, color: C.text }}>Water Reminders</Text>
                      <Text style={{ fontSize: 11, color: C.textDim }}>Every 2 hrs, 9am-6pm</Text>
                    </View>
                  </View>
                  <View style={[S.toggle, notifPrefs.waterReminder && S.toggleOn]}>
                    <View style={[S.toggleKnob, notifPrefs.waterReminder && S.toggleKnobOn]} />
                  </View>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <Pressable style={S.saveBtn} onPress={save}>
          <Text style={{ color: "white", fontWeight: "600", fontSize: 15 }}>
            Save Settings
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  input: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    minWidth: 100,
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginVertical: 10,
  },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  dataBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewItem: {
    flex: 1,
    minWidth: 70,
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  previewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
  },
  previewLabel: {
    fontSize: 9,
    color: C.textDim,
    textTransform: "uppercase",
  },
  hkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  hkBtnText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(100,116,139,0.4)",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: C.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "white",
  },
  toggleKnobOn: {
    alignSelf: "flex-end" as const,
  },
});
