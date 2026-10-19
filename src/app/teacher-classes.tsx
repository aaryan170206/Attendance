
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";

import {
  getMyTeacherClasses,
  getStudentsInClass,
  TeacherClass,
  TeacherClassStudent,
} from "@/services/teacherClasses";

const isDarkTheme = (background: string) => {
  const hex = background.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return false;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};

export default function TeacherClasses() {
  const { colors } = useTheme();

  const dark = isDarkTheme(colors.background);

  // Emerald Green theme
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

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  // Prevent outdated student requests from updating the wrong class
  const studentRequestId = useRef(0);

  // Fetch assigned classes
  const loadClasses = useCallback(async () => {
    try {
      setError(null);

      const result = await getMyTeacherClasses();

      if (result.error) {
        throw result.error;
      }

      setClasses(result.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load classes."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // Pull-to-refresh
  const handleRefresh = () => {
    setRefreshing(true);
    loadClasses();
  };

  // Expand or collapse a class
  const toggleClass = async (classId: string) => {
    if (expandedClassId === classId) {
      studentRequestId.current += 1;

      setExpandedClassId(null);
      setStudents([]);
      setStudentsError(null);
      setStudentsLoading(false);

      return;
    }

    const requestId = ++studentRequestId.current;

    setExpandedClassId(classId);
    setStudents([]);
    setStudentsError(null);
    setStudentsLoading(true);

    try {
      const result = await getStudentsInClass(classId);

      if (requestId !== studentRequestId.current) {
        return;
      }

      if (result.error) {
        throw result.error;
      }

      setStudents(result.data ?? []);
    } catch (err) {
      if (requestId !== studentRequestId.current) {
        return;
      }

      setStudentsError(
        err instanceof Error
          ? err.message
          : "Unable to load students."
      );
    } finally {
      if (requestId === studentRequestId.current) {
        setStudentsLoading(false);
      }
    }
  };

  const styles = createStyles(palette);

  // Initial loading
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
          Loading your classes
        </Text>

        <Text style={styles.message}>
          Retrieving your academic assignments...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
      >
        {/* Page Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            ATTENDFLOW  /  FACULTY
          </Text>

          <Text style={styles.heading}>
            My{"\n"}
            <Text style={styles.headingAccent}>
              Classes.
            </Text>
          </Text>

          <Text style={styles.subtitle}>
            Manage your assigned classes, explore
            subjects and view enrolled students.
          </Text>
        </View>

        {/* Class Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Text style={styles.summaryIconText}>▤</Text>
          </View>

          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>
              YOUR ASSIGNMENTS
            </Text>

            <Text style={styles.summaryValue}>
              {classes.length}{" "}
              <Text style={styles.summarySuffix}>
                {classes.length === 1 ? "Class" : "Classes"}
              </Text>
            </Text>
          </View>

          <View style={styles.summaryDecoration}>
            <Text style={styles.summaryDecorationText}>
              ✦
            </Text>
          </View>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>
              TEACHING RESPONSIBILITIES
            </Text>

            <Text style={styles.sectionTitle}>
              Assigned Classes
            </Text>
          </View>

          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {classes.length}
            </Text>
          </View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>
              Unable to retrieve classes
            </Text>

            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadClasses}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : classes.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>▤</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No classes assigned
            </Text>

            <Text style={styles.message}>
              Your assigned classes will appear here
              once they have been allocated to you.
            </Text>
          </View>
        ) : (
          <View style={styles.classList}>
            {classes.map((item, index) => {
              const isExpanded = expandedClassId === item.id;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.classCard,
                    isExpanded && styles.expandedCard,
                  ]}
                >
                  {/* Class Card Header */}
                  <View style={styles.classHeader}>
                    <View style={styles.classIdentity}>
                      <View style={styles.classNumber}>
                        <Text style={styles.classNumberText}>
                          {String(index + 1).padStart(2, "0")}
                        </Text>
                      </View>

                      <View style={styles.classInfo}>
                        <Text style={styles.classEyebrow}>
                          ACADEMIC CLASS
                        </Text>

                        <Text style={styles.className}>
                          {item.name}
                          {item.section
                            ? ` - ${item.section}`
                            : ""}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.classSymbol}>
                      <Text style={styles.classSymbolText}>
                        ▤
                      </Text>
                    </View>
                  </View>

                  {/* Semester */}
                  {item.semester !== null && (
                    <View style={styles.semesterBadge}>
                      <Text style={styles.semesterText}>
                        SEMESTER {item.semester}
                      </Text>
                    </View>
                  )}

                  {/* Subjects */}
                  <View style={styles.subjectSection}>
                    <Text style={styles.subjectHeading}>
                      ASSIGNED SUBJECTS
                    </Text>

                    {item.subjects.length > 0 ? (
                      <View style={styles.subjectList}>
                        {item.subjects.map((subject) => (
                          <View
                            key={subject.id}
                            style={styles.subjectTag}
                          >
                            <View style={styles.subjectDot} />

                            <Text style={styles.subjectTagText}>
                              {subject.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.message}>
                        No subjects assigned.
                      </Text>
                    )}
                  </View>

                  {/* Expand Button */}
                  <Pressable
                    style={[
                      styles.viewButton,
                      isExpanded && styles.viewButtonActive,
                    ]}
                    onPress={() => toggleClass(item.id)}
                  >
                    <Text
                      style={[
                        styles.viewButtonText,
                        isExpanded && styles.viewButtonTextActive,
                      ]}
                    >
                      {isExpanded
                        ? "Hide Enrolled Students"
                        : "View Enrolled Students"}
                    </Text>

                    <Text
                      style={[
                        styles.viewArrow,
                        isExpanded && styles.viewArrowActive,
                      ]}
                    >
                      {isExpanded ? "−" : "+"}
                    </Text>
                  </Pressable>

                  {/* Expanded Student Section */}
                  {isExpanded && (
                    <View style={styles.studentSection}>
                      <View style={styles.studentSectionHeader}>
                        <View>
                          <Text style={styles.studentEyebrow}>
                            CLASS DIRECTORY
                          </Text>

                          <Text style={styles.studentHeading}>
                            Enrolled Students
                          </Text>
                        </View>

                        {!studentsLoading &&
                          !studentsError && (
                            <View style={styles.studentCountBadge}>
                              <Text style={styles.studentCountText}>
                                {students.length}
                              </Text>
                            </View>
                          )}
                      </View>

                      {studentsLoading ? (
                        <View style={styles.studentLoading}>
                          <ActivityIndicator
                            size="small"
                            color={palette.primary}
                          />

                          <Text style={styles.message}>
                            Loading students...
                          </Text>
                        </View>
                      ) : studentsError ? (
                        <View style={styles.studentErrorContainer}>
                          <Text style={styles.errorText}>
                            {studentsError}
                          </Text>

                          <Pressable
                            onPress={() => toggleClass(item.id)}
                            style={styles.studentRetryButton}
                          >
                            <Text style={styles.studentRetryText}>
                              Retry
                            </Text>
                          </Pressable>
                        </View>
                      ) : students.length === 0 ? (
                        <Text style={styles.message}>
                          No students are enrolled in this class.
                        </Text>
                      ) : (
                        <View style={styles.studentList}>
                          {students.map((student, studentIndex) => (
                            <View
                              key={student.id}
                              style={styles.studentCard}
                            >
                              <View style={styles.studentAvatar}>
                                <Text style={styles.studentAvatarText}>
                                  {(student.full_name || "S")
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                                </Text>
                              </View>

                              <View style={styles.studentInfo}>
                                <Text style={styles.studentName}>
                                  {student.full_name ||
                                    "Name unavailable"}
                                </Text>

                                <Text style={styles.studentRoll}>
                                  {student.roll_number
                                    ? `Roll No: ${student.roll_number}`
                                    : `Student ${studentIndex + 1}`}
                                </Text>
                              </View>

                              <Text style={styles.studentArrow}>
                                ›
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

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

// Emerald Green styles
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
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 68,
      paddingBottom: 40,
    },

    // Header
    header: {
      marginBottom: 25,
    },

    eyebrow: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 2,
      color: palette.primary,
      marginBottom: 24,
    },

    heading: {
      fontSize: 38,
      fontWeight: "800",
      lineHeight: 43,
      letterSpacing: -1,
      color: palette.text,
    },

    headingAccent: {
      fontWeight: "500",
      color: palette.primary,
    },

    subtitle: {
      fontSize: 13,
      lineHeight: 21,
      color: palette.secondary,
      marginTop: 12,
      maxWidth: 310,
    },

    // Summary
    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.accent,
      borderRadius: 14,
      padding: 17,
      marginBottom: 30,
      overflow: "hidden",
    },

    summaryIcon: {
      width: 45,
      height: 45,
      borderRadius: 12,
      backgroundColor: palette.card,
      alignItems: "center",
      justifyContent: "center",
    },

    summaryIconText: {
      fontSize: 23,
      color: palette.primary,
    },

    summaryContent: {
      flex: 1,
      marginLeft: 13,
    },

    summaryLabel: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.3,
      color: palette.secondary,
    },

    summaryValue: {
      fontSize: 25,
      fontWeight: "900",
      color: palette.text,
      marginTop: 3,
    },

    summarySuffix: {
      fontSize: 14,
      fontWeight: "600",
      color: palette.secondary,
    },

    summaryDecoration: {
      paddingHorizontal: 5,
    },

    summaryDecorationText: {
      fontSize: 34,
      color: palette.primary,
      opacity: 0.6,
    },

    // Section
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 17,
    },

    sectionEyebrow: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.5,
      color: palette.primary,
      marginBottom: 6,
    },

    sectionTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: palette.text,
    },

    countBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.accent,
    },

    countBadgeText: {
      fontSize: 13,
      fontWeight: "900",
      color: palette.primary,
    },

    // Class list
    classList: {
      gap: 14,
    },

    classCard: {
      backgroundColor: palette.card,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 17,
      overflow: "hidden",
    },

    expandedCard: {
      borderColor: palette.primary,
    },

    classHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    classIdentity: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    classNumber: {
      width: 43,
      height: 43,
      borderRadius: 12,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    classNumberText: {
      fontSize: 13,
      fontWeight: "900",
      color: palette.primary,
    },

    classInfo: {
      flex: 1,
      marginLeft: 12,
    },

    classEyebrow: {
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1.2,
      color: palette.secondary,
      marginBottom: 5,
    },

    className: {
      fontSize: 17,
      fontWeight: "800",
      color: palette.text,
    },

    classSymbol: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: palette.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },

    classSymbolText: {
      fontSize: 18,
      color: palette.primary,
    },

    // Semester
    semesterBadge: {
      alignSelf: "flex-start",
      backgroundColor: palette.accent,
      borderRadius: 5,
      paddingHorizontal: 9,
      paddingVertical: 6,
      marginTop: 15,
    },

    semesterText: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
      color: palette.primary,
    },

    // Subjects
    subjectSection: {
      marginTop: 20,
    },

    subjectHeading: {
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1.2,
      color: palette.secondary,
      marginBottom: 10,
    },

    subjectList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    subjectTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: palette.cardSecondary,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 7,
      gap: 7,
    },

    subjectDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: palette.primary,
    },

    subjectTagText: {
      fontSize: 11,
      fontWeight: "600",
      color: palette.text,
    },

    // View button
    viewButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: palette.primary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 9,
      marginTop: 20,
    },

    viewButtonActive: {
      backgroundColor: palette.accent,
      borderWidth: 1,
      borderColor: palette.border,
    },

    viewButtonText: {
  fontSize: 12,
  fontWeight: "800",
  color: palette.background === "#101F19"
    ? "#064E3B"
    : "#FFFFFF",
    },

    viewButtonTextActive: {
      color: palette.primary,
    },

    viewArrow: {
  fontSize: 20,
  fontWeight: "500",
  color: palette.background === "#101F19"
    ? "#064E3B"
    : "#FFFFFF",
},

    viewArrowActive: {
      color: palette.primary,
    },

    // Student section
    studentSection: {
      marginTop: 20,
      paddingTop: 17,
      borderTopWidth: 1,
      borderTopColor: palette.border,
    },

    studentSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 13,
    },

    studentEyebrow: {
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 1.3,
      color: palette.primary,
      marginBottom: 5,
    },

    studentHeading: {
      fontSize: 17,
      fontWeight: "800",
      color: palette.text,
    },

    studentCountBadge: {
      minWidth: 30,
      height: 30,
      paddingHorizontal: 8,
      borderRadius: 9,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    studentCountText: {
      fontSize: 12,
      fontWeight: "900",
      color: palette.primary,
    },

    studentList: {
      gap: 8,
    },

    studentCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 11,
      borderRadius: 10,
      backgroundColor: palette.background,
    },

    studentAvatar: {
      width: 37,
      height: 37,
      borderRadius: 12,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
    },

    studentAvatarText: {
      fontSize: 15,
      fontWeight: "900",
      color: palette.primary,
    },

    studentInfo: {
      flex: 1,
      marginLeft: 11,
    },

    studentName: {
      fontSize: 13,
      fontWeight: "700",
      color: palette.text,
    },

    studentRoll: {
      fontSize: 10,
      color: palette.secondary,
      marginTop: 4,
    },

    studentArrow: {
      fontSize: 23,
      color: palette.secondary,
      marginLeft: 5,
    },

    studentLoading: {
      alignItems: "center",
      paddingVertical: 15,
      gap: 10,
    },

    studentErrorContainer: {
      paddingVertical: 8,
      alignItems: "flex-start",
    },

    studentRetryButton: {
      marginTop: 10,
      paddingHorizontal: 13,
      paddingVertical: 8,
      backgroundColor: palette.accent,
      borderRadius: 7,
    },

    studentRetryText: {
      fontSize: 11,
      fontWeight: "800",
      color: palette.primary,
    },

    // Empty state
    emptyCard: {
      alignItems: "center",
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 15,
      padding: 27,
    },

    emptyIcon: {
      width: 55,
      height: 55,
      borderRadius: 16,
      backgroundColor: palette.accent,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 15,
    },

    emptyIconText: {
      fontSize: 25,
      color: palette.primary,
    },

    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: palette.text,
      marginBottom: 8,
    },

    // Error
    errorCard: {
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 14,
      padding: 18,
    },

    errorTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: palette.text,
      marginBottom: 7,
    },

    errorText: {
      fontSize: 12,
      lineHeight: 18,
      color: palette.danger,
    },

    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: palette.primary,
      paddingHorizontal: 17,
      paddingVertical: 10,
      borderRadius: 8,
      marginTop: 15,
    },

    retryText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },

    // General
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.background,
      padding: 25,
    },

    loadingIcon: {
      width: 62,
      height: 62,
      borderRadius: 18,
      backgroundColor: palette.card,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
    },

    loadingTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: palette.text,
      marginBottom: 7,
    },

    message: {
      fontSize: 12,
      lineHeight: 19,
      color: palette.secondary,
      textAlign: "center",
    },

    // Footer
    footer: {
      alignItems: "center",
      marginTop: 38,
    },

    footerLine: {
      width: 42,
      height: 1,
      backgroundColor: palette.primary,
      marginBottom: 13,
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
  });
