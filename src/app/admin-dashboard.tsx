
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import {
  getAdminDashboardStats,
  getMonthlyDepartmentAttendance,
  getRecentActivity,
  type AdminDashboardStats,
  type MonthlyDepartmentAttendance,
  type RecentActivity,
} from "@/services/adminDashboard";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";

// --------------------------------------------------
// LINE GRAPH COMPONENT
// --------------------------------------------------

type GraphSeries = {
  label: string;
  color: string;
  key: string;
};

function AttendanceGraph({
  data,
  series,
  width,
  colors,
}: {
  data: any[];
  series: GraphSeries[];
  width: number;
  colors: any;
}) {
  const height = 230;
  const left = 36;
  const right = 12;
  const top = 18;
  const bottom = 32;

  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  const getX = (index: number) =>
    left +
    (index / Math.max(data.length - 1, 1)) * graphWidth;

  const getY = (value: number) =>
    top + ((100 - value) / 100) * graphHeight;

  return (
    <Svg width={width} height={height}>
      {[0, 25, 50, 75, 100].map((value) => (
        <React.Fragment key={value}>
          <Line
            x1={left}
            y1={getY(value)}
            x2={width - right}
            y2={getY(value)}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4,5"
          />
          <SvgText
            x={left - 8}
            y={getY(value) + 4}
            fontSize="10"
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {value}
          </SvgText>
        </React.Fragment>
      ))}

      {series.map((item) => {
        const points = data
          .map((entry, index) => {
            const value = entry[item.key];
            if (value == null || !Number.isFinite(Number(value))) return null;
            return { x: getX(index), y: getY(Number(value)), index };
          })
          .filter((point): point is { x: number; y: number; index: number } => point !== null);

        const path = points
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
          )
          .join(" ");

        return (
          <React.Fragment key={item.key}>
            {points.length > 0 ? <Path
              d={path}
              stroke={item.color}
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            /> : null}

            {points.map((point, index) => (
              <Circle
                key={point.index}
                cx={point.x}
                cy={point.y}
                r={3.5}
                fill={item.color}
                stroke={colors.card}
                strokeWidth={1.5}
              />
            ))}
          </React.Fragment>
        );
      })}

      {data.map((entry, index) => (
        <SvgText
          key={index}
          x={getX(index)}
          y={height - 8}
          fontSize="10"
          fill={colors.textSecondary}
          textAnchor="middle"
        >
          {entry.month}
        </SvgText>
      ))}
    </Svg>
  );
}

// --------------------------------------------------
// MAIN ADMIN DASHBOARD
// --------------------------------------------------

export default function AdminDashboard() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [selectedDepartment, setSelectedDepartment] =
    useState<string | null>(null);

  const [dashboardStats, setDashboardStats] =
    useState<AdminDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [monthlyAttendance, setMonthlyAttendance] =
    useState<MonthlyDepartmentAttendance[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadDashboardStats = async () => {
      setStatsLoading(true);
      setStatsError(null);

      const result = await getAdminDashboardStats();

      if (!isActive) return;

      if (result.error) {
        setStatsError(result.error);
        setDashboardStats(null);
      } else {
        setDashboardStats(result.data);
      }

      setStatsLoading(false);
    };

    loadDashboardStats();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadMonthlyAttendance = async () => {
      setMonthlyLoading(true);
      setMonthlyError(null);

      const result = await getMonthlyDepartmentAttendance();
      if (!isActive) return;

      if (result.error) {
        setMonthlyError(result.error);
        setMonthlyAttendance([]);
      } else {
        setMonthlyAttendance(result.data ?? []);
      }

      setMonthlyLoading(false);
    };

    loadMonthlyAttendance();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadRecentActivity = async (showLoader = false) => {
      if (showLoader) {
        setActivityLoading(true);
      }

      setActivityError(null);

      const result = await getRecentActivity();

      if (!isActive) return;

      if (result.error) {
        setActivityError(result.error);
        setRecentActivities([]);
      } else {
        setRecentActivities(result.data ?? []);
      }

      setActivityLoading(false);
    };

    // Load existing correction records when the dashboard opens.
    loadRecentActivity(true);

    // Refresh the activity list whenever a new correction is inserted.
    const channel = supabase
      .channel("admin-recent-activity")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "attendance_correction_logs",
        },
        () => {
          loadRecentActivity();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const dashboardStatCards = [
    {
      title: "Students",
      value: statsLoading ? "..." : String(dashboardStats?.students ?? 0),
      icon: "people-outline" as const,
      color: "#2563EB",
    },
    {
      title: "Teachers",
      value: statsLoading ? "..." : String(dashboardStats?.teachers ?? 0),
      icon: "person-outline" as const,
      color: "#A855F7",
    },
    {
      title: "Departments",
      value: statsLoading ? "..." : String(dashboardStats?.departments ?? 0),
      icon: "business-outline" as const,
      color: "#0D9488",
    },
    {
      title: "Attendance",
      value: statsLoading
        ? "..."
        : dashboardStats?.attendance == null
          ? "—"
          : `${dashboardStats.attendance}%`,
      icon: "stats-chart-outline" as const,
      color: "#EA580C",
    },
  ];

  const isWide = width >= 700;
  const contentWidth = Math.min(width - 32, 1000);
  const graphWidth = Math.max(contentWidth - 64, 240);

  const departmentColors = ["#2563EB", "#A855F7", "#0D9488", "#EA580C", "#DB2777", "#0891B2"];

  const departments = Array.from(
    monthlyAttendance.reduce((map, item) => {
      if (!map.has(item.departmentId)) {
        map.set(item.departmentId, {
          id: item.departmentId,
          name: item.departmentName,
          chartColor: item.chartColor,
          present: 0,
          absent: 0,
          leftEarly: 0,
          onLeave: 0,
          pending: 0,
        });
      }
      const department = map.get(item.departmentId)!;
      department.present += item.present;
      department.absent += item.absent;
      department.leftEarly += item.leftEarly;
      department.onLeave += item.onLeave;
      department.pending += item.pending;
      return map;
    }, new Map<string, {
      id: string; name: string; chartColor: string | null;
      present: number; absent: number; leftEarly: number;
      onLeave: number; pending: number;
    }>() ).values()
  ).map((department, index) => {
    const eligible = department.present + department.absent + department.leftEarly;
    return {
      ...department,
      attendance: eligible === 0 ? null : Number((((department.present + department.leftEarly * 0.5) / eligible) * 100).toFixed(1)),
      color: department.chartColor || departmentColors[index % departmentColors.length],
      data: monthlyAttendance
        .filter((item) => item.departmentId === department.id)
        .map((item) => ({
          month: new Date(`${item.month}T00:00:00`).toLocaleDateString("en", { month: "short", year: "2-digit" }),
          attendance: item.attendance,
        })),
    };
  });

  const selectedDept = departments.find((dept) => dept.id === selectedDepartment);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 55,
    paddingBottom: 40,
  },
    heading: {
      fontSize: 25,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 5,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    statCard: {
      width: isWide ? "23.5%" : "48.5%",
      minHeight: 120,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    statValue: {
      fontSize: 23,
      fontWeight: "800",
      color: colors.text,
      marginTop: 12,
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    legendText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    departmentCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 15,
      marginBottom: 10,
    },
    departmentName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    departmentValue: {
      color: colors.primary,
      fontSize: 19,
      fontWeight: "800",
    },
    activityText: {
      color: colors.text,
      fontSize: 13,
      flex: 1,
    },
    mutedText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    actionButton: {
      width: isWide ? "23.5%" : "48.5%",
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
  });

  const mainSeries: GraphSeries[] = departments.map((department) => ({
    label: department.name,
    key: department.id,
    color: department.color,
  }));

  const monthKeys = Array.from(new Set(monthlyAttendance.map((item) => item.month))).sort();
  const mainData = monthKeys.map((month) => {
    const row: Record<string, string | number | null> = {
      month: new Date(`${month}T00:00:00`).toLocaleDateString("en", { month: "short", year: "2-digit" }),
    };
    departments.forEach((department) => {
      const match = monthlyAttendance.find(
        (item) => item.month === month && item.departmentId === department.id
      );
      row[department.id] = match?.attendance ?? null;
    });
    return row;
  });

  const selectedDeptSeries: GraphSeries[] = selectedDept
    ? [{ label: selectedDept.name, key: "attendance", color: selectedDept.color }]
    : [];
  const selectedDeptData = selectedDept
    ? monthlyAttendance
        .filter((item) => item.departmentId === selectedDept.id)
        .map((item) => ({
          month: new Date(`${item.month}T00:00:00`).toLocaleDateString("en", { month: "short", year: "2-digit" }),
          attendance: item.attendance,
        }))
    : [];

  const openAction = (action: string) => {
    Alert.alert(
      action,
      "We'll connect this action to the existing Admin screens."
    );
  };

  // ------------------------------------------------
  // DETAILED DEPARTMENT ANALYTICS
  // ------------------------------------------------

  if (selectedDept) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => setSelectedDepartment(null)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 22,
            }}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={colors.primary}
            />
            <Text
              style={{
                color: colors.primary,
                marginLeft: 9,
                fontWeight: "600",
              }}
            >
              Back to Dashboard
            </Text>
          </Pressable>

          <Text style={styles.heading}>
            {selectedDept.name} Analytics
          </Text>
          <Text style={styles.subtitle}>
            Monthly attendance · All available records
          </Text>

          <View style={[styles.card, { marginTop: 22 }]}>
            <Text style={styles.sectionTitle}>
              Monthly Attendance Trend
            </Text>
            <Text style={[styles.mutedText, { marginTop: 5 }]}>
              Monthly attendance percentage
            </Text>

            <View style={{ marginTop: 20 }}>
              <AttendanceGraph
                data={selectedDeptData}
                series={selectedDeptSeries}
                width={graphWidth}
                colors={colors}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 16,
                marginTop: 12,
              }}
            >
              {selectedDeptSeries.map((item) => (
                <View
                  key={item.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      backgroundColor: item.color,
                    }}
                  />
                  <Text style={styles.legendText}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Text
            style={[
              styles.sectionTitle,
              { marginTop: 25, marginBottom: 12 },
            ]}
          >
            Department Overview
          </Text>

          <View style={styles.card}>
            <Text style={styles.mutedText}>
              Current overall attendance
            </Text>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "800",
                color: colors.primary,
                marginTop: 5,
              }}
            >
              {selectedDept.attendance == null ? "—" : `${selectedDept.attendance}%`}
            </Text>
          </View>

          <Text
            style={[
              styles.mutedText,
              { marginTop: 18, lineHeight: 19 },
            ]}
          >
            Attendance is calculated from actual Supabase records. Present counts as 100%,
            left early as 50%, and absent as 0%. Approved leave and pending records are
            excluded from the percentage.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ------------------------------------------------
  // MAIN DASHBOARD VIEW
  // ------------------------------------------------

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 23,
          }}
        >
          <View>
            <Text style={styles.heading}>Dashboard</Text>
            <Text style={styles.subtitle}>
              Institution overview
            </Text>
          </View>

          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons
              name="notifications-outline"
              size={21}
              color={colors.text}
            />
          </View>
        </View>

        {/* STATISTICS */}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {dashboardStatCards.map((item) => (
            <View key={item.title} style={styles.statCard}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: item.color + "20" },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={21}
                  color={item.color}
                />
              </View>

              <Text style={styles.statValue}>
                {item.value}
              </Text>
              <Text style={styles.statLabel}>
                {item.title}
              </Text>
            </View>
          ))}
        </View>

        {statsError ? (
          <Text
            style={{
              color:"#DC2626",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Unable to load dashboard statistics: {statsError}
          </Text>
        ) : null}

        {/* ATTENDANCE GRAPH */}

        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>
            Attendance Overview
          </Text>
          <Text style={[styles.mutedText, { marginTop: 5 }]}>
            Compare overall attendance across departments
          </Text>

          {monthlyLoading ? (
            <Text style={[styles.mutedText, { marginTop: 18 }]}>Loading monthly attendance...</Text>
          ) : monthlyError ? (
            <Text style={{ color: "#DC2626", fontSize: 12, marginTop: 18 }}>{monthlyError}</Text>
          ) : mainData.length === 0 ? (
            <Text style={[styles.mutedText, { marginTop: 18 }]}>No monthly attendance data available yet.</Text>
          ) : (
          <>
          <View style={{ marginTop: 18 }}>
            <AttendanceGraph
              data={mainData}
              series={mainSeries}
              width={graphWidth}
              colors={colors}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 10,
            }}
          >
            {mainSeries.map((item) => (
              <View
                key={item.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: item.color,
                  }}
                />
                <Text style={styles.legendText}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
          </>
          )}

          <Pressable
            disabled={departments.length === 0}
            onPress={() => departments[0] && setSelectedDepartment(departments[0].id)}
            style={{
              marginTop: 20,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              Explore department analytics
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={colors.primary}
            />
          </Pressable>
        </View>

        {/* DEPARTMENTS */}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 25,
            marginBottom: 12,
          }}
        >
          <Text style={styles.sectionTitle}>
            Department Overview
          </Text>
          <Text style={styles.mutedText}>
            View details
          </Text>
        </View>

        {monthlyLoading ? (
          <Text style={[styles.mutedText, { marginBottom: 12 }]}>Loading department attendance...</Text>
        ) : monthlyError ? (
          <Text style={{ color: "#DC2626", fontSize: 12, marginBottom: 12 }}>{monthlyError}</Text>
        ) : departments.length === 0 ? (
          <Text style={[styles.mutedText, { marginBottom: 12 }]}>No department attendance records found yet.</Text>
        ) : departments.map((dept) => (
          <Pressable
            key={dept.id}
            onPress={() => setSelectedDepartment(dept.id)}
            style={styles.departmentCard}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text style={styles.departmentName}>
                  {dept.name}
                </Text>
                <Text
                  style={[styles.mutedText, { marginTop: 5 }]}
                >
                  Overall attendance
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={styles.departmentValue}>
                  {dept.attendance == null ? "—" : `${dept.attendance}%`}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            </View>
          </Pressable>
        ))}

        {/* QUICK ACTIONS */}

        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 24, marginBottom: 12 },
          ]}
        >
          Quick Actions
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {[
            {
              title: "Add Student",
              icon: "person-add-outline" as const,
            },
            {
              title: "Add Teacher",
              icon: "people-outline" as const,
            },
            {
              title: "Departments",
              icon: "business-outline" as const,
            },
            {
              title: "View Reports",
              icon: "document-text-outline" as const,
            },
          ].map((action) => (
            <Pressable
              key={action.title}
              onPress={() => openAction(action.title)}
              style={styles.actionButton}
            >
              <Ionicons
                name={action.icon}
                size={22}
                color={colors.primary}
              />
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "600",
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                {action.title}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* RECENT ACTIVITY */}

        <Text
          style={[
            styles.sectionTitle,
            { marginTop: 20, marginBottom: 12 },
          ]}
        >
          Recent Activity
        </Text>

        <View style={styles.card}>
          {activityLoading ? (
            <Text style={[styles.mutedText, { paddingVertical: 14 }]}>Loading recent activity...</Text>
          ) : activityError ? (
            <Text style={{ color: "#DC2626", fontSize: 12, paddingVertical: 14 }}>
              Unable to load recent activity: {activityError}
            </Text>
          ) : recentActivities.length === 0 ? (
            <Text style={[styles.mutedText, { paddingVertical: 14 }]}>No attendance corrections have been recorded yet.</Text>
          ) : (
            recentActivities.map((activity, index) => {
              const oldStatus = activity.oldStatus.replace(/([A-Z])/g, " $1");
              const newStatus = activity.newStatus.replace(/([A-Z])/g, " $1");
              const activityDate = new Date(activity.createdAt);
              const formattedTime = Number.isNaN(activityDate.getTime())
                ? activity.createdAt
                : activityDate.toLocaleString([], {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

              return (
                <View
                  key={activity.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    paddingVertical: 13,
                    borderBottomWidth: index === recentActivities.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: colors.cardSecondary,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityText}>
                      Attendance corrected for {activity.studentName}
                    </Text>
                    <Text style={[styles.mutedText, { marginTop: 4, lineHeight: 18 }]}>
                      {activity.subjectName} · {activity.teacherName}
                    </Text>
                    <Text style={[styles.mutedText, { marginTop: 3, lineHeight: 18 }]}>
                      {oldStatus} → {newStatus}
                    </Text>
                    <Text style={[styles.mutedText, { marginTop: 3, lineHeight: 18 }]}>
                      Reason: {activity.reason}
                    </Text>
                    <Text style={[styles.mutedText, { marginTop: 5 }]}>
                      {formattedTime}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <Text
          style={[
            styles.mutedText,
            { textAlign: "center", marginTop: 25 },
          ]}
        >
          AttendFlow Admin Dashboard
        </Text>
      </ScrollView>
    </View>
  );
}
