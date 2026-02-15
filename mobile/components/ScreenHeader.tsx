import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C, base } from "@/lib/theme";

interface Props {
  title: string;
  subtitle?: string;
  showSettings?: boolean;
}

export default function ScreenHeader({ title, subtitle, showSettings }: Props) {
  const router = useRouter();
  return (
    <View style={S.header}>
      <Pressable style={S.homeBtn} onPress={() => router.replace("/(tabs)/")}>
        <Ionicons name="home" size={18} color={C.text} />
      </Pressable>
      <View style={S.titleWrap}>
        <Text style={base.h2}>{title}</Text>
        {subtitle ? <Text style={base.caption}>{subtitle}</Text> : null}
      </View>
      {showSettings ? (
        <Pressable style={S.homeBtn} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={18} color={C.textSec} />
        </Pressable>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  homeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
  },
});
