
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Layout, Spacing } from "@/constants/spacing";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type Assignment = {
  id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
};

type StudentSubmission = {
  assignment_id: string;
  status: string;
  submitted_at: string | null;
};

type AssignmentItem = Assignment & {
  subjectName: string;
  semester: number | null;
  submissionStatus: "pending" | "submitted";
  submittedAt: string | null;
};

type FilterType = "all" | "pending" | "submitted";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDueDateInfo(value: string | null) {
  if (!value) {
    return {
      label: "No due date",
      color: "#64748B",
      background: "#64748B18",
    };
  }

  const dueDate = new Date(value);

  if (Number.isNaN(dueDate.getTime())) {
    return {
      label: "Invalid date",
      color: "#64748B",
      background: "#64748B18",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );

  const difference = Math.ceil(
    (dueDay.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (difference < 0) {
    return {
      label: "Overdue",
      color: "#EF4444",
      background: "#EF444418",
    };
  }

  if (difference === 0) {
    return {
      label: "Due today",
      color: "#F59E0B",
      background: "#F59E0B18",
    };
  }

  if (difference === 1) {
    return {
      label: "Due tomorrow",
      color: "#F59E0B",
      background: "#F59E0B18",
    };
  }

  if (difference <= 7) {
    return {
      label: `Due in ${difference} days`,
      color: "#3B82F6",
      background: "#3B82F618",
    };
  }

  return {
    label: formatDate(value),
    color: "#64748B",
    background: "#64748B18",
  };
}

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

export default function AssignmentsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] =
    useState<FilterType>("all");

  const [expandedAssignmentId, setExpandedAssignmentId] =
    useState<string | null>(null);

  // --------------------------------------------------
  // LOAD ASSIGNMENTS
  // --------------------------------------------------

  const loadAssignments = useCallback(async () => {
    try {
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Unable to identify the logged-in student."
        );
      }

      // Fetch assignments.
      const { data: assignmentData, error: assignmentError } =
        await supabase
          .from("assignments")
          .select("*")
          .order("created_at", { ascending: false });

      if (assignmentError) throw assignmentError;

      const assignmentRows =
        (assignmentData ?? []) as Assignment[];

      if (assignmentRows.length === 0) {
        setAssignments([]);
        return;
      }

      const classIds = [
        ...new Set(assignmentRows.map((item) => item.class_id)),
      ];

      const subjectIds = [
        ...new Set(assignmentRows.map((item) => item.subject_id)),
      ];

      const assignmentIds = assignmentRows.map((item) => item.id);

      // Fetch classes.
      const { data: classData, error: classError } =
        await supabase
          .from("classes")
          .select("id, semester")
          .in("id", classIds);

      if (classError) throw classError;

      // Fetch subjects.
      const { data: subjectData, error: subjectError } =
        await supabase
          .from("subjects")
          .select("id, name")
          .in("id", subjectIds);

      if (subjectError) throw subjectError;

      // Fetch student submissions.
      const { data: submissionData, error: submissionError } =
        await supabase
          .from("assignment_submissions")
          .select("assignment_id, status, submitted_at")
          .eq("student_id", user.id)
          .in("assignment_id", assignmentIds);

      if (submissionError) throw submissionError;

      // Lookup maps.
      const classMap = new Map(
        (classData ?? []).map((item) => [
          item.id,
          item.semester,
        ])
      );

      const subjectMap = new Map(
        (subjectData ?? []).map((item) => [
          item.id,
          item.name,
        ])
      );

      const submissionMap = new Map(
        ((submissionData ?? []) as StudentSubmission[]).map(
          (item) => [item.assignment_id, item]
        )
      );

      // Combine data.
      const formattedAssignments: AssignmentItem[] =
        assignmentRows.map((item) => {
          const submission = submissionMap.get(item.id);

          // Only an actual submitted record counts as submitted.
          const isSubmitted =
            submission?.status?.trim().toLowerCase() ===
            "submitted";

          return {
            ...item,
            subjectName:
              subjectMap.get(item.subject_id) ?? "Subject",
            semester:
              classMap.get(item.class_id) ?? null,
            submissionStatus: isSubmitted
              ? "submitted"
              : "pending",
            submittedAt:
              submission?.submitted_at ?? null,
          };
        });

      setAssignments(formattedAssignments);
    } catch (err) {
      console.error("Student assignments error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load assignments."
      );
    }
  }, []);

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await loadAssignments();
      setLoading(false);
    };

    initialize();
  }, [loadAssignments]);

  // --------------------------------------------------
  // REFRESH
  // --------------------------------------------------

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAssignments();
    setRefreshing(false);
  };

  // --------------------------------------------------
  // FILTERS
  // --------------------------------------------------

  const pendingCount = assignments.filter(
    (item) => item.submissionStatus === "pending"
  ).length;

  const submittedCount = assignments.filter(
    (item) => item.submissionStatus === "submitted"
  ).length;

  const filteredAssignments = useMemo(() => {
    if (activeFilter === "pending") {
      return assignments.filter(
        (item) => item.submissionStatus === "pending"
      );
    }

    if (activeFilter === "submitted") {
      return assignments.filter(
        (item) => item.submissionStatus === "submitted"
      );
    }

    return assignments;
  }, [assignments, activeFilter]);

  // --------------------------------------------------
  // EXPAND / COLLAPSE
  // --------------------------------------------------

  const toggleAssignment = (id: string) => {
    setExpandedAssignmentId((current) =>
      current === id ? null : id
    );
  };

  // --------------------------------------------------
  // FILTER BUTTON
  // --------------------------------------------------

  const renderFilter = (
    label: string,
    value: FilterType,
    count: number
  ) => {
    const isActive = activeFilter === value;

    return (
      <Pressable
        onPress={() => {
          setActiveFilter(value);
          setExpandedAssignmentId(null);
        }}
        style={[
          styles.filterButton,
          {
            backgroundColor: isActive
              ? colors.primary
              : colors.card,
            borderColor: isActive
              ? colors.primary
              : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.filterText,
            {
              color: isActive
                ? "#FFFFFF"
                : colors.textSecondary,
            },
          ]}
        >
          {label}
        </Text>

        <View
          style={[
            styles.filterCount,
            {
              backgroundColor: isActive
                ? "#FFFFFF25"
                : colors.background,
            },
          ]}
        >
          <Text
            style={[
              styles.filterCountText,
              {
                color: isActive
                  ? "#FFFFFF"
                  : colors.textSecondary,
              },
            ]}
          >
            {count}
          </Text>
        </View>
      </Pressable>
    );
  };

  // --------------------------------------------------
  // ASSIGNMENT CARD
  // --------------------------------------------------

  const renderAssignment = ({
    item,
  }: {
    item: AssignmentItem;
  }) => {
    const isSubmitted =
      item.submissionStatus === "submitted";

    const isExpanded =
      expandedAssignmentId === item.id;

    // Submitted is ALWAYS green.
    const statusColor = isSubmitted
      ? "#16A34A"
      : "#D97706";

    const statusBackground = isSubmitted
      ? "#16A34A18"
      : "#D9770618";

    // Overdue is red ONLY when assignment is pending.
    const dueInfo = isSubmitted
      ? {
          label: "Completed",
          color: "#16A34A",
          background: "#16A34A18",
        }
      : getDueDateInfo(item.due_date);

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        {/* CARD HEADER */}
        <Pressable
          onPress={() => toggleAssignment(item.id)}
          style={({ pressed }) => [
            styles.cardHeader,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={styles.assignmentIcon}>
            <Text style={styles.assignmentEmoji}>📝</Text>
          </View>

          <View style={styles.cardMain}>
            <Text
              style={[
                styles.subject,
                { color: colors.primary },
              ]}
            >
              {item.subjectName}
            </Text>

            <Text
              style={[
                styles.title,
                { color: colors.text },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            <Text
              style={[
                styles.semesterText,
                { color: colors.textSecondary },
              ]}
            >
              {item.semester !== null
                ? `Semester ${item.semester}`
                : "Assignment"}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusBackground },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusColor },
                ]}
              >
                {isSubmitted ? "Submitted" : "Pending"}
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

        {/* DUE DATE */}
        <View style={styles.cardDueRow}>
          <View style={styles.dueDateLeft}>
            <Text style={styles.calendarEmoji}>📅</Text>

            <View>
              <Text
                style={[
                  styles.dueLabel,
                  { color: colors.textSecondary },
                ]}
              >
                {isSubmitted ? "Submission status" : "Due date"}
              </Text>

              <Text
                style={[
                  styles.dueDate,
                  { color: colors.text },
                ]}
              >
                {isSubmitted
                  ? item.submittedAt
                    ? formatDate(item.submittedAt)
                    : "Submitted"
                  : formatDate(item.due_date)}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.dueBadge,
              { backgroundColor: dueInfo.background },
            ]}
          >
            <Text
              style={[
                styles.dueBadgeText,
                { color: dueInfo.color },
              ]}
            >
              {dueInfo.label}
            </Text>
          </View>
        </View>

        {/* EXPANDED DETAILS */}
        {isExpanded && (
          <View
            style={[
              styles.expandedContent,
              { borderTopColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text },
              ]}
            >
              Assignment Instructions
            </Text>

            <Text
              style={[
                styles.description,
                { color: colors.textSecondary },
              ]}
            >
              {item.description ||
                "No additional instructions provided."}
            </Text>

            {/* DETAILS */}
            <View
              style={[
                styles.detailsBox,
                { backgroundColor: colors.background },
              ]}
            >
              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Subject
                </Text>

                <Text
                  style={[
                    styles.detailValue,
                    { color: colors.text },
                  ]}
                >
                  {item.subjectName}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Semester
                </Text>

                <Text
                  style={[
                    styles.detailValue,
                    { color: colors.text },
                  ]}
                >
                  {item.semester ?? "—"}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Assigned on
                </Text>

                <Text
                  style={[
                    styles.detailValue,
                    { color: colors.text },
                  ]}
                >
                  {formatDate(item.created_at)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text
                  style={[
                    styles.detailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Due date
                </Text>

                <Text
                  style={[
                    styles.detailValue,
                    { color: colors.text },
                  ]}
                >
                  {formatDate(item.due_date)}
                </Text>
              </View>
            </View>

            {/* SUBMISSION STATUS */}
            <View
              style={[
                styles.submissionBox,
                { backgroundColor: statusBackground },
              ]}
            >
              <View style={styles.submissionHeader}>
                <View
                  style={[
                    styles.submissionDot,
                    { backgroundColor: statusColor },
                  ]}
                />

                <Text
                  style={[
                    styles.submissionTitle,
                    { color: statusColor },
                  ]}
                >
                  {isSubmitted
                    ? "Assignment Submitted"
                    : "Awaiting Submission"}
                </Text>
              </View>

              <Text
                style={[
                  styles.submissionDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {isSubmitted
                  ? item.submittedAt
                    ? `Submitted on ${formatDate(item.submittedAt)}.`
                    : "Your teacher has marked this assignment as submitted."
                  : "This assignment is currently marked as pending by your teacher."}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <Text
          style={[
            styles.loadingText,
            { color: colors.textSecondary },
          ]}
        >
          Loading assignments...
        </Text>
      </View>
    );
  }

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <FlatList
        data={filteredAssignments}
        renderItem={renderAssignment}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: Layout.screenHorizontal,
            paddingTop: insets.top + 20,
            paddingBottom: Spacing.xxxl,
            flexGrow: 1,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            {/* HEADER */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text
                  style={[
                    styles.eyebrow,
                    { color: colors.textSecondary },
                  ]}
                >
                  STAY ON TOP OF YOUR WORK
                </Text>

                <Text
                  style={[
                    styles.heading,
                    { color: colors.text },
                  ]}
                >
                  Assignments
                </Text>

                <Text
                  style={[
                    styles.subheading,
                    { color: colors.textSecondary },
                  ]}
                >
                  Your tasks, deadlines and submission updates.
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

            {/* SUMMARY */}
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card },
              ]}
            >
              <View style={styles.summaryItem}>
                <Text
                  style={[
                    styles.summaryNumber,
                    { color: colors.text },
                  ]}
                >
                  {assignments.length}
                </Text>

                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Total
                </Text>
              </View>

              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <View style={styles.summaryItem}>
                <Text
                  style={[
                    styles.summaryNumber,
                    { color: "#D97706" },
                  ]}
                >
                  {pendingCount}
                </Text>

                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Pending
                </Text>
              </View>

              <View
                style={[
                  styles.summaryDivider,
                  { backgroundColor: colors.border },
                ]}
              />

              <View style={styles.summaryItem}>
                <Text
                  style={[
                    styles.summaryNumber,
                    { color: "#16A34A" },
                  ]}
                >
                  {submittedCount}
                </Text>

                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Submitted
                </Text>
              </View>
            </View>

            {/* FILTERS */}
            <View style={styles.filterSection}>
              <Text
                style={[
                  styles.filterHeading,
                  { color: colors.text },
                ]}
              >
                Your Assignments
              </Text>

              <View style={styles.filterRow}>
                {renderFilter(
                  "All",
                  "all",
                  assignments.length
                )}

                {renderFilter(
                  "Pending",
                  "pending",
                  pendingCount
                )}

                {renderFilter(
                  "Submitted",
                  "submitted",
                  submittedCount
                )}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <Text style={styles.emptyEmoji}>
                {assignments.length === 0 ? "📭" : "🎉"}
              </Text>
            </View>

            <Text
              style={[
                styles.emptyTitle,
                { color: colors.text },
              ]}
            >
              {assignments.length === 0
                ? "No assignments yet"
                : activeFilter === "pending"
                  ? "All caught up!"
                  : "No submitted assignments"}
            </Text>

            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.textSecondary },
              ]}
            >
              {assignments.length === 0
                ? "Your teachers' assignments will appear here."
                : activeFilter === "pending"
                  ? "You don't have any pending assignments."
                  : "Your submitted assignments will appear here."}
            </Text>
          </View>
        }
        ListFooterComponent={
          assignments.length > 0 ? (
            <Text
              style={[
                styles.footerNote,
                { color: colors.textSecondary },
              ]}
            >
              Tap an assignment to view its full details.
            </Text>
          ) : null
        }
      />

      {/* ERROR */}
      {error ? (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: colors.card },
          ]}
        >
          <Text style={styles.errorEmoji}>⚠️</Text>

          <Text
            style={[
              styles.errorText,
              { color: colors.text },
            ]}
          >
            {error}
          </Text>

          <Pressable
            onPress={handleRefresh}
            style={[
              styles.retryButton,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    flexGrow: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 23,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 7,
  },

  heading: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  subheading: {
    fontSize: 12,
    lineHeight: 18,
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

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: 20,
    paddingVertical: 19,
    marginBottom: 27,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryNumber: {
    fontSize: 25,
    fontWeight: "800",
  },

  summaryLabel: {
    fontSize: 11,
    marginTop: 5,
  },

  summaryDivider: {
    width: 1,
    height: 35,
  },

  filterSection: {
    marginBottom: 17,
  },

  filterHeading: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },

  filterRow: {
    flexDirection: "row",
    gap: 8,
  },

  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 7,
    borderRadius: 13,
    borderWidth: 1,
    gap: 6,
  },

  filterText: {
    fontSize: 11,
    fontWeight: "700",
  },

  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },

  filterCountText: {
    fontSize: 10,
    fontWeight: "800",
  },

  card: {
    borderWidth: 1,
    borderRadius: 21,
    padding: 16,
    marginBottom: 15,
    overflow: "hidden",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  assignmentIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#3B82F618",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  assignmentEmoji: {
    fontSize: 22,
  },

  cardMain: {
    flex: 1,
    minWidth: 0,
  },

  subject: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 5,
  },

  title: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },

  semesterText: {
    fontSize: 10,
    marginTop: 5,
  },

  headerRight: {
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
    gap: 7,
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  expandIcon: {
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 22,
  },

  cardDueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 17,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#80808035",
  },

  dueDateLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  calendarEmoji: {
    fontSize: 19,
    marginRight: 10,
  },

  dueLabel: {
    fontSize: 10,
  },

  dueDate: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },

  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },

  dueBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },

  expandedContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingTop: 17,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 9,
  },

  description: {
    fontSize: 12,
    lineHeight: 20,
  },

  detailsBox: {
    borderRadius: 13,
    padding: 13,
    marginTop: 18,
    gap: 13,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailLabel: {
    fontSize: 11,
  },

  detailValue: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
    marginLeft: 12,
  },

  submissionBox: {
    padding: 13,
    borderRadius: 13,
    marginTop: 15,
  },

  submissionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  submissionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  submissionTitle: {
    fontSize: 12,
    fontWeight: "800",
  },

  submissionDescription: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },

  emptyContainer: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 68,
    height: 68,
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
    textAlign: "center",
  },

  emptySubtitle: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },

  footerNote: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
    marginBottom: 15,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    fontSize: 13,
    marginTop: 12,
  },

  errorContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "35%",
    padding: 20,
    borderRadius: 18,
    alignItems: "center",
    elevation: 5,
  },

  errorEmoji: {
    fontSize: 25,
    marginBottom: 10,
  },

  errorText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
  },

  retryButton: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 15,
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
