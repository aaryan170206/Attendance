
import { useAttendance } from "@/context/AttendanceContext";
import { useSubjects } from "@/context/SubjectContext";
import { useTheme } from "@/context/ThemeContext";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";

// Attendance types
type AttendanceType = "theory" | "lab";

type CalendarAttendanceStatus =
  | "present"
  | "absent"
  | "leftEarly"
  | "club"
  | "partial"
  | "noClass"
  | "noLab";

type StatusOption = {
  label: string;
  value: CalendarAttendanceStatus;
  emoji: string;
  color: string;
};

// Attendance status options
const STATUS_OPTIONS: Record<AttendanceType, StatusOption[]> = {
  theory: [
    { label: "Present", value: "present", emoji: "✓", color: "present" },
    { label: "Absent", value: "absent", emoji: "✕", color: "absent" },
    { label: "Left Early", value: "leftEarly", emoji: "↗", color: "leftEarly" },
    { label: "Club", value: "club", emoji: "★", color: "club" },
    { label: "Partial", value: "partial", emoji: "½", color: "partial" },
    { label: "No Class", value: "noClass", emoji: "—", color: "noClass" },
  ],
  lab: [
    { label: "Present", value: "present", emoji: "✓", color: "labPresent" },
    { label: "Absent", value: "absent", emoji: "✕", color: "labAbsent" },
    { label: "Partial", value: "partial", emoji: "½", color: "partial" },
    { label: "No Lab", value: "noLab", emoji: "—", color: "noLab" },
  ],
};

export default function CalendarScreen() {
  const { subjects } = useSubjects();
  const { attendance, markAttendance } = useAttendance();
  const { colors } = useTheme();

  const [selectedDate, setSelectedDate] = useState("");

  const selectedAttendance = attendance[selectedDate] ?? {};

  // Daily attendance summary
  const summary = useMemo(() => {
    let marked = 0;
    let present = 0;
    let absent = 0;

    subjects.forEach((subject) => {
      const record = selectedAttendance[subject.name];

      if (record?.theory) {
        marked++;

        if (
          record.theory === "present" ||
          record.theory === "club"
        ) {
          present++;
        } else if (record.theory === "absent") {
          absent++;
        }
      }

      if (subject.hasLab && record?.lab) {
        marked++;

        if (record.lab === "present") {
          present++;
        } else if (record.lab === "absent") {
          absent++;
        }
      }
    });

    return { marked, present, absent };
  }, [subjects, selectedAttendance]);

  // Dates with attendance records
  const markedDates = useMemo(() => {
    const dates: Record<string, any> = {};

    Object.entries(attendance).forEach(([date, records]) => {
      const hasRecords = Object.values(records).some(
        (record) => record.theory || record.lab
      );

      if (hasRecords) {
        dates[date] = {
          marked: true,
          dotColor: colors.primary,
        };
      }
    });

    if (selectedDate) {
      dates[selectedDate] = {
        ...dates[selectedDate],
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: "#FFFFFF",
      };
    }

    return dates;
  }, [attendance, selectedDate, colors.primary]);

  // Get status color
  const getStatusColor = (colorKey: string) => {
    return colors[colorKey as keyof typeof colors] as string;
  };

  // Mark attendance
  const handleStatus = (
    subjectName: string,
    type: AttendanceType,
    status: CalendarAttendanceStatus
  ) => {
    markAttendance(selectedDate, subjectName, type, status);
  };

  // Format selected date
  const formatDate = (date: string) => {
    if (!date) return "";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Render attendance status buttons
  const renderStatusSection = (
    subjectName: string,
    type: AttendanceType
  ) => {
    const currentStatus = selectedAttendance[subjectName]?.[type];
    const options = STATUS_OPTIONS[type];

    return (
      <View style={styles.statusSection}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionEmoji}>
            {type === "theory" ? "📖" : "💻"}
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {type === "theory" ? "Theory Class" : "Lab Session"}
          </Text>

          {currentStatus && (
            <View
              style={[
                styles.markedBadge,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <Text
                style={[
                  styles.markedBadgeText,
                  { color: colors.primary },
                ]}
              >
                Marked
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statusGrid}>
          {options.map((option) => {
            const isSelected = currentStatus === option.value;
            const statusColor = getStatusColor(option.color);

            return (
              <Pressable
                key={`${type}-${option.value}`}
                onPress={() =>
                  handleStatus(subjectName, type, option.value)
                }
                style={({ pressed }) => [
                  styles.statusChip,
                  {
                    backgroundColor: isSelected
                      ? statusColor
                      : colors.background,
                    borderColor: isSelected
                      ? statusColor
                      : colors.textSecondary,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusEmoji,
                    {
                      color: isSelected ? "#FFFFFF" : statusColor,
                    },
                  ]}
                >
                  {option.emoji}
                </Text>

                <Text
                  style={[
                    styles.statusLabel,
                    {
                      color: isSelected ? "#FFFFFF" : colors.text,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text
              style={[
                styles.greeting,
                { color: colors.textSecondary },
              ]}
            >
              YOUR ACADEMIC TRACKER
            </Text>

            <Text style={[styles.title, { color: colors.text }]}>
              Attendance
            </Text>

            <Text
              style={[
                styles.subtitle,
                { color: colors.textSecondary },
              ]}
            >
              Stay consistent. Stay on track.
            </Text>
          </View>

          <View
            style={[
              styles.headerIcon,
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Text style={styles.headerIconText}>📅</Text>
          </View>
        </View>

        {/* Daily Summary */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card },
          ]}
        >
          <View style={styles.summaryHeader}>
            <View>
              <Text
                style={[
                  styles.summaryHeading,
                  { color: colors.text },
                ]}
              >
                Daily overview
              </Text>

              <Text
                style={[
                  styles.summarySubheading,
                  { color: colors.textSecondary },
                ]}
              >
                {selectedDate
                  ? "Selected day's activity"
                  : "Select a date to begin"}
              </Text>
            </View>

            <Text style={styles.summaryIcon}>📊</Text>
          </View>

          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  { color: colors.primary },
                ]}
              >
                {selectedDate ? summary.marked : "—"}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Marked
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: colors.textSecondary },
              ]}
            />

            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  { color: colors.present },
                ]}
              >
                {selectedDate ? summary.present : "—"}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Present
              </Text>
            </View>

            <View
              style={[
                styles.statDivider,
                { backgroundColor: colors.textSecondary },
              ]}
            />

            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  { color: colors.absent },
                ]}
              >
                {selectedDate ? summary.absent : "—"}
              </Text>

              <Text
                style={[
                  styles.statLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Absent
              </Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View
          style={[
            styles.calendarCard,
            { backgroundColor: colors.card },
          ]}
        >
          <View style={styles.calendarHeading}>
            <View>
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.text },
                ]}
              >
                Your calendar
              </Text>

              <Text
                style={[
                  styles.cardSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Tap a date to mark attendance
              </Text>
            </View>

            <View
              style={[
                styles.todayBadge,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <Text
                style={[
                  styles.todayBadgeText,
                  { color: colors.primary },
                ]}
              >
                TODAY
              </Text>
            </View>
          </View>

          
            <Calendar
              key={colors.background}
              onDayPress={(day) => {
                setSelectedDate((current) =>
                  current === day.dateString ? "" : day.dateString
                );
              }}
              markedDates={markedDates}
              theme={{
                backgroundColor: colors.background,
                calendarBackground: colors.card,

                textSectionTitleColor: colors.textSecondary,
                dayTextColor: colors.text,
                monthTextColor: colors.text,
                textDisabledColor: colors.textSecondary,

                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: "#FFFFFF",

                todayTextColor: "#EC4899",
                arrowColor: colors.primary,

                textDayFontWeight: "500",
                textMonthFontWeight: "bold",
                textDayHeaderFontWeight: "600",

                textDayFontSize: 14,
                textMonthFontSize: 17,
              }}
              style={[
                styles.calendar,
                { backgroundColor: colors.card },
              ]}
            />

          {/* Calendar Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: "#EC4899" },
                ]}
              />

              <Text
                style={[
                  styles.legendText,
                  { color: colors.textSecondary },
                ]}
              >
                Today
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: colors.primary },
                ]}
              />

              <Text
                style={[
                  styles.legendText,
                  { color: colors.textSecondary },
                ]}
              >
                Attendance marked
              </Text>
            </View>
          </View>
        </View>

        {/* Attendance Section */}
        {selectedDate ? (
          <View style={styles.attendanceSection}>
            <View style={styles.dateHeading}>
              <View>
                <Text
                  style={[
                    styles.dateEyebrow,
                    { color: colors.textSecondary },
                  ]}
                >
                  ATTENDANCE FOR
                </Text>

                <Text
                  style={[
                    styles.dateTitle,
                    { color: colors.text },
                  ]}
                >
                  {formatDate(selectedDate)}
                </Text>
              </View>

              <Pressable
                onPress={() => setSelectedDate("")}
                style={[
                  styles.closeButton,
                  { backgroundColor: colors.card },
                ]}
              >
                <Text
                  style={[
                    styles.closeButtonText,
                    { color: colors.text },
                  ]}
                >
                  ✕
                </Text>
              </Pressable>
            </View>

            {subjects.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: colors.card },
                ]}
              >
                <Text style={styles.emptyEmoji}>📚</Text>

                <Text
                  style={[
                    styles.emptyTitle,
                    { color: colors.text },
                  ]}
                >
                  No subjects assigned
                </Text>

                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Your subjects will appear here once your administrator assigns them.
                </Text>
              </View>
            ) : (
              subjects.map((subject) => (
                <View
                  key={subject.id}
                  style={[
                    styles.subjectCard,
                    { backgroundColor: colors.card },
                  ]}
                >
                  {/* Subject Header */}
                  <View style={styles.subjectHeader}>
                    <View
                      style={[
                        styles.subjectIcon,
                        { backgroundColor: `${colors.primary}18` },
                      ]}
                    >
                      <Text style={styles.subjectIconText}>📘</Text>
                    </View>

                    <View style={styles.subjectInfo}>
                      <Text
                        style={[
                          styles.subjectName,
                          { color: colors.text },
                        ]}
                      >
                        {subject.name}
                      </Text>

                      <Text
                        style={[
                          styles.subjectMeta,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {subject.hasLab ? "Theory + Lab" : "Theory"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.subjectCount,
                        { backgroundColor: colors.background },
                      ]}
                    >
                      <Text
                        style={[
                          styles.subjectCountText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {[
                          selectedAttendance[subject.name]?.theory,
                          subject.hasLab
                            ? selectedAttendance[subject.name]?.lab
                            : null,
                        ].filter(Boolean).length}
                        /{subject.hasLab ? 2 : 1}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.cardDivider,
                      { backgroundColor: colors.textSecondary },
                    ]}
                  />

                  {/* Theory */}
                  {renderStatusSection(subject.name, "theory")}

                  {/* Lab */}
                  {subject.hasLab && (
                    <>
                      <View
                        style={[
                          styles.sectionDivider,
                          { backgroundColor: colors.textSecondary },
                        ]}
                      />

                      {renderStatusSection(subject.name, "lab")}
                    </>
                  )}
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.promptContainer}>
            <Text style={styles.promptEmoji}>👆</Text>

            <Text
              style={[
                styles.promptTitle,
                { color: colors.text },
              ]}
            >
              Pick your class date
            </Text>

            <Text
              style={[
                styles.promptText,
                { color: colors.textSecondary },
              ]}
            >
              Select a date from the calendar above to view your subjects and mark attendance.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 65,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },

  greeting: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  subtitle: {
    fontSize: 14,
    marginTop: 5,
  },

  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  headerIconText: {
    fontSize: 25,
  },

  summaryCard: {
    borderRadius: 22,
    padding: 19,
    marginBottom: 20,
  },

  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  summaryHeading: {
    fontSize: 17,
    fontWeight: "700",
  },

  summarySubheading: {
    fontSize: 12,
    marginTop: 4,
  },

  summaryIcon: {
    fontSize: 23,
  },

  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  statItem: {
    flex: 1,
    alignItems: "center",
  },

  statNumber: {
    fontSize: 25,
    fontWeight: "800",
  },

  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },

  statDivider: {
    width: 1,
    height: 35,
    opacity: 0.25,
  },

  calendarCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 25,
  },

  calendarHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  cardSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },

  todayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  todayBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  calendar: {
    borderRadius: 14,
  },

  legend: {
    flexDirection: "row",
    gap: 20,
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#80808040",
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  legendText: {
    fontSize: 11,
  },

  attendanceSection: {
    marginTop: 2,
  },

  dateHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  dateEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    marginBottom: 5,
  },

  dateTitle: {
    fontSize: 19,
    fontWeight: "800",
  },

  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  closeButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },

  subjectCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
  },

  subjectHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  subjectIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  subjectIconText: {
    fontSize: 20,
  },

  subjectInfo: {
    flex: 1,
  },

  subjectName: {
    fontSize: 16,
    fontWeight: "700",
  },

  subjectMeta: {
    fontSize: 12,
    marginTop: 4,
  },

  subjectCount: {
    minWidth: 38,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },

  subjectCountText: {
    fontSize: 12,
    fontWeight: "700",
  },

  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
    opacity: 0.25,
  },

  statusSection: {
    marginTop: 2,
  },

  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionEmoji: {
    fontSize: 16,
    marginRight: 8,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },

  markedBadge: {
    marginLeft: "auto",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },

  markedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },

  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  statusChip: {
    width: "31%",
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },

  statusEmoji: {
    fontSize: 13,
    fontWeight: "800",
  },

  statusLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 17,
    opacity: 0.25,
  },

  emptyCard: {
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
  },

  emptyEmoji: {
    fontSize: 34,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 7,
  },

  promptContainer: {
    alignItems: "center",
    paddingHorizontal: 25,
    paddingVertical: 18,
  },

  promptEmoji: {
    fontSize: 27,
    marginBottom: 10,
  },

  promptTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  promptText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },

  bottomSpace: {
    height: 35,
  },
});
