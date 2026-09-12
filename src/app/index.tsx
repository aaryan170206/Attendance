import { useAttendance } from "@/context/AttendanceContext";
import { useSubjects } from "@/context/SubjectContext";
import { useTheme } from "@/context/ThemeContext";
import { calculateAttendance } from "@/utils/attendanceCalculator";

import { useState } from "react";

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function HomeScreen() {
  const {
    subjects,
    addSubject,
    deleteSubject,
  } = useSubjects();

  const {
    attendance,
    removeSubjectAttendance,
  } = useAttendance();

  const { colors } = useTheme();

  const [subjectName, setSubjectName] =
    useState("");

  const [hasLab, setHasLab] =
    useState(false);

  const handleAddSubject = () => {
    if (subjectName.trim() !== "") {
      addSubject(
        subjectName.trim(),
        hasLab
      );

      setSubjectName("");
      setHasLab(false);
    }
  };

  const handleDeleteSubject = (
    name: string
  ) => {
    Alert.alert(
      "Delete Subject",
      `Are you sure you want to delete ${name}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",

          onPress: async () => {
            // Delete the subject itself
            deleteSubject(name);

            // Delete all attendance belonging
            // to that subject
            await removeSubjectAttendance(name);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}

      <Text
        style={[
          styles.title,
          {
            color: colors.text,
          },
        ]}
      >
        Subjects
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Manage your subjects and attendance
      </Text>

      {/* ADD SUBJECT CARD */}

      <View
        style={[
          styles.addCard,
          {
            backgroundColor:
              colors.card,
            borderColor:
              colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            {
              color: colors.text,
            },
          ]}
        >
          Add Subject
        </Text>

        <TextInput
          value={subjectName}
          onChangeText={setSubjectName}
          placeholder="Enter subject name"
          placeholderTextColor={
            colors.textSecondary
          }
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor:
                colors.cardSecondary,
              borderColor:
                colors.border,
            },
          ]}
        />

        {/* LAB TOGGLE */}

        <Pressable
          onPress={() =>
            setHasLab(!hasLab)
          }
          style={[
            styles.labToggle,
            {
              backgroundColor: hasLab
                ? colors.labPresent
                : colors.cardSecondary,
              borderColor:
                colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor:
                  hasLab
                    ? colors.labPresent
                    : colors.textSecondary,
                backgroundColor:
                  hasLab
                    ? colors.labPresent
                    : "transparent",
              },
            ]}
          >
            {hasLab && (
              <Text
                style={
                  styles.checkmark
                }
              >
                ✓
              </Text>
            )}
          </View>

          <Text
            style={[
              styles.labToggleText,
              {
                color: hasLab
                  ? "#FFFFFF"
                  : colors.text,
              },
            ]}
          >
            This subject has a lab
          </Text>
        </Pressable>

        {/* ADD BUTTON */}

        <Pressable
          onPress={handleAddSubject}
          style={[
            styles.addButton,
            {
              backgroundColor:
                colors.primary,
            },
          ]}
        >
          <Text
            style={styles.addButtonText}
          >
            Add Subject
          </Text>
        </Pressable>
      </View>

      {/* SUBJECT LIST */}

      <Text
        style={[
          styles.sectionTitle,
          {
            color: colors.text,
          },
        ]}
      >
        Your Subjects
      </Text>

      {subjects.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor:
                colors.card,
              borderColor:
                colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.emptyText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            No subjects added yet.
          </Text>
        </View>
      ) : (
        subjects.map((subject) => {
          const theoryStats =
            calculateAttendance(
              attendance,
              subject.name,
              "theory"
            );

          const labStats =
            subject.hasLab
              ? calculateAttendance(
                  attendance,
                  subject.name,
                  "lab"
                )
              : null;

          return (
            <View
              key={subject.name}
              style={[
                styles.subjectCard,
                {
                  backgroundColor:
                    colors.card,
                  borderColor:
                    colors.border,
                },
              ]}
            >
              {/* SUBJECT HEADER */}

              <View
                style={
                  styles.subjectHeader
                }
              >
                <View
                  style={
                    styles.subjectInfo
                  }
                >
                  <Text
                    style={[
                      styles.subjectName,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {subject.name}
                  </Text>

                  <Text
                    style={[
                      styles.subjectType,
                      {
                        color:
                          colors.textSecondary,
                      },
                    ]}
                  >
                    {subject.hasLab
                      ? "Theory + Lab"
                      : "Theory only"}
                  </Text>
                </View>

                {/* DELETE */}

                <Pressable
                  onPress={() =>
                    handleDeleteSubject(
                      subject.name
                    )
                  }
                  style={[
                    styles.deleteButton,
                    {
                      backgroundColor:
                        colors.cardSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deleteText,
                      {
                        color:
                          colors.absent,
                      },
                    ]}
                  >
                    Delete
                  </Text>
                </Pressable>
              </View>

              {/* THEORY */}

              <View
                style={
                  styles.attendanceRow
                }
              >
                <Text
                  style={[
                    styles.attendanceLabel,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  Theory
                </Text>

                <Text
                  style={[
                    styles.attendancePercentage,
                    {
                      color:
                        theoryStats
                          .percentage >
                        75
                          ? colors.present
                          : theoryStats
                              .percentage >=
                            50
                          ? colors.leftEarly
                          : colors.absent,
                    },
                  ]}
                >
                  {theoryStats.percentage.toFixed(
                    1
                  )}
                  %
                </Text>
              </View>

              <Text
                style={[
                  styles.attendanceClasses,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                {theoryStats.attendedClasses}{" "}
                /{" "}
                {theoryStats.totalClasses}{" "}
                classes
              </Text>

              {/* LAB */}

              {subject.hasLab &&
                labStats && (
                  <View
                    style={
                      styles.labSection
                    }
                  >
                    <View
                      style={
                        styles.attendanceRow
                      }
                    >
                      <Text
                        style={[
                          styles.attendanceLabel,
                          {
                            color:
                              colors.textSecondary,
                          },
                        ]}
                      >
                        Lab
                      </Text>

                      <Text
                        style={[
                          styles.attendancePercentage,
                          {
                            color:
                              labStats
                                .percentage >
                              75
                                ? colors.present
                                : labStats
                                    .percentage >=
                                  50
                                ? colors.leftEarly
                                : colors.absent,
                          },
                        ]}
                      >
                        {labStats.percentage.toFixed(
                          1
                        )}
                        %
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.attendanceClasses,
                        {
                          color:
                            colors.textSecondary,
                        },
                      ]}
                    >
                      {
                        labStats.attendedClasses
                      }{" "}
                      /{" "}
                      {
                        labStats.totalClasses
                      }{" "}
                      classes
                    </Text>
                  </View>
                )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    marginTop: 10,
  },

  subtitle: {
    fontSize: 15,
    marginTop: 4,
    marginBottom: 20,
  },

  addCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 24,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },

  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },

  labToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  labToggleText: {
    fontSize: 14,
    fontWeight: "500",
  },

  addButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 10,
  },

  subjectCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 12,
  },

  subjectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  subjectInfo: {
    flex: 1,
    paddingRight: 10,
  },

  subjectName: {
    fontSize: 17,
    fontWeight: "600",
  },

  subjectType: {
    fontSize: 12,
    marginTop: 4,
  },

  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  deleteText: {
    fontSize: 12,
    fontWeight: "600",
  },

  attendanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },

  attendanceLabel: {
    fontSize: 14,
    fontWeight: "500",
  },

  attendancePercentage: {
    fontSize: 18,
    fontWeight: "700",
  },

  attendanceClasses: {
    fontSize: 12,
    marginTop: 3,
  },

  labSection: {
    marginTop: 4,
  },

  emptyCard: {
    borderRadius: 18,
    padding: 25,
    borderWidth: 1,
  },

  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
});