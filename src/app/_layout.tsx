
import * as SplashScreen from "expo-splash-screen";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppTabs from "@/components/app-tabs";
import AuthScreen from "@/components/AuthScreen";
import TeacherTabs from "@/components/teacher-tabs";

import { AttendanceProvider } from "@/context/AttendanceContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SubjectProvider } from "@/context/SubjectContext";
import { ThemeProvider } from "@/context/ThemeContext";

import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { session, role, loading, roleError } = useAuth();

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

  if (roleError || !role) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Text style={{ textAlign: "center" }}>
          {roleError ?? "Unable to determine your account role."}
        </Text>
      </View>
    );
  }

  if (role === "student") {
    return <AppTabs />;
  }

  if (role === "teacher") {
    return <TeacherTabs />;
  }

  if (role === "admin") {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text>Admin interface will be added later.</Text>
      </View>
    );
  }

  return null;
}

export default function TabLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SubjectProvider>
          <AttendanceProvider>
            <AppContent />

            <AnimatedSplashOverlay />
          </AttendanceProvider>
        </SubjectProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
