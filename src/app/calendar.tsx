import { useAttendance } from "@/context/AttendanceContext";
import { useSubjects } from "@/context/SubjectContext";
import { useTheme } from "@/context/ThemeContext";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

export default function CalendarScreen() {
  const { subjects } = useSubjects();
  const { attendance, markAttendance, resetAttendance } = useAttendance();
  const { colors } = useTheme();

  const [selectedDate, setSelectedDate] = useState("");

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      {/* Title */}
      <Text
        style={[
          styles.title,
          { color: colors.text },
        ]}
      >
        Calendar
      </Text>

      {/* Subtitle */}
      <Text
        style={[
          styles.subtitle,
          { color: colors.textSecondary },
        ]}
      >
        Select a date to mark your attendance
      </Text>

      {/* Calendar */}
      <Calendar
        onDayPress={(day) => {
          if (selectedDate === day.dateString) {
            setSelectedDate("");
          } else {
            setSelectedDate(day.dateString);
          }
        }}
        markedDates={{
          [selectedDate]: {
            selected: true,
            selectedColor: colors.primary,
          },
        }}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.card,

          textSectionTitleColor: colors.textSecondary,

          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: "#FFFFFF",

          todayTextColor: colors.today,

          dayTextColor: colors.text,
          textDisabledColor: colors.textSecondary,

          monthTextColor: colors.text,

          arrowColor: colors.text,

          textDayFontWeight: "500",
          textMonthFontWeight: "bold",
          textDayHeaderFontWeight: "500",
        }}
        style={styles.calendar}
      />

      {/* Temporary Reset Button */}
      <Pressable
        onPress={resetAttendance}
        style={styles.resetButton}
      >
        <Text style={styles.resetButtonText}>
          Reset Attendance
        </Text>
      </Pressable>

      {/* Attendance Section */}
      {selectedDate !== "" && (
        <ScrollView style={styles.attendanceContainer}>
          <Text
            style={[
              styles.attendanceTitle,
              { color: colors.text },
            ]}
          >
            Mark Attendance
          </Text>

          <Text
            style={[
              styles.selectedDate,
              { color: colors.textSecondary },
            ]}
          >
            {selectedDate}
          </Text>

          {/* Subjects */}
          {subjects.map((subject) => (
            <View
              style={[
                styles.subjectCard,
                { backgroundColor: colors.card },
              ]}
              key={subject.name}
            >
              <Text
                style={[
                  styles.subjectName,
                  { color: colors.text },
                ]}
              >
                {subject.name}
              </Text>

              {/* THEORY */}
              <Text
                style={[
                  styles.typeTitle,
                  { color: colors.textSecondary },
                ]}
              >
                📖 Theory
              </Text>

              {/* Theory Row 1 */}
              <View style={styles.buttonRow}>
                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.present,
                    },
                    attendance[selectedDate]?.[subject.name]
                      ?.theory === "present" &&
                      styles.selectedStatus,
                  ]}
                  onPress={() =>
                    markAttendance(
                      selectedDate,
                      subject.name,
                      "theory",
                      "present"
                    )
                  }
                >
                  <Text style={styles.buttonText}>
                    Present
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.absent,
                    },
                    attendance[selectedDate]?.[subject.name]
                      ?.theory === "absent" &&
                      styles.selectedStatus,
                  ]}
                  onPress={() =>
                    markAttendance(
                      selectedDate,
                      subject.name,
                      "theory",
                      "absent"
                    )
                  }
                >
                  <Text style={styles.buttonText}>
                    Absent
                  </Text>
                </Pressable>
              </View>

              {/* Theory Row 2 */}
              <View style={styles.buttonRow}>
                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.leftEarly,
                    },
                    attendance[selectedDate]?.[subject.name]
                      ?.theory === "leftEarly" &&
                      styles.selectedStatus,
                  ]}
                  onPress={() =>
                    markAttendance(
                      selectedDate,
                      subject.name,
                      "theory",
                      "leftEarly"
                    )
                  }
                >
                  <Text style={styles.buttonText}>
                    Left Early
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.club,
                    },
                    attendance[selectedDate]?.[subject.name]
                      ?.theory === "club" &&
                      styles.selectedStatus,
                  ]}
                  onPress={() =>
                    markAttendance(
                      selectedDate,
                      subject.name,
                      "theory",
                      "club"
                    )
                  }
                >
                  <Text style={styles.buttonText}>
                    Club/Seminar
                  </Text>
                </Pressable>
              </View>

              {/* Theory Row 3 */}
              <View style={styles.buttonRow}>
                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.partial,
                    },
                    attendance[selectedDate]?.[subject.name]
                      ?.theory === "partial" &&
                      styles.selectedStatus,
                  ]}
                  onPress={() =>
                    markAttendance(
                      selectedDate,
                      subject.name,
                      "theory",
                      "partial"
                    )
                  }
                >
                  <Text style={styles.buttonText}>
                    Partial
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor: colors.noClass,
                    },
                    attendance[selectedDate]?.[subject.name]
                      ?.theory === "noClass" &&
                      styles.selectedStatus,
                  ]}
                  onPress={() =>
                    markAttendance(
                      selectedDate,
                      subject.name,
                      "theory",
                      "noClass"
                    )
                  }
                >
                  <Text style={styles.buttonText}>
                    No Class
                  </Text>
                </Pressable>
              </View>

              {/* LAB */}
              {subject.hasLab && (
                <>
                  <Text
                    style={[
                      styles.typeTitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    💻 Lab
                  </Text>

                  {/* Lab Row 1 */}
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor:
                            colors.labPresent,
                        },
                        attendance[selectedDate]?.[
                          subject.name
                        ]?.lab === "present" &&
                          styles.selectedStatus,
                      ]}
                      onPress={() =>
                        markAttendance(
                          selectedDate,
                          subject.name,
                          "lab",
                          "present"
                        )
                      }
                    >
                      <Text style={styles.buttonText}>
                        Present
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor:
                            colors.labAbsent,
                        },
                        attendance[selectedDate]?.[
                          subject.name
                        ]?.lab === "absent" &&
                          styles.selectedStatus,
                      ]}
                      onPress={() =>
                        markAttendance(
                          selectedDate,
                          subject.name,
                          "lab",
                          "absent"
                        )
                      }
                    >
                      <Text style={styles.buttonText}>
                        Absent
                      </Text>
                    </Pressable>
                  </View>

                  {/* Lab Row 2 */}
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor:
                            colors.partial,
                        },
                        attendance[selectedDate]?.[
                          subject.name
                        ]?.lab === "partial" &&
                          styles.selectedStatus,
                      ]}
                      onPress={() =>
                        markAttendance(
                          selectedDate,
                          subject.name,
                          "lab",
                          "partial"
                        )
                      }
                    >
                      <Text style={styles.buttonText}>
                        Partial
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.statusButton,
                        {
                          backgroundColor:
                            colors.noLab,
                        },
                        attendance[selectedDate]?.[
                          subject.name
                        ]?.lab === "noLab" &&
                          styles.selectedStatus,
                      ]}
                      onPress={() =>
                        markAttendance(
                          selectedDate,
                          subject.name,
                          "lab",
                          "noLab"
                        )
                      }
                    >
                      <Text style={styles.buttonText}>
                        No Lab
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 80,
  },

  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
  },

  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 30,
  },

  calendar: {
    borderRadius: 15,
    overflow: "hidden",
  },

  attendanceContainer: {
    flex: 1,
    marginTop: 25,
  },

  attendanceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },

  selectedDate: {
    fontSize: 16,
    marginBottom: 20,
  },

  subjectCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },

  subjectName: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  statusButton: {
    flex: 1,
    margin: 9,
    padding: 7.5,
    borderRadius: 50,
    alignItems: "center",
  },

  selectedStatus: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  typeTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 10,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },

  resetButton: {
    backgroundColor: "#EF4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    margin: 10,
  },

  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
});