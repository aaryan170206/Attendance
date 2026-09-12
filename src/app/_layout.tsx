import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { SubjectProvider } from "@/context/SubjectContext";
import { ThemeProvider } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <ThemeProvider>
      <SubjectProvider>
        <AttendanceProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </AttendanceProvider>
      </SubjectProvider>
    </ThemeProvider>
  );
}