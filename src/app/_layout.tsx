import * as SplashScreen from "expo-splash-screen";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import AuthScreen from "@/components/AuthScreen";

import { AttendanceProvider } from "@/context/AttendanceContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SubjectProvider } from "@/context/SubjectContext";
import { ThemeProvider } from "@/context/ThemeContext";

import {
  ActivityIndicator,
  View,
} from "react-native";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <AppTabs />;
}

export default function TabLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SubjectProvider>
          <AttendanceProvider>
            <AppContent />

            {/* Keep splash overlay outside the auth check */}
            <AnimatedSplashOverlay />
          </AttendanceProvider>
        </SubjectProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}