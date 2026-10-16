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
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Line,
  Text as SvgText,
} from "react-native-svg";

export default function DashboardScreen() {
  const { attendance } = useAttendance();
  const { subjects } = useSubjects();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const overallStats = calculateOverallAttendance(attendance);
  const theoryStats = calculateOverallTheoryAttendance(attendance);
  const labStats = calculateOverallLabAttendance(attendance);
  const clubClasses = calculateClubClasses(attendance);
  const trend = calculateAttendanceTrend(attendance);

  // Attendance colour scale used throughout the dashboard.
  const getAttendanceColor = (percentage: number) => {
    if (percentage > 90) return "#06B6D4"; // Cyan
    if (percentage >= 75) return "#22C55E"; // Green
    if (percentage >= 65) return "#F97316"; // Orange
    if (percentage >= 50) return "#EAB308"; // Yellow
    return "#EF4444"; // Red
  };

  /*
   * -------------------------
   * ATTENDANCE GUIDANCE
   * -------------------------
   */

  const getClassesNeededFor75 = (attended: number, total: number) => {
    if (total === 0) {
      return 0;
    }

    if (attended / total >= 0.75) {
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

  const getClassesCanMiss = (attended: number, total: number) => {
    if (total === 0) {
      return 0;
    }

    let classesCanMiss = 0;

    while (
      attended /
        (total + classesCanMiss + 1) >=
      0.75
    ) {
      classesCanMiss++;
    }

    return classesCanMiss;
  };

  /*
   * -------------------------
   * TREND GRAPH CALCULATIONS
   * -------------------------
   */

  const chartWidth = 320;
  const chartHeight = 220;
  const graphLeft = 40;
  const graphRight = 300;
  const graphTop = 20;
  const graphBottom = 200;
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

  /*
   * -------------------------
   * SUBJECT DATA
   * -------------------------
   */

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
        Your attendance overview
      </Text>

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

        <Text
          style={[
            styles.cardSubText,
            { color: colors.textSecondary },
          ]}
        >
          {overallStats.attendedClasses} /{" "}
          {overallStats.totalClasses} classes attended
        </Text>

        <View
          style={[
            styles.progressBackground,
            {
              backgroundColor: colors.cardSecondary,
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(
                  overallStats.percentage,
                  100
                )}%`,
                backgroundColor: getAttendanceColor(
                  overallStats.percentage
                ),
              },
            ]}
          />
        </View>
      </View>

      {/* THEORY / LAB / CLUB */}

      <View style={styles.statsRow}>
        {/* THEORY */}

        <View
          style={[
            styles.smallCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.smallCardTitle,
              { color: colors.textSecondary },
            ]}
          >
            Theory
          </Text>

          <Text
            style={[
              styles.smallPercentage,
              {
                color: getAttendanceColor(
                  theoryStats.percentage
                ),
              },
            ]}
          >
            {theoryStats.percentage.toFixed(1)}%
          </Text>

          <Text
            style={[
              styles.smallCardText,
              { color: colors.textSecondary },
            ]}
          >
            {theoryStats.attendedTheory} /{" "}
            {theoryStats.totalTheory}
          </Text>
        </View>

        {/* LAB */}

        <View
          style={[
            styles.smallCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.smallCardTitle,
              { color: colors.textSecondary },
            ]}
          >
            Labs
          </Text>

          <Text
            style={[
              styles.smallPercentage,
              {
                color: getAttendanceColor(
                  labStats.percentage
                ),
              },
            ]}
          >
            {labStats.percentage.toFixed(1)}%
          </Text>

          <Text
            style={[
              styles.smallCardText,
              { color: colors.textSecondary },
            ]}
          >
            {labStats.attendedLabs} /{" "}
            {labStats.totalLabs}
          </Text>
        </View>

        {/* CLUB */}

        <View
          style={[
            styles.smallCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.smallCardTitle,
              { color: colors.textSecondary },
            ]}
          >
            Club
          </Text>

          <Text
            style={[
              styles.smallPercentage,
              { color: colors.club },
            ]}
          >
            {clubClasses}
          </Text>

          <Text
            style={[
              styles.smallCardText,
              { color: colors.textSecondary },
            ]}
          >
            classes
          </Text>
        </View>
      </View>

      {/* ATTENDANCE TREND */}

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
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
          Overall attendance over time
        </Text>

        {trend.length < 2 ? (
          <View style={styles.emptyTrend}>
            <Text
              style={[
                styles.emptyText,
                { color: colors.textSecondary },
              ]}
            >
              Mark attendance for at least 2 dates
              to see your trend.
            </Text>
          </View>
        ) : (
          <View style={styles.chartWrapper}>
            <Svg
              width="100%"
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              {/* 100% */}

              <Line
                x1={graphLeft}
                y1={getY(100)}
                x2={graphRight}
                y2={getY(100)}
                stroke={colors.border}
                strokeWidth="1"
              />

              {/* 75% */}

              <Line
                x1={graphLeft}
                y1={getY(75)}
                x2={graphRight}
                y2={getY(75)}
                stroke={colors.border}
                strokeWidth="1"
              />

              {/* 50% */}

              <Line
                x1={graphLeft}
                y1={getY(50)}
                x2={graphRight}
                y2={getY(50)}
                stroke={colors.border}
                strokeWidth="1"
              />

              {/* 25% */}

              <Line
                x1={graphLeft}
                y1={getY(25)}
                x2={graphRight}
                y2={getY(25)}
                stroke={colors.border}
                strokeWidth="1"
              />

              {/* 0% */}

              <Line
                x1={graphLeft}
                y1={getY(0)}
                x2={graphRight}
                y2={getY(0)}
                stroke={colors.border}
                strokeWidth="1"
              />

              {/* Y AXIS LABELS */}

              <SvgText
                x="4"
                y={getY(100) + 4}
                fill={colors.textSecondary}
                fontSize="10"
              >
                100%
              </SvgText>

              <SvgText
                x="9"
                y={getY(75) + 4}
                fill={colors.textSecondary}
                fontSize="10"
              >
                75%
              </SvgText>

              <SvgText
                x="9"
                y={getY(50) + 4}
                fill={colors.textSecondary}
                fontSize="10"
              >
                50%
              </SvgText>

              <SvgText
                x="9"
                y={getY(25) + 4}
                fill={colors.textSecondary}
                fontSize="10"
              >
                25%
              </SvgText>

              <SvgText
                x="14"
                y={getY(0) + 4}
                fill={colors.textSecondary}
                fontSize="10"
              >
                0%
              </SvgText>

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

              {trend.map((item, index) => {
                const x = getX(index);
                const y = getY(item.percentage);

                return (
                  <Circle
                    key={item.date}
                    cx={x}
                    cy={y}
                    r="4"
                    fill={getAttendanceColor(
                      item.percentage
                    )}
                  />
                );
              })}

              {/* FIRST DATE */}

              <SvgText
                x={getX(0)}
                y="216"
                fill={colors.textSecondary}
                fontSize="9"
                textAnchor="middle"
              >
                {trend[0].date.slice(5)}
              </SvgText>

              {/* LAST DATE */}

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

      <Text
        style={[
          styles.sectionTitle,
          {
            color: colors.text,
            marginTop: 10,
          },
        ]}
      >
        Subject Attendance
      </Text>

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

        return (
          <Pressable
            key={subject.name}
            onPress={() =>
              setExpandedSubject(
                isExpanded ? null : subject.name
              )
            }
            style={[
              styles.subjectCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
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
                  {subject.totalClasses} classes
                </Text>
              </View>

              <Text
                style={[
                  styles.subjectPercentage,
                  {
                    color: getAttendanceColor(
                      subject.percentage
                    ),
                  },
                ]}
              >
                {subject.percentage.toFixed(1)}%
              </Text>
            </View>

            {/* PROGRESS BAR */}

            <View
              style={[
                styles.progressBackground,
                {
                  backgroundColor: colors.cardSecondary,
                },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      subject.percentage,
                      100
                    )}%`,
                    backgroundColor: getAttendanceColor(
                      subject.percentage
                    ),
                  },
                ]}
              />
            </View>

            {/* WARNINGS */}

            {subject.percentage <= 75 &&
              subject.percentage >= 50 && (
                <Text
                  style={[
                    styles.warning,
                    { color: colors.leftEarly },
                  ]}
                >
                  ⚠️ Attendance below 75%
                </Text>
              )}

            {subject.percentage < 50 &&
              subject.totalClasses > 0 && (
                <Text
                  style={[
                    styles.warning,
                    { color: colors.absent },
                  ]}
                >
                  🚨 Attendance critically low
                </Text>
              )}

            {/* ATTENDANCE GUIDANCE */}

            {subject.totalClasses > 0 &&
              subject.percentage < 75 && (
                <View
                  style={[
                    styles.guidanceBox,
                    {
                      backgroundColor: colors.cardSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.guidanceTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    📈 Attendance Recovery
                  </Text>

                  <Text
                    style={[
                      styles.guidanceText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    Attend{" "}
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "700",
                      }}
                    >
                      {classesNeededFor75}
                    </Text>{" "}
                    more{" "}
                    {classesNeededFor75 === 1
                      ? "class"
                      : "classes"}{" "}
                    to reach 75%.
                  </Text>
                </View>
              )}

            {subject.totalClasses > 0 &&
              subject.percentage >= 75 && (
                <View
                  style={[
                    styles.guidanceBox,
                    {
                      backgroundColor: colors.cardSecondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.guidanceTitle,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    🛡️ Attendance Safe
                  </Text>

                  <Text
                    style={[
                      styles.guidanceText,
                      {
                        color: colors.textSecondary,
                      },
                    ]}
                  >
                    You can miss{" "}
                    <Text
                      style={{
                        color: colors.text,
                        fontWeight: "700",
                      }}
                    >
                      {classesCanMiss}
                    </Text>{" "}
                    more{" "}
                    {classesCanMiss === 1
                      ? "class"
                      : "classes"}{" "}
                    and stay at or above 75%.
                  </Text>
                </View>
              )}

            {/* EXPANDED DETAILS */}

            {isExpanded && (
              <View
                style={[
                  styles.detailsContainer,
                  {
                    borderTopColor: colors.border,
                  },
                ]}
              >
                {/* THEORY */}

                <View style={styles.detailRow}>
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
                        {
                          color: colors.textSecondary,
                        },
                      ]}
                    >
                      {subject.theory.attendedClasses}{" "}
                      /{" "}
                      {subject.theory.totalClasses}{" "}
                      attended
                    </Text>
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
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        {subject.lab.attendedClasses}{" "}
                        /{" "}
                        {subject.lab.totalClasses}{" "}
                        attended
                      </Text>
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
                          {
                            color: colors.textSecondary,
                          },
                        ]}
                      >
                        Not counted toward attendance
                      </Text>
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
          <Text
            style={[
              styles.emptyText,
              { color: colors.textSecondary },
            ]}
          >
            Add subjects from the Subjects tab to
            start tracking attendance.
          </Text>
        </View>
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
  overallCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  overallPercentage: {
    fontSize: 42,
    fontWeight: "700",
    marginTop: 5,
  },
  cardSubText: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  smallCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  smallCardTitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  smallPercentage: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  smallCardText: {
    fontSize: 11,
    marginTop: 2,
  },
  progressBackground: {
    height: 8,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 14,
  },
  progressFill: {
    height: "100%",
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 10,
  },
  chartWrapper: {
    width: "100%",
    marginTop: 5,
    alignItems: "center",
  },
  emptyTrend: {
    paddingVertical: 25,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  subjectCard: {
    borderRadius: 18,
    padding: 18,
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
    fontSize: 17,
    fontWeight: "600",
  },
  subjectClasses: {
    fontSize: 12,
    marginTop: 4,
  },
  subjectPercentage: {
    fontSize: 20,
    fontWeight: "700",
  },
  warning: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
  },
  guidanceBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  guidanceTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  guidanceText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  detailsContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailText: {
    fontSize: 12,
    marginTop: 3,
  },
  detailPercentage: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 18,
    padding: 25,
    borderWidth: 1,
    marginTop: 12,
  },
});