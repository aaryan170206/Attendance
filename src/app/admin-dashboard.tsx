
import { useTheme } from "@/context/ThemeContext";
import { getAdminDashboardStats, type AdminDashboardStats } from "@/services/adminDashboard";
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
// SAMPLE DATA - Replace with Supabase data later
// --------------------------------------------------

const departments = [
  {
    id: "BBA",
    name: "BBA",
    attendance: 86,
    data: [
      { month: "Jun", year1: 78, year2: 82, year3: 75 },
      { month: "Jul", year1: 81, year2: 84, year3: 79 },
      { month: "Aug", year1: 76, year2: 80, year3: 83 },
      { month: "Sep", year1: 85, year2: 86, year3: 81 },
      { month: "Oct", year1: 88, year2: 83, year3: 86 },
      { month: "Nov", year1: 86, year2: 89, year3: 84 },
    ],
  },
  {
    id: "BCA",
    name: "BCA",
    attendance: 82,
    data: [
      { month: "Jun", year1: 75, year2: 80, year3: 78 },
      { month: "Jul", year1: 79, year2: 82, year3: 81 },
      { month: "Aug", year1: 83, year2: 77, year3: 80 },
      { month: "Sep", year1: 80, year2: 85, year3: 84 },
      { month: "Oct", year1: 86, year2: 82, year3: 87 },
      { month: "Nov", year1: 84, year2: 88, year3: 85 },
    ],
  },
  {
    id: "B.Com",
    name: "B.Com",
    attendance: 79,
    data: [
      { month: "Jun", year1: 72, year2: 76, year3: 80 },
      { month: "Jul", year1: 75, year2: 79, year3: 82 },
      { month: "Aug", year1: 78, year2: 81, year3: 77 },
      { month: "Sep", year1: 80, year2: 83, year3: 84 },
      { month: "Oct", year1: 82, year2: 85, year3: 81 },
      { month: "Nov", year1: 85, year2: 82, year3: 87 },
    ],
  },
];

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
        const points = data.map((entry, index) => ({
          x: getX(index),
          y: getY(Number(entry[item.key] ?? 0)),
        }));

        const path = points
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
          )
          .join(" ");

        return (
          <React.Fragment key={item.key}>
            <Path
              d={path}
              stroke={item.color}
              strokeWidth={2.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((point, index) => (
              <Circle
                key={index}
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

  const selectedDept = departments.find(
    (dept) => dept.id === selectedDepartment
  );

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

  const mainSeries: GraphSeries[] = [
    { label: "BBA", key: "bba", color: "#2563EB" },
    { label: "BCA", key: "bca", color: "#A855F7" },
    { label: "B.Com", key: "bcom", color: "#0D9488" },
  ];

  const mainData = [
    { month: "Jun", bba: 78, bca: 75, bcom: 80 },
    { month: "Jul", bba: 81, bca: 79, bcom: 82 },
    { month: "Aug", bba: 76, bca: 83, bcom: 78 },
    { month: "Sep", bba: 85, bca: 80, bcom: 84 },
    { month: "Oct", bba: 88, bca: 86, bcom: 82 },
    { month: "Nov", bba: 86, bca: 84, bcom: 85 },
  ];

  const yearSeries: GraphSeries[] = [
    { label: "2024–25", key: "year1", color: "#2563EB" },
    { label: "2025–26", key: "year2", color: "#A855F7" },
    { label: "2026–27", key: "year3", color: "#0D9488" },
  ];

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
            Three academic years · Overall attendance
          </Text>

          <View style={[styles.card, { marginTop: 22 }]}>
            <Text style={styles.sectionTitle}>
              Three-Year Attendance Comparison
            </Text>
            <Text style={[styles.mutedText, { marginTop: 5 }]}>
              Monthly attendance percentage
            </Text>

            <View style={{ marginTop: 20 }}>
              <AttendanceGraph
                data={selectedDept.data}
                series={yearSeries}
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
              {yearSeries.map((item) => (
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
              {selectedDept.attendance}%
            </Text>
          </View>

          <Text
            style={[
              styles.mutedText,
              { marginTop: 18, lineHeight: 19 },
            ]}
          >
            Historical comparisons will use the actual academic-year
            records stored in Supabase. The current graph uses
            illustrative sample figures.
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
              color: "#DC2626",
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

          <Pressable
            onPress={() => setSelectedDepartment("BBA")}
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

        {departments.map((dept) => (
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
                  {dept.attendance}%
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
          {[
            {
              title: "Attendance session opened",
              detail: "BBA · Theory",
              time: "Today",
              icon: "calendar-outline" as const,
            },
            {
              title: "New student added",
              detail: "Student registration",
              time: "Yesterday",
              icon: "person-add-outline" as const,
            },
            {
              title: "Department settings updated",
              detail: "Attendance thresholds",
              time: "Recently",
              icon: "settings-outline" as const,
            },
          ].map((activity, index) => (
            <View
              key={activity.title}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: index === 2 ? 0 : 1,
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
                  name={activity.icon}
                  size={18}
                  color={colors.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.activityText}>
                  {activity.title}
                </Text>
                <Text
                  style={[
                    styles.mutedText,
                    { marginTop: 3 },
                  ]}
                >
                  {activity.detail}
                </Text>
              </View>

              <Text style={styles.mutedText}>
                {activity.time}
              </Text>
            </View>
          ))}
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
