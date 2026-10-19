
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Pressable,
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
import { getMyTeacherClasses } from "@/services/teacherClasses";

// Dashboard statistics
type DashboardStats = {
  assignedSubjects: number;
  assignedClasses: number;
  totalEnrolments: number;
  classesConducted: number;
};

// Detect whether the current application theme is dark
const isDarkTheme = (background: string) => {
  const hex = background.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return false;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness < 128;
};

export default function TeacherDashboard() {
  const { colors } = useTheme();

  const dark = isDarkTheme(colors.background);

  // Dark Academia colour palette
  const palette = dark
  ? {
      background: "#101F19",
      card: "#1B3026",
      cardSecondary: "#223B2E",
      primary: "#A7F3D0",
      accent: "#244B38",
      text: "#E8F5EC",
      secondary: "#A7BCAF",
      border: "#345342",
      danger: "#F28B82",
    }
  : {
      background: "#F0F7F3",
      card: "#FFFFFF",
      cardSecondary: "#DDF0E4",
      primary: "#047857",
      accent: "#D1FAE5",
      text: "#18352A",
      secondary: "#718579",
      border: "#D5E5DA",
      danger: "#C6534D",
    };

  const [stats, setStats] = useState<DashboardStats>({
    assignedSubjects: 0,
    assignedClasses: 0,
    totalEnrolments: 0,
    classesConducted: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load dashboard information
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        assignmentsResult,
        enrolmentsResult,
        classesResult,
        assignedClassesResult,
      ] = await Promise.all([
        getMyTeachingAssignments(),
        getMyTotalEnrolments(),
        getMyClassesConducted(),
        getMyTeacherClasses(),
      ]);

      if (assignmentsResult.error) {
        throw assignmentsResult.error;
      }

      if (enrolmentsResult.error) {
        throw enrolmentsResult.error;
      }

      if (classesResult.error) {
        throw classesResult.error;
      }

      if (assignedClassesResult.error) {
        throw assignedClassesResult.error;
      }

      setStats({
        assignedSubjects: assignmentsResult.data?.length ?? 0,
        assignedClasses: assignedClassesResult.data?.length ?? 0,
        totalEnrolments: enrolmentsResult.count ?? 0,
        classesConducted: classesResult.count ?? 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const styles = createStyles(palette);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statCards = [
    {
      title: "Assigned Subjects",
      value: stats.assignedSubjects,
      icon: "📚",
      description: "Subjects under your guidance",
    },
    {
      title: "Assigned Classes",
      value: stats.assignedClasses,
      icon: "🏛️",
      description: "Academic classes assigned",
    },
    {
      title: "Total Enrolments",
      value: stats.totalEnrolments,
      icon: "👥",
      description: "Students across your classes",
    },
    {
      title: "Classes Conducted",
      value: stats.classesConducted,
      icon: "✓",
      description: "Classes recorded so far",
    },
  ];

  // Loading screen
  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator
            size="large"
            color={palette.primary}
          />
        </View>

        <Text style={styles.loadingTitle}>
          Preparing your workspace
        </Text>

        <Text style={styles.loadingText}>
          Retrieving academic information...
        </Text>
      </View>
    );
  }

  // Error screen
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>

        <Text style={styles.errorTitle}>
          Unable to load dashboard
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>

        <Pressable
          onPress={loadDashboard}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Faculty Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.eyebrow}>
              ATTENDFLOW  /  FACULTY
            </Text>

            <View style={styles.headerBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.headerBadgeText}>
                FACULTY
              </Text>
            </View>
          </View>

          <Text style={styles.heading}>
            Academic{"\n"}
            <Text style={styles.headingAccent}>
              Overview.
            </Text>
          </Text>

          <Text style={styles.subtitle}>
            Your teaching workspace and academic
            responsibilities in one place.
          </Text>

          <View style={styles.dateContainer}>
            <Text style={styles.dateIcon}>◷</Text>
            <Text style={styles.dateText}>
              {today}
            </Text>
          </View>
        </View>

        {/* Decorative Divider */}
        <View style={styles.decorativeDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerSymbol}>✦</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Statistics Heading */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              ACADEMIC RECORD
            </Text>

            <Text style={styles.sectionTitle}>
              At a Glance
            </Text>
          </View>

          <View style={styles.overviewBadge}>
            <Text style={styles.overviewBadgeText}>
              OVERVIEW
            </Text>
          </View>
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsContainer}>
          {statCards.map((item, index) => (
            <View
              key={item.title}
              style={[
                styles.statCard,
                index === 0 && styles.featuredCard,
              ]}
            >
              <View style={styles.statTop}>
                <View style={styles.statIcon}>
                  <Text style={styles.statIconText}>
                    {item.icon}
                  </Text>
                </View>

                <Text style={styles.statNumberLabel}>
                  0{index + 1}
                </Text>
              </View>

              <Text style={styles.cardValue}>
                {item.value}
              </Text>

              <Text style={styles.cardTitle}>
                {item.title}
              </Text>

              <Text style={styles.cardDescription}>
                {item.description}
              </Text>

              <View style={styles.cardBottom}>
                <View style={styles.cardBottomLine} />
              </View>
            </View>
          ))}
        </View>

        {/* Academic Note */}
        <View style={styles.noteCard}>
          <View style={styles.noteIcon}>
            <Text style={styles.noteIconText}>✦</Text>
          </View>

          <View style={styles.noteContent}>
            <Text style={styles.noteTitle}>
              Academic Excellence
            </Text>

            <Text style={styles.noteDescription}>
              Every class contributes to a stronger
              learning environment. Keep your academic
              records updated.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />

          <Text style={styles.footerTitle}>
            ATTENDFLOW
          </Text>

          <Text style={styles.footerSubtitle}>
            FACULTY WORKSPACE
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Dark Academia styles
const createStyles = (palette: {
  background: string;
  card: string;
  cardSecondary: string;
  primary: string;
  accent: string;
  text: string;
  secondary: string;
  border: string;
  danger: string;
}) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: palette.background,
    },

    container: {
      paddingHorizontal: 20,
      paddingTop: 68,
      paddingBottom: 40,
    },

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.background,
      padding: 25,
    },

    // Header
    header: {
      marginBottom: 25,
    },

    headerTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 27,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
      color: palette.primary,
    },

    headerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 6,
      backgroundColor: palette.accent,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.primary,
    },

    headerBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
      color: palette.primary,
    },

    heading: {
      fontSize: 38,
      fontWeight: "800",
      lineHeight: 43,
      letterSpacing: -1.2,
      color: palette.text,
    },

    headingAccent: {
      color: palette.primary,
      fontWeight: "500",
    },

    subtitle: {
      fontSize: 13,
      lineHeight: 21,
      color: palette.secondary,
      marginTop: 13,
      maxWidth: 290,
    },

    dateContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 20,
      gap: 9,
    },

    dateIcon: {
      fontSize: 19,
      color: palette.primary,
    },

    dateText: {
      fontSize: 12,
      fontWeight: "600",
      color: palette.secondary,
    },

    // Divider
    decorativeDivider: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 28,
    },

    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: palette.border,
    },

    dividerSymbol: {
      fontSize: 14,
      color: palette.primary,
    },

    // Section
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 17,
    },

    sectionEyebrow: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.8,
      color: palette.primary,
      marginBottom: 6,
    },

    sectionTitle: {
      fontSize: 23,
      fontWeight: "800",
      color: palette.text,
      letterSpacing: -0.5,
    },

    overviewBadge: {
      borderWidth: 1,
      borderColor: palette.border,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 5,
    },

    overviewBadgeText: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.8,
      color: palette.secondary,
    },

    // Statistics
    statsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
    },

    statCard: {
      width: "48%",
      minHeight: 172,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 13,
      padding: 14,
      justifyContent: "space-between",
      overflow: "hidden",
    },

    featuredCard: {
      borderTopWidth: 3,
      borderTopColor: palette.primary,
    },

    statTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    statIcon: {
      width: 35,
      height: 35,
      borderRadius: 9,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    statIconText: {
      fontSize: 16,
      color: palette.primary,
    },

    statNumberLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: palette.secondary,
      letterSpacing: 1,
    },

    cardValue: {
      fontSize: 34,
      fontWeight: "800",
      color: palette.primary,
      marginTop: 15,
    },

    cardTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: palette.text,
      marginTop: 3,
    },

    cardDescription: {
      fontSize: 10,
      lineHeight: 15,
      color: palette.secondary,
      marginTop: 5,
    },

    cardBottom: {
      marginTop: 13,
    },

    cardBottomLine: {
      width: 28,
      height: 2,
      backgroundColor: palette.primary,
      opacity: 0.6,
    },

    // Academic note
    noteCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: palette.cardSecondary,
      borderRadius: 12,
      padding: 16,
      marginTop: 24,
      gap: 13,
    },

    noteIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: palette.card,
      justifyContent: "center",
      alignItems: "center",
    },

    noteIconText: {
      fontSize: 17,
      color: palette.primary,
    },

    noteContent: {
      flex: 1,
    },

    noteTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: palette.text,
    },

    noteDescription: {
      fontSize: 11,
      lineHeight: 18,
      color: palette.secondary,
      marginTop: 5,
    },

    // Footer
    footer: {
      alignItems: "center",
      marginTop: 38,
    },

    footerLine: {
      width: 45,
      height: 1,
      backgroundColor: palette.primary,
      marginBottom: 14,
      opacity: 0.7,
    },

    footerTitle: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 3,
      color: palette.text,
    },

    footerSubtitle: {
      fontSize: 8,
      fontWeight: "700",
      letterSpacing: 2,
      color: palette.secondary,
      marginTop: 5,
    },

    // Loading
    loadingIcon: {
      width: 65,
      height: 65,
      borderRadius: 20,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: palette.border,
    },

    loadingTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: palette.text,
      marginTop: 20,
    },

    loadingText: {
      fontSize: 12,
      color: palette.secondary,
      marginTop: 7,
    },

    // Error
    errorIcon: {
      fontSize: 32,
      marginBottom: 15,
    },

    errorTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: palette.text,
      textAlign: "center",
    },

    errorText: {
      fontSize: 12,
      color: palette.danger,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 19,
    },

    retryButton: {
      backgroundColor: palette.primary,
      paddingHorizontal: 25,
      paddingVertical: 12,
      borderRadius: 9,
      marginTop: 22,
    },

    retryText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
  });
