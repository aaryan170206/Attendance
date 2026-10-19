
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { Layout, Spacing } from "@/constants/spacing";
import { useAttendance } from "@/context/AttendanceContext";
import { useSubjects } from "@/context/SubjectContext";
import { useTheme } from "@/context/ThemeContext";
import {
  calculateAttendance,
  calculateAttendanceTrend,
  calculateClubClasses,
  calculateOverallAttendance,
  calculateOverallLabAttendance,
  calculateOverallTheoryAttendance,
} from "@/utils/attendanceCalculator";

export default function DashboardScreen() {
  const { attendance } = useAttendance();
  const { subjects } = useSubjects();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [expandedSubject, setExpandedSubject] =
    useState<string | null>(null);

  // --------------------------------------------------
  // ATTENDANCE STATISTICS
  // --------------------------------------------------

  const overallStats = calculateOverallAttendance(attendance);
  const theoryStats = calculateOverallTheoryAttendance(attendance);
  const labStats = calculateOverallLabAttendance(attendance);
  const clubClasses = calculateClubClasses(attendance);
  const trend = calculateAttendanceTrend(attendance);

  // --------------------------------------------------
  // ATTENDANCE COLOURS
  // --------------------------------------------------

  const getAttendanceColor = (percentage: number) => {
    if (percentage > 90) return "#06B6D4";
    if (percentage >= 75) return "#22C55E";
    if (percentage >= 65) return "#F97316";
    if (percentage >= 50) return "#EAB308";
    return "#EF4444";
  };

  // --------------------------------------------------
  // ATTENDANCE GUIDANCE
  // --------------------------------------------------

  const getClassesNeededFor75 = (
    attended: number,
    total: number
  ) => {
    if (total === 0 || attended / total >= 0.75) {
      return 0;
    }

    let classesNeeded = 0;

    while (
      (attended + classesNeeded) /
        (total + classesNeeded) <
      0.75
    ) {
      classesNeeded++;
    }

    return classesNeeded;
  };

  const getClassesCanMiss = (
    attended: number,
    total: number
  ) => {
    if (total === 0) return 0;

    let classesCanMiss = 0;

    while (
      attended / (total + classesCanMiss + 1) >=
      0.75
    ) {
      classesCanMiss++;
    }

    return classesCanMiss;
  };

  // --------------------------------------------------
  // TREND GRAPH
  // --------------------------------------------------

  const chartWidth = 320;
  const chartHeight = 220;

  const graphLeft = 40;
  const graphRight = 300;
  const graphTop = 20;
  const graphBottom = 195;

  const graphWidth = graphRight - graphLeft;
  const graphHeight = graphBottom - graphTop;

  const getX = (index: number) => {
    if (trend.length === 1) {
      return graphLeft + graphWidth / 2;
    }

    return (
      graphLeft +
      (index / (trend.length - 1)) * graphWidth
    );
  };

  const getY = (percentage: number) => {
    const safePercentage = Math.max(
      0,
      Math.min(100, percentage)
    );

    return (
      graphBottom -
      (safePercentage / 100) * graphHeight
    );
  };

  // --------------------------------------------------
  // SUBJECT DATA
  // --------------------------------------------------

  const subjectData = subjects.map((subject) => {
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

    const percentage =
      totalClasses === 0
        ? 0
        : (totalAttended / totalClasses) * 100;

    return {
      ...subject,
      theory,
      lab,
      totalAttended,
      totalClasses,
      percentage,
    };
  });

  // --------------------------------------------------
  // REUSABLE PROGRESS BAR
  // --------------------------------------------------

  const renderProgressBar = (
    percentage: number,
    height = 8
  ) => {
    const safePercentage = Math.max(
      0,
      Math.min(100, percentage)
    );

    const progressColor = getAttendanceColor(percentage);

    return (
      <View
        style={[
          styles.progressBackground,
          {
            height,
            backgroundColor: colors.cardSecondary,
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${safePercentage}%`,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>
    );
  };

  // --------------------------------------------------
  // STAT CARD
  // --------------------------------------------------

  const renderStatCard = (
    label: string,
    value: string,
    description: string,
    accent: string,
    emoji: string
  ) => (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.statIcon,
          { backgroundColor: `${accent}18` },
        ]}
      >
        <Text style={styles.statEmoji}>{emoji}</Text>
      </View>

      <Text
        style={[
          styles.statLabel,
          { color: colors.textSecondary },
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.statValue,
          { color: accent },
        ]}
      >
        {value}
      </Text>

      <Text
        style={[
          styles.statDescription,
          { color: colors.textSecondary },
        ]}
      >
        {description}
      </Text>
    </View>
  );

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Layout.screenVertical,
          paddingLeft: insets.left + Layout.screenHorizontal,
          paddingRight: insets.right + Layout.screenHorizontal,
          paddingBottom: Spacing.xxxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.textSecondary },
            ]}
          >
            YOUR ACADEMIC PROGRESS
          </Text>

          <Text
            style={[
              styles.title,
              { color: colors.text },
            ]}
          >
            Dashboard
          </Text>

          <Text
            style={[
              styles.subtitle,
              { color: colors.textSecondary },
            ]}
          >
            A clear picture of your attendance.
          </Text>
        </View>

        <View
          style={[
            styles.headerIcon,
            { backgroundColor: `${colors.primary}18` },
          ]}
        >
          <Text style={styles.headerEmoji}>📊</Text>
        </View>
      </View>

      {/* OVERALL ATTENDANCE */}

      <View
        style={[
          styles.overallCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.overallTopRow}>
          <View>
            <Text
              style={[
                styles.cardLabel,
                { color: colors.textSecondary },
              ]}
            >
              Overall Attendance
            </Text>

            <Text
              style={[
                styles.overallPercentage,
                {
                  color: getAttendanceColor(
                    overallStats.percentage
                  ),
                },
              ]}
            >
              {overallStats.percentage.toFixed(1)}%
            </Text>
          </View>

          <View
            style={[
              styles.overallIcon,
              {
                backgroundColor: `${getAttendanceColor(
                  overallStats.percentage
                )}18`,
              },
            ]}
          >
            <Text style={styles.overallEmoji}>🎯</Text>
          </View>
        </View>

        <Text
          style={[
            styles.cardSubText,
            { color: colors.textSecondary },
          ]}
        >
          {overallStats.attendedClasses} of{" "}
          {overallStats.totalClasses} classes attended
        </Text>

        {renderProgressBar(overallStats.percentage, 10)}

        <View style={styles.progressFooter}>
          <Text
            style={[
              styles.progressFooterText,
              { color: colors.textSecondary },
            ]}
          >
            Attendance progress
          </Text>

          <Text
            style={[
              styles.targetText,
              { color: "#22C55E" },
            ]}
          >
            Target: 75%
          </Text>
        </View>
      </View>

      {/* THEORY / LAB / CLUB */}

      <View style={styles.sectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text },
          ]}
        >
          Attendance Breakdown
        </Text>

        <Text
          style={[
            styles.sectionSubtitle,
            { color: colors.textSecondary },
          ]}
        >
          Your attendance by category
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {renderStatCard(
          "Theory",
          `${theoryStats.percentage.toFixed(1)}%`,
          `${theoryStats.attendedTheory}/${theoryStats.totalTheory} attended`,
          "#3B82F6",
          "📘"
        )}

        {renderStatCard(
          "Labs",
          `${labStats.percentage.toFixed(1)}%`,
          `${labStats.attendedLabs}/${labStats.totalLabs} attended`,
          "#A855F7",
          "🧪"
        )}

        {renderStatCard(
          "Club",
          `${clubClasses}`,
          "Classes recorded",
          "#0EA5E9",
          "🎓"
        )}
      </View>

      {/* ATTENDANCE TREND */}

      <View
        style={[
          styles.chartCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text },
              ]}
            >
              Attendance Trend
            </Text>

            <Text
              style={[
                styles.sectionSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              How your attendance changes over time
            </Text>
          </View>

          <Text style={styles.chartEmoji}>📈</Text>
        </View>

        {trend.length < 2 ? (
          <View style={styles.emptyTrend}>
            <Text style={styles.emptyTrendEmoji}>📉</Text>

            <Text
              style={[
                styles.emptyTitle,
                { color: colors.text },
              ]}
            >
              Not enough data yet
            </Text>

            <Text
              style={[
                styles.emptyText,
                { color: colors.textSecondary },
              ]}
            >
              Mark attendance on at least two different
              dates to see your progress.
            </Text>
          </View>
        ) : (
          <View style={styles.chartWrapper}>
            <Svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              {/* GRID LINES */}

              {[100, 75, 50, 25, 0].map((value) => (
                <Line
                  key={value}
                  x1={graphLeft}
                  y1={getY(value)}
                  x2={graphRight}
                  y2={getY(value)}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Y AXIS LABELS */}

              {[100, 75, 50, 25, 0].map((value) => (
                <SvgText
                  key={`label-${value}`}
                  x="4"
                  y={getY(value) + 4}
                  fill={colors.textSecondary}
                  fontSize="10"
                >
                  {value}%
                </SvgText>
              ))}

              {/* TREND LINE */}

              {trend.slice(1).map((item, index) => {
                const previous = trend[index];

                const segmentPercentage =
                  (previous.percentage + item.percentage) / 2;

                return (
                  <Line
                    key={`${previous.date}-${item.date}`}
                    x1={getX(index)}
                    y1={getY(previous.percentage)}
                    x2={getX(index + 1)}
                    y2={getY(item.percentage)}
                    stroke={getAttendanceColor(
                      segmentPercentage
                    )}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                );
              })}

              {/* DATA POINTS */}

              {trend.map((item, index) => (
                <Circle
                  key={item.date}
                  cx={getX(index)}
                  cy={getY(item.percentage)}
                  r="4"
                  fill={getAttendanceColor(item.percentage)}
                  stroke={colors.card}
                  strokeWidth="2"
                />
              ))}

              {/* DATE LABELS */}

              <SvgText
                x={getX(0)}
                y="216"
                fill={colors.textSecondary}
                fontSize="9"
                textAnchor="middle"
              >
                {trend[0].date.slice(5)}
              </SvgText>

              <SvgText
                x={getX(trend.length - 1)}
                y="216"
                fill={colors.textSecondary}
                fontSize="9"
                textAnchor="middle"
              >
                {trend[trend.length - 1].date.slice(5)}
              </SvgText>
            </Svg>
          </View>
        )}
      </View>

      {/* SUBJECT ATTENDANCE */}

      <View style={styles.subjectSectionHeader}>
        <View>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.text },
            ]}
          >
            Subject Attendance
          </Text>

          <Text
            style={[
              styles.sectionSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Tap a subject to view its breakdown
          </Text>
        </View>

        <View
          style={[
            styles.subjectCount,
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

      {subjectData.map((subject) => {
        const isExpanded =
          expandedSubject === subject.name;

        const classesNeededFor75 =
          getClassesNeededFor75(
            subject.totalAttended,
            subject.totalClasses
          );

        const classesCanMiss =
          getClassesCanMiss(
            subject.totalAttended,
            subject.totalClasses
          );

        const attendanceColor = getAttendanceColor(
          subject.percentage
        );

        return (
          <Pressable
            key={subject.id ?? subject.name}
            onPress={() =>
              setExpandedSubject(
                isExpanded ? null : subject.name
              )
            }
            style={({ pressed }) => [
              styles.subjectCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            {/* SUBJECT HEADER */}

            <View style={styles.subjectHeader}>
              <View style={styles.subjectTitleContainer}>
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
                    styles.subjectClasses,
                    { color: colors.textSecondary },
                  ]}
                >
                  {subject.totalAttended} /{" "}
                  {subject.totalClasses} classes attended
                </Text>
              </View>

              <View style={styles.subjectRight}>
                <Text
                  style={[
                    styles.subjectPercentage,
                    { color: attendanceColor },
                  ]}
                >
                  {subject.percentage.toFixed(1)}%
                </Text>

                <Text
                  style={[
                    styles.expandIcon,
                    { color: colors.textSecondary },
                  ]}
                >
                  {isExpanded ? "⌃" : "⌄"}
                </Text>
              </View>
            </View>

            {/* PROGRESS */}

            {renderProgressBar(subject.percentage, 8)}

            {/* STATUS */}

            {subject.totalClasses > 0 &&
              subject.percentage < 75 && (
                <View style={styles.warningRow}>
                  <Text style={styles.warningEmoji}>
                    {subject.percentage < 50 ? "🚨" : "⚠️"}
                  </Text>

                  <Text
                    style={[
                      styles.warning,
                      {
                        color:
                          subject.percentage < 50
                            ? "#EF4444"
                            : "#F97316",
                      },
                    ]}
                  >
                    {subject.percentage < 50
                      ? "Attendance critically low"
                      : "Attendance below 75%"}
                  </Text>
                </View>
              )}

            {/* EXPANDED CONTENT */}

            {isExpanded && (
              <View
                style={[
                  styles.detailsContainer,
                  { borderTopColor: colors.border },
                ]}
              >
                {/* THEORY */}

                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                    <View
                      style={[
                        styles.detailIcon,
                        { backgroundColor: "#3B82F618" },
                      ]}
                    >
                      <Text>📘</Text>
                    </View>

                    <View>
                      <Text
                        style={[
                          styles.detailTitle,
                          { color: colors.text },
                        ]}
                      >
                        Theory
                      </Text>

                      <Text
                        style={[
                          styles.detailText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {subject.theory.attendedClasses} /{" "}
                        {subject.theory.totalClasses} attended
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.detailPercentage,
                      {
                        color: getAttendanceColor(
                          subject.theory.percentage
                        ),
                      },
                    ]}
                  >
                    {subject.theory.percentage.toFixed(1)}%
                  </Text>
                </View>

                {/* LAB */}

                {subject.lab && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View
                        style={[
                          styles.detailIcon,
                          { backgroundColor: "#A855F718" },
                        ]}
                      >
                        <Text>🧪</Text>
                      </View>

                      <View>
                        <Text
                          style={[
                            styles.detailTitle,
                            { color: colors.text },
                          ]}
                        >
                          Lab
                        </Text>

                        <Text
                          style={[
                            styles.detailText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {subject.lab.attendedClasses} /{" "}
                          {subject.lab.totalClasses} attended
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.detailPercentage,
                        {
                          color: getAttendanceColor(
                            subject.lab.percentage
                          ),
                        },
                      ]}
                    >
                      {subject.lab.percentage.toFixed(1)}%
                    </Text>
                  </View>
                )}

                {/* CLUB */}

                {subject.theory.clubClasses > 0 && (
                  <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <View
                        style={[
                          styles.detailIcon,
                          { backgroundColor: "#0EA5E918" },
                        ]}
                      >
                        <Text>🎓</Text>
                      </View>

                      <View>
                        <Text
                          style={[
                            styles.detailTitle,
                            { color: colors.text },
                          ]}
                        >
                          Club / Seminar
                        </Text>

                        <Text
                          style={[
                            styles.detailText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Not counted toward attendance
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.detailPercentage,
                        { color: colors.club },
                      ]}
                    >
                      {subject.theory.clubClasses}
                    </Text>
                  </View>
                )}

                {/* ATTENDANCE GUIDANCE */}

                {subject.totalClasses > 0 && (
                  <View
                    style={[
                      styles.guidanceBox,
                      {
                        backgroundColor: colors.cardSecondary,
                      },
                    ]}
                  >
                    {subject.percentage < 75 ? (
                      <>
                        <View style={styles.guidanceHeader}>
                          <Text style={styles.guidanceEmoji}>
                            📈
                          </Text>

                          <Text
                            style={[
                              styles.guidanceTitle,
                              { color: colors.text },
                            ]}
                          >
                            Attendance Recovery
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.guidanceText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Attend{" "}
                          <Text
                            style={[
                              styles.guidanceHighlight,
                              { color: colors.text },
                            ]}
                          >
                            {classesNeededFor75}
                          </Text>{" "}
                          more{" "}
                          {classesNeededFor75 === 1
                            ? "class"
                            : "classes"}{" "}
                          consecutively to reach 75%.
                        </Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.guidanceHeader}>
                          <Text style={styles.guidanceEmoji}>
                            🛡️
                          </Text>

                          <Text
                            style={[
                              styles.guidanceTitle,
                              { color: colors.text },
                            ]}
                          >
                            Attendance Safe
                          </Text>
                        </View>

                        <Text
                          style={[
                            styles.guidanceText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          You can miss{" "}
                          <Text
                            style={[
                              styles.guidanceHighlight,
                              { color: colors.text },
                            ]}
                          >
                            {classesCanMiss}
                          </Text>{" "}
                          more{" "}
                          {classesCanMiss === 1
                            ? "class"
                            : "classes"}{" "}
                          and stay at or above 75%.
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            )}
          </Pressable>
        );
      })}

      {/* EMPTY STATE */}

      {subjects.length === 0 && (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={styles.emptySubjectEmoji}>📚</Text>

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
            Your assigned subjects will appear here once
            they are added by your administrator.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 23,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 7,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  subtitle: {
    fontSize: 12,
    marginTop: 6,
  },

  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  headerEmoji: {
    fontSize: 25,
  },

  overallCard: {
    borderRadius: 23,
    padding: 20,
    borderWidth: 1,
    marginBottom: 26,
  },

  overallTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  overallPercentage: {
    fontSize: 43,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 7,
  },

  overallIcon: {
    width: 53,
    height: 53,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  overallEmoji: {
    fontSize: 25,
  },

  cardSubText: {
    fontSize: 12,
    marginTop: 3,
  },

  progressBackground: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 16,
  },

  progressFill: {
    height: "100%",
    borderRadius: 20,
  },

  progressFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  progressFooterText: {
    fontSize: 10,
  },

  targetText: {
    fontSize: 10,
    fontWeight: "800",
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    fontSize: 11,
    marginTop: 5,
  },

  statsGrid: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 25,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 17,
    borderWidth: 1,
    padding: 11,
  },

  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  statEmoji: {
    fontSize: 16,
  },

  statLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  statValue: {
    fontSize: 19,
    fontWeight: "800",
    marginTop: 5,
  },

  statDescription: {
    fontSize: 9,
    marginTop: 5,
    lineHeight: 13,
  },

  chartCard: {
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    marginBottom: 27,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  chartEmoji: {
    fontSize: 23,
  },

  chartWrapper: {
    width: "100%",
    marginTop: 13,
    alignItems: "center",
  },

  emptyTrend: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 15,
  },

  emptyTrendEmoji: {
    fontSize: 30,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyText: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 7,
  },

  subjectSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  subjectCount: {
    minWidth: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  subjectCountText: {
    fontSize: 13,
    fontWeight: "800",
  },

  subjectCard: {
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    marginTop: 12,
  },

  subjectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  subjectTitleContainer: {
    flex: 1,
    paddingRight: 10,
  },

  subjectName: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },

  subjectClasses: {
    fontSize: 11,
    marginTop: 5,
  },

  subjectRight: {
    alignItems: "flex-end",
    marginLeft: 8,
  },

  subjectPercentage: {
    fontSize: 19,
    fontWeight: "800",
  },

  expandIcon: {
    fontSize: 19,
    fontWeight: "700",
    marginTop: 2,
  },

  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },

  warningEmoji: {
    fontSize: 12,
    marginRight: 6,
  },

  warning: {
    fontSize: 11,
    fontWeight: "700",
  },

  detailsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },

  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  detailTitle: {
    fontSize: 12,
    fontWeight: "800",
  },

  detailText: {
    fontSize: 10,
    marginTop: 4,
  },

  detailPercentage: {
    fontSize: 14,
    fontWeight: "800",
  },

  guidanceBox: {
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },

  guidanceHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  guidanceEmoji: {
    fontSize: 15,
    marginRight: 7,
  },

  guidanceTitle: {
    fontSize: 12,
    fontWeight: "800",
  },

  guidanceText: {
    fontSize: 11,
    marginTop: 7,
    lineHeight: 18,
  },

  guidanceHighlight: {
    fontWeight: "800",
  },

  emptyCard: {
    borderRadius: 19,
    padding: 25,
    borderWidth: 1,
    marginTop: 13,
    alignItems: "center",
  },

  emptySubjectEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
});
