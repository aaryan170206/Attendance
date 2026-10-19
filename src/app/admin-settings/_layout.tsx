
import { Stack } from "expo-router";
import { useTheme } from "@/context/ThemeContext";

export default function AdminSettingsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
        animation: "slide_from_right",
      }}
    />
  );
}
