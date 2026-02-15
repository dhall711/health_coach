// Shared design tokens for consistent styling
import { StyleSheet } from "react-native";

export const C = {
  bg: "#0f172a",        // slate-900
  card: "#1e293b",      // slate-800
  cardAlt: "#334155",   // slate-700
  border: "#334155",    // slate-700
  borderLight: "rgba(51,65,85,0.5)",
  text: "#f8fafc",      // slate-50
  textSec: "#94a3b8",   // slate-400
  textDim: "#64748b",   // slate-500
  accent: "#0ea5e9",    // sky-500
  accentDark: "#0369a1",
  green: "#16a34a",     // green-600
  greenBg: "rgba(6,78,59,0.3)",
  greenBorder: "rgba(6,78,59,0.4)",
  red: "#ef4444",
  amber: "#f59e0b",
  emerald: "#10b981",
  indigo: "#4338ca",
  indigoBg: "#4338ca",
  indigoLight: "#a5b4fc",
  purple: "#7c3aed",
  blue: "#3b82f6",
  blueBg: "rgba(30,58,138,0.4)",
  blueBorder: "rgba(30,64,175,0.3)",
  blueText: "#93c5fd",
} as const;

export const base = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingHorizontal: 16 },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardSmall: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  flex1: { flex: 1 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  // Typography
  h1: { fontSize: 24, fontWeight: "700", color: C.text },
  h2: { fontSize: 18, fontWeight: "700", color: C.text },
  h3: { fontSize: 15, fontWeight: "600", color: C.text },
  body: { fontSize: 14, color: C.text },
  bodySec: { fontSize: 13, color: C.textSec },
  caption: { fontSize: 11, color: C.textDim },
  label: { fontSize: 11, fontWeight: "600", color: C.textSec, textTransform: "uppercase" as const, letterSpacing: 0.8 },
  // Progress bar base
  progressTrack: { height: 8, backgroundColor: C.cardAlt, borderRadius: 99, overflow: "hidden" as const },
  progressFill: { height: 8, borderRadius: 99 },
});
