
import { useAttendance } from "@/context/AttendanceContext";
import { useSubjects } from "@/context/SubjectContext";
import { useTheme } from "@/context/ThemeContext";
import { calculateAttendance } from "@/utils/attendanceCalculator";

import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { subjects } = useSubjects();
  const { attendance } = useAttendance();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Only one subject can be expanded at a time.
  const [expandedSubjectId, setExpandedSubjectId] =
    useState<string | null>(null);

  // Attendance colour based on percentage.
  const getAttendanceColor = (percentage: number) => {
    if (percentage > 75) {
      return colors.present;
    }

    if (percentage >= 50) {
      return colors.leftEarly;
    }

    return colors.absent;
  };

  // Progress bar component.
  const renderProgress = (
    percentage: number,
    color: string
  ) => {
    const safePercentage = Math.max(
      0,
      Math.min(100, percentage)
    );

    return (
      <View
        style={[
          styles.progressBackground,
          { backgroundColor: colors.background },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${safePercentage}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    );
  };

  // Calculate attendance for every subject.
  const subjectData = useMemo(() => {
    return subjects.map((subject) => {
      const theory = calculateAttendance(
        attendance,
        subject.name,
        "theory"
      );

      const lab = subject.hasLab
        ? calculateAttendance(
            attendance,
            subject.name,
            "lab"
          )
        : null;

      const totalAttended =
        theory.attendedClasses +
        (lab?.attendedClasses ?? 0);

      const totalClasses =
        theory.totalClasses +
        (lab?.totalClasses ?? 0);

      const overallPercentage =
        totalClasses === 0
          ? 0
          : (totalAttended / totalClasses) * 100;

      return {
        ...subject,
        theory,
        lab,
        totalAttended,
        totalClasses,
        overallPercentage,
      };
    });
  }, [subjects, attendance]);

  // Toggle expandable subject card.
  const toggleSubject = (subjectId: string) => {
    setExpandedSubjectId((current) =>
      current === subjectId ? null : subjectId
    );
  };

  // Render individual attendance section.
  const renderAttendanceSection = (
    title: string,
    emoji: string,
    percentage: number,
    attended: number,
    total: number
  ) => {
    const color = getAttendanceColor(percentage);

    return (
      <View style={styles.attendanceSection}>
        <View style={styles.attendanceHeading}>
          <View style={styles.attendanceType}>
            <Text style={styles.attendanceEmoji}>
              {emoji}
            </Text>

            <Text
              style={[
                styles.attendanceTitle,
                { color: colors.text },
              ]}
            >
              {title}
            </Text>
          </View>

          <Text
            style={[
              styles.attendancePercentage,
              { color },
            ]}
          >
            {percentage.toFixed(1)}%
          </Text>
        </View>

        {renderProgress(percentage, color)}

        <Text
          style={[
            styles.attendanceClasses,
            { color: colors.textSecondary },
          ]}
        >
          {attended} of {total} classes attended
        </Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 20,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.textSecondary },
            ]}
          >
            YOUR ACADEMIC SPACE
          </Text>

          <Text
            style={[
              styles.title,
              { color: colors.text },
            ]}
          >
            My Subjects
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: colors.textSecondary },
            ]}
          >
            Your classes, your progress.
          </Text>
        </View>

        <View
          style={[
            styles.headerIcon,
            { backgroundColor: `${colors.primary}18` },
          ]}
        >
          <Text style={styles.headerEmoji}>📚</Text>
        </View>
      </View>

      {/* SUBJECT SECTION HEADING */}
      <View style={styles.sectionHeader}>
        <View>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text },
            ]}
          >
            Your Subjects
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Tap a subject to view its attendance.
          </Text>
        </View>

        <View
          style={[
            styles.subjectCountBadge,
            { backgroundColor: `${colors.primary}18` },
          ]}
        >
          <Text
            style={[
              styles.subjectCountText,
              { color: colors.primary },
            ]}
          >
            {subjects.length}
          </Text>
        </View>
      </View>

      {/* EMPTY STATE */}
      {subjectData.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: `${colors.primary}18` },
            ]}
          >
            <Text style={styles.emptyEmoji}>📖</Text>
          </View>

          <Text
            style={[
              styles.emptyTitle,
              { color: colors.text },
            ]}
          >
            No subjects assigned yet
          </Text>

          <Text
            style={[
              styles.emptyDescription,
              { color: colors.textSecondary },
            ]}
          >
            Your administrator will assign your subjects.
            Once assigned, they will appear here.
          </Text>
        </View>
      ) : (
        subjectData.map((subject, index) => {
          const isExpanded =
            expandedSubjectId === subject.id;

          const overallColor = getAttendanceColor(
            subject.overallPercentage
          );

          const subjectStatus =
            subject.totalClasses === 0
              ? "No attendance recorded"
              : subject.overallPercentage > 75
                ? "Good standing"
                : subject.overallPercentage >= 50
                  ? "Needs improvement"
                  : "Attendance is low";

          return (
            <View
              key={subject.id}
              style={[
                styles.subjectCard,
                { backgroundColor: colors.card },
              ]}
            >
              {/* COLLAPSED HEADER */}
              <Pressable
                onPress={() => toggleSubject(subject.id)}
                style={({ pressed }) => [
                  styles.subjectHeader,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.subjectIcon,
                    { backgroundColor: `${colors.primary}18` },
                  ]}
                >
                  <Text style={styles.subjectEmoji}>
                    {index % 2 === 0 ? "📘" : "📗"}
                  </Text>
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
                      styles.subjectType,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {subject.hasLab
                      ? "Theory + Lab"
                      : "Theory only"}
                  </Text>

                  <Text
                    style={[
                      styles.subjectClasses,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {subject.totalAttended}/
                    {subject.totalClasses} classes attended
                  </Text>
                </View>

                <View style={styles.headerActions}>
                  <View
                    style={[
                      styles.subjectPercentageBadge,
                      { backgroundColor: `${overallColor}18` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectPercentage,
                        { color: overallColor },
                      ]}
                    >
                      {subject.overallPercentage.toFixed(1)}%
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.expandIcon,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {isExpanded ? "⌃" : "⌄"}
                  </Text>
                </View>
              </Pressable>

              {/* EXPANDABLE CONTENT */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View
                    style={[
                      styles.subjectDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />

                  {/* SUBJECT OVERALL PROGRESS */}
                  <View style={styles.overallSection}>
                    <View style={styles.progressHeading}>
                      <Text
                        style={[
                          styles.progressLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Overall progress
                      </Text>

                      <Text
                        style={[
                          styles.progressClasses,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {subject.totalAttended}/
                        {subject.totalClasses} classes
                      </Text>
                    </View>

                    {renderProgress(
                      subject.overallPercentage,
                      overallColor
                    )}
                  </View>

                  <View
                    style={[
                      styles.subjectDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />

                  {/* THEORY */}
                  {renderAttendanceSection(
                    "Theory",
                    "📖",
                    subject.theory.percentage,
                    subject.theory.attendedClasses,
                    subject.theory.totalClasses
                  )}

                  {/* LAB - ONLY IF SUBJECT HAS LAB */}
                  {subject.hasLab && subject.lab && (
                    <>
                      <View
                        style={[
                          styles.sectionDivider,
                          { backgroundColor: colors.border },
                        ]}
                      />

                      {renderAttendanceSection(
                        "Lab",
                        "💻",
                        subject.lab.percentage,
                        subject.lab.attendedClasses,
                        subject.lab.totalClasses
                      )}
                    </>
                  )}

                  {/* SUBJECT STATUS */}
                  <View
                    style={[
                      styles.statusFooter,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: overallColor },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {subjectStatus}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* FOOTER NOTE */}
      {subjects.length > 0 && (
        <View style={styles.footerNote}>
          <Text style={styles.footerEmoji}>💡</Text>

          <Text
            style={[
              styles.footerText,
              { color: colors.textSecondary },
            ]}
          >
            Try to maintain at least 75% attendance in
            every subject.
          </Text>
        </View>
      )}

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingBottom: 25,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },

  headerTextContainer: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 7,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  subtitle: {
    fontSize: 13,
    marginTop: 6,
  },

  headerIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  headerEmoji: {
    fontSize: 26,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
  },

  sectionSubtitle: {
    fontSize: 12,
    marginTop: 5,
  },

  subjectCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
  },

  subjectCountText: {
    fontSize: 14,
    fontWeight: "800",
  },

  subjectCard: {
    borderRadius: 21,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
  },

  subjectHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  subjectEmoji: {
    fontSize: 22,
  },

  subjectInfo: {
    flex: 1,
    minWidth: 0,
  },

  subjectName: {
    fontSize: 15,
    fontWeight: "800",
  },

  subjectType: {
    fontSize: 11,
    marginTop: 4,
  },

  subjectClasses: {
    fontSize: 10,
    marginTop: 4,
  },

  headerActions: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
    gap: 5,
  },

  subjectPercentageBadge: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: 12,
  },

  subjectPercentage: {
    fontSize: 12,
    fontWeight: "800",
  },

  expandIcon: {
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 23,
  },

  expandedContent: {
    marginTop: 2,
  },

  subjectDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 17,
  },

  overallSection: {
    marginBottom: 2,
  },

  progressHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  progressLabel: {
    fontSize: 11,
    fontWeight: "700",
  },

  progressClasses: {
    fontSize: 10,
  },

  progressBackground: {
    width: "100%",
    height: 8,
    borderRadius: 10,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
  },

  attendanceSection: {
    paddingVertical: 2,
  },

  attendanceHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
  },

  attendanceType: {
    flexDirection: "row",
    alignItems: "center",
  },

  attendanceEmoji: {
    fontSize: 17,
    marginRight: 9,
  },

  attendanceTitle: {
    fontSize: 15,
    fontWeight: "700",
  },

  attendancePercentage: {
    fontSize: 16,
    fontWeight: "800",
  },

  attendanceClasses: {
    fontSize: 11,
    marginTop: 9,
  },

  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 18,
  },

  statusFooter: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginTop: 19,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 9,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },

  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 30,
    alignItems: "center",
    marginTop: 5,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },

  emptyEmoji: {
    fontSize: 30,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },

  emptyDescription: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    marginTop: 9,
  },

  footerEmoji: {
    fontSize: 17,
    marginRight: 9,
  },

  footerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
  },

  bottomSpace: {
    height: 25,
  },
});
