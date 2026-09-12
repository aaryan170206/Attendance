import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";

const lightColors = {
  background: "#FFFFFF",
  card: "#F5F5F5",
  cardSecondary: "#EAEAEA",
  text: "#18181B",
  textSecondary: "#71717A",
  border: "#D4D4D8",

  primary: "#2563EB",

  present: "#22C55E",
  absent: "#EF4444",
  leftEarly: "#EAB308",
  club: "#3B82F6",
  partial: "#06B6D4",
  noClass: "#52525B",

  labPresent: "#A855F7",
  labAbsent: "#F97316",
  noLab: "#52525B",

  today: "#EC4899",
};

const darkColors = {
  background: "#09090B",
  card: "#18181B",
  cardSecondary: "#27272A",
  text: "#FAFAFA",
  textSecondary: "#A1A1AA",
  border: "#3F3F46",

  primary: "#3B82F6",

  present: "#22C55E",
  absent: "#EF4444",
  leftEarly: "#EAB308",
  club: "#3B82F6",
  partial: "#06B6D4",
  noClass: "#52525B",

  labPresent: "#A855F7",
  labAbsent: "#F97316",
  noLab: "#52525B",

  today: "#EC4899",
};

type ThemeContextType = {
  isDark: boolean;
  colors: typeof lightColors;
};

const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const systemTheme = useColorScheme();

  const isDark = systemTheme === "dark";

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}