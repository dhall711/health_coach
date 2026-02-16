import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import "../global.css";

// Disable Dynamic Type font scaling globally so our layout doesn't break
// on devices with larger accessibility text settings
(Text as any).defaultProps = { ...((Text as any).defaultProps || {}), allowFontScaling: false };
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps || {}), allowFontScaling: false };

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

// Custom dark theme matching our web app
const HealthDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#0ea5e9", // sky-500
    background: "#0f172a", // slate-900
    card: "#1e293b", // slate-800
    text: "#f8fafc", // slate-50
    border: "#334155", // slate-700
    notification: "#0ea5e9",
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={HealthDarkTheme}>
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
