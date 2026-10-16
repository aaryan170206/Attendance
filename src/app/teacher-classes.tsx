
import { useCallback, useEffect, useState } from "react";

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

export default function TeacherClasses() {
  const { colors } = useTheme();

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

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

  const toggleClass = async (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      setStudents([]);
      setStudentsError(null);
      return;
    }

    setExpandedClassId(classId);
    setStudents([]);
    setStudentsError(null);
    setStudentsLoading(true);

    try {
      const result = await getStudentsInClass(classId);

      if (result.error) {
        throw result.error;
      }

      setStudents(result.data ?? []);
    } catch (err) {
      setStudentsError(
        err instanceof Error
          ? err.message
          : "Unable to load students."
      );
    } finally {
      setStudentsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 68,
      paddingBottom: 35,
    },

    heading: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text,
    },

    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 7,
      marginBottom: 22,
    },

    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 18,
      marginBottom: 15,
    },

    className: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },

    subject: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },

    semester: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 6,
    },

    viewButton: {
      backgroundColor: colors.primary,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 10,
      alignSelf: "flex-start",
      marginTop: 16,
    },

    viewButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },

    studentSection: {
      marginTop: 20,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    studentHeading: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },

    studentCard: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
      borderRadius: 10,
      marginBottom: 9,
    },

    studentName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },

    studentRoll: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 5,
    },

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: colors.background,
    },

    message: {
      color: colors.textSecondary,
      textAlign: "center",
      fontSize: 15,
    },

    error: {
      color: colors.absent,
      textAlign: "center",
      fontSize: 15,
    },
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.message, { marginTop: 12 }]}>
          Loading your classes...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadClasses();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.heading}>My Classes</Text>

        <Text style={styles.subtitle}>
          Classes and subjects assigned to you
        </Text>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : classes.length === 0 ? (
          <Text style={styles.message}>
            No classes have been assigned to you yet.
          </Text>
        ) : (
          classes.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.className}>
                {item.name}
                {item.section ? ` - ${item.section}` : ""}
              </Text>

              {item.subjects.map((subject) => (
                <Text key={subject.id} style={styles.subject}>
                  {subject.name}
                </Text>
              ))}

              {item.semester !== null && (
                <Text style={styles.semester}>
                  Semester {item.semester}
                </Text>
              )}

              <Pressable
                style={styles.viewButton}
                onPress={() => toggleClass(item.id)}
              >
                <Text style={styles.viewButtonText}>
                  {expandedClassId === item.id
                    ? "Hide Students"
                    : "View Class"}
                </Text>
              </Pressable>

              {expandedClassId === item.id && (
                <View style={styles.studentSection}>
                  <Text style={styles.studentHeading}>
                    Enrolled Students
                  </Text>

                  {studentsLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                    />
                  ) : studentsError ? (
                    <Text style={styles.error}>
                      {studentsError}
                    </Text>
                  ) : students.length === 0 ? (
                    <Text style={styles.message}>
                      No students are enrolled in this class.
                    </Text>
                  ) : (
                    students.map((student) => (
                      <View
                        key={student.id}
                        style={styles.studentCard}
                      >
                        <Text style={styles.studentName}>
                          {student.full_name || "Name unavailable"}
                        </Text>

                        {student.roll_number && (
                          <Text style={styles.studentRoll}>
                            Roll No: {student.roll_number}
                          </Text>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
