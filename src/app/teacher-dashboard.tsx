
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getMyClassesConducted,
  getMyTeachingAssignments,
  getMyTotalEnrolments,
} from "@/lib/teacher";

import { useTheme } from "@/context/ThemeContext";

// Dashboard statistics type
type DashboardStats = {
  assignedSubjects: number;
  totalEnrolments: number;
  classesConducted: number;
};

export default function TeacherDashboard() {
  const { colors } = useTheme();

  const [stats, setStats] = useState<DashboardStats>({
    assignedSubjects: 0,
    totalEnrolments: 0,
    classesConducted: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dashboard data
  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all dashboard statistics simultaneously
      const [
        assignmentsResult,
        enrolmentsResult,
        classesResult,
      ] = await Promise.all([
        getMyTeachingAssignments(),
        getMyTotalEnrolments(),
        getMyClassesConducted(),
      ]);

      // Check for errors
      if (assignmentsResult.error) {
        throw assignmentsResult.error;
      }

      if (enrolmentsResult.error) {
        throw enrolmentsResult.error;
      }

      if (classesResult.error) {
        throw classesResult.error;
      }

      // Update dashboard statistics
      setStats({
        assignedSubjects: assignmentsResult.data?.length ?? 0,
        totalEnrolments: enrolmentsResult.count ?? 0,
        classesConducted: classesResult.count ?? 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  // Theme-based styles
  const styles = createStyles(colors);

  // Loading screen
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text style={styles.loadingText}>
          Loading teacher dashboard...
        </Text>
      </View>
    );
  }

  // Error screen
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  // Dashboard UI
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
    >
      <Text style={styles.heading}>
        Teacher Dashboard
      </Text>

      {/* Dashboard statistics */}
      <View style={styles.statsContainer}>

        {/* Assigned Subjects */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Assigned Subjects
          </Text>

          <Text style={styles.cardValue}>
            {stats.assignedSubjects}
          </Text>
        </View>

        {/* Total Enrolments */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Total Enrolments
          </Text>

          <Text style={styles.cardValue}>
            {stats.totalEnrolments}
          </Text>
        </View>

        {/* Classes Conducted */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Classes Conducted
          </Text>

          <Text style={styles.cardValue}>
            {stats.classesConducted}
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}

// Theme-based styles
const createStyles = (
  colors: ReturnType<typeof useTheme>["colors"]
) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      padding: 20,
      paddingTop: 68,
      paddingBottom: 20,
      flexGrow: 1,
    },

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      padding: 20,
    },

    heading: {
      fontSize: 26,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 6,
    },


    statsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },

    card: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 18,
      minHeight: 120,
      justifyContent: "space-between",
    },

    cardTitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },

    cardValue: {
      fontSize: 30,
      fontWeight: "bold",
      color: colors.text,
    },

    loadingText: {
      marginTop: 12,
      color: colors.textSecondary,
    },

    errorText: {
      color: colors.absent,
      textAlign: "center",
    },
  });
