import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

import {
  createAssignment,
  deleteAssignment,
  getAssignmentCreatorNames,
  getAssignmentDetails,
  getAssignmentSubmissions,
  getMyAssignments,
  getMyTeachingAssignments,
  updateAssignment,
  updateSubmissionStatus,
} from "@/lib/teacher";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type ClassInfo = {
  id: string;
  semester: number;
  department_id: string | null;
};

type SubjectInfo = {
  id: string;
  name: string;
};

type TeachingAssignment = {
  id: string;
  class_id: string;
  subject_id: string;
  classes: ClassInfo | null;
  subjects: SubjectInfo | null;
};

type Assignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  creator_name: string;
  classes: ClassInfo | null;
  subjects: SubjectInfo | null;
};

type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  status: "pending" | "submitted";
  submitted_at: string | null;
  marked_by: string | null;
  student_profiles: {
    id: string;
    profiles: { full_name: string } | null;
  } | null;
};

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStudentName(submission: Submission) {
  return (
    submission.student_profiles?.profiles?.full_name ||
    "Unnamed student"
  );
}

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

export default function TeacherAssignments() {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [teachingAssignments, setTeachingAssignments] = useState<
    TeachingAssignment[]
  >([]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Create form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClassSubject, setSelectedClassSubject] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit form
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<Assignment | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState<Date | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // --------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("User is not logged in.");

      setCurrentUserId(user.id);

      const [teachingResult, assignmentResult] = await Promise.all([
        getMyTeachingAssignments(),
        getMyAssignments(),
      ]);

      if (teachingResult.error) throw teachingResult.error;
      if (assignmentResult.error) throw assignmentResult.error;

      const normalizedTeaching: TeachingAssignment[] = (
        teachingResult.data ?? []
      ).map((item) => ({
        id: item.id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        classes: item.classes?.[0] ?? null,
        subjects: item.subjects?.[0] ?? null,
      }));

      const assignmentRows = assignmentResult.data ?? [];

      // Fetch only creator names that the logged-in teacher is allowed to see.
      // The RPC avoids querying other teachers' profiles directly, which is
      // blocked by the profiles table RLS policies.
      const { data: profiles, error: profileError } =
        await getAssignmentCreatorNames();

      if (profileError) throw profileError;

      const teacherNames = new Map(
        (profiles ?? []).map((profile) => [
          profile.teacher_id,
          profile.full_name,
        ])
      );

      const normalizedAssignments: Assignment[] = assignmentRows.map(
        (item) => ({
          id: item.id,
          teacher_id: item.teacher_id,
          class_id: item.class_id,
          subject_id: item.subject_id,
          title: item.title,

          // Never fetch descriptions in the department-wide list.
          description: null,

          due_date: item.due_date,
          created_at: item.created_at,
          creator_name:
            teacherNames.get(item.teacher_id) ?? "Unknown teacher",
          classes: item.classes?.[0] ?? null,
          subjects: item.subjects?.[0] ?? null,
        })
      );

      setTeachingAssignments(normalizedTeaching);
      setAssignments(normalizedAssignments);
    } catch (error) {
      console.error("Assignment loading error:", error);

      Alert.alert(
        "Unable to load assignments",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --------------------------------------------------
  // LOAD SUBMISSIONS
  // --------------------------------------------------

  const loadSubmissions = async (assignment: Assignment) => {
    if (assignment.teacher_id !== currentUserId) return;

    try {
      setLoadingSubmissions(true);

      const result = await getAssignmentSubmissions(assignment.id);

      if (result.error) throw result.error;

      const normalized: Submission[] = (result.data ?? []).map((item) => {
        const student = Array.isArray(item.student_profiles)
          ? item.student_profiles[0] ?? null
          : item.student_profiles;

        const profile = student
          ? Array.isArray(student.profiles)
            ? student.profiles[0] ?? null
            : student.profiles
          : null;

        return {
          id: item.id,
          assignment_id: item.assignment_id,
          student_id: item.student_id,
          status: item.status,
          submitted_at: item.submitted_at,
          marked_by: item.marked_by,
          student_profiles: student
            ? { id: student.id, profiles: profile }
            : null,
        };
      });

      setSubmissions(normalized);
    } catch (error) {
      console.error("Submission loading error:", error);

      Alert.alert(
        "Unable to load submissions",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // --------------------------------------------------
  // OPEN ASSIGNMENT - CREATOR ONLY
  // --------------------------------------------------

  const openAssignment = async (assignment: Assignment) => {
    if (assignment.teacher_id !== currentUserId) return;

    try {
      setSubmissions([]);

      const detailsResult = await getAssignmentDetails(assignment.id);

      if (detailsResult.error) throw detailsResult.error;

      const detailedAssignment: Assignment = {
        ...assignment,
        description: detailsResult.data?.description ?? null,
      };

      setSelectedAssignment(detailedAssignment);

      await loadSubmissions(detailedAssignment);
    } catch (error) {
      console.error("Assignment details error:", error);

      Alert.alert(
        "Unable to open assignment",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  };

  // --------------------------------------------------
  // RESET FORMS
  // --------------------------------------------------

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedClassSubject("");
    setDueDate(null);
    setShowDatePicker(false);
  };

  const resetEditForm = () => {
    setEditingAssignment(null);
    setEditTitle("");
    setEditDescription("");
    setEditDueDate(null);
    setShowEditDatePicker(false);
  };

  // --------------------------------------------------
  // CREATE ASSIGNMENT
  // --------------------------------------------------

  const handleCreateAssignment = async () => {
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter an assignment title.");
      return;
    }

    if (!selectedClassSubject) {
      Alert.alert(
        "Select a class",
        "Please select an assigned class and subject."
      );
      return;
    }

    const selected = teachingAssignments.find(
      (item) =>
        `${item.class_id}_${item.subject_id}` === selectedClassSubject
    );

    if (!selected) {
      Alert.alert("Invalid selection", "Please select a valid class.");
      return;
    }

    try {
      setSaving(true);

      const result = await createAssignment({
        classId: selected.class_id,
        subjectId: selected.subject_id,
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate ? dueDate.toISOString() : null,
      });

      if (result.error) throw result.error;

      setShowCreateModal(false);
      resetForm();

      await loadData();

      Alert.alert(
        "Assignment created",
        "The assignment was created successfully."
      );
    } catch (error) {
      console.error("Assignment creation error:", error);

      Alert.alert(
        "Unable to create assignment",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // OPEN EDIT FORM
  // --------------------------------------------------

  const openEditModal = (assignment: Assignment) => {
    if (assignment.teacher_id !== currentUserId) return;

    setEditingAssignment(assignment);
    setEditTitle(assignment.title);
    setEditDescription(assignment.description ?? "");
    setEditDueDate(
      assignment.due_date ? new Date(assignment.due_date) : null
    );

    setShowEditDatePicker(false);
    setShowEditModal(true);
  };

  // --------------------------------------------------
  // UPDATE ASSIGNMENT
  // --------------------------------------------------

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return;

    if (editingAssignment.teacher_id !== currentUserId) {
      Alert.alert("Not allowed", "You can only edit your own assignments.");
      return;
    }

    if (!editTitle.trim()) {
      Alert.alert("Missing title", "Please enter an assignment title.");
      return;
    }

    try {
      setSaving(true);

      const result = await updateAssignment({
        assignmentId: editingAssignment.id,
        title: editTitle.trim(),
        description: editDescription.trim(),
        dueDate: editDueDate ? editDueDate.toISOString() : null,
      });

      if (result.error) throw result.error;

      setShowEditModal(false);
      resetEditForm();

      await loadData();

      if (selectedAssignment) {
        const updated = {
          ...selectedAssignment,
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          due_date: editDueDate ? editDueDate.toISOString() : null,
        };

        setSelectedAssignment(updated);
      }

      Alert.alert("Assignment updated", "Your assignment was updated.");
    } catch (error) {
      console.error("Assignment update error:", error);

      Alert.alert(
        "Unable to update assignment",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // DELETE ASSIGNMENT
  // --------------------------------------------------

  const handleDeleteAssignment = (assignment: Assignment) => {
    if (assignment.teacher_id !== currentUserId) {
      Alert.alert("Not allowed", "You can only delete your own assignments.");
      return;
    }

    Alert.alert(
      "Delete assignment",
      `Are you sure you want to permanently delete "${assignment.title}"?\n\nAll associated student submission records will also be deleted. This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);

              const result = await deleteAssignment(assignment.id);

              if (result.error) throw result.error;

              if (selectedAssignment?.id === assignment.id) {
                setSelectedAssignment(null);
                setSubmissions([]);
              }

              await loadData();

              Alert.alert(
                "Assignment deleted",
                "The assignment has been deleted."
              );
            } catch (error) {
              console.error("Assignment deletion error:", error);

              Alert.alert(
                "Unable to delete assignment",
                error instanceof Error ? error.message : "Please try again."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // UPDATE SUBMISSION STATUS
  // --------------------------------------------------

  const handleStatusChange = (
    submission: Submission,
    status: "pending" | "submitted"
  ) => {
    if (
      !selectedAssignment ||
      selectedAssignment.teacher_id !== currentUserId
    ) {
      return;
    }

    const action =
      status === "submitted" ? "mark as submitted" : "mark as pending";

    Alert.alert(
      "Update submission",
      `Are you sure you want to ${action} for ${getStudentName(submission)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const result = await updateSubmissionStatus(
                submission.id,
                status
              );

              if (result.error) throw result.error;

              await loadSubmissions(selectedAssignment);
            } catch (error) {
              console.error("Status update error:", error);

              Alert.alert(
                "Update failed",
                error instanceof Error ? error.message : "Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // --------------------------------------------------
  // DATE PICKERS
  // --------------------------------------------------

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (event.type === "dismissed") return;
    if (selectedDate) setDueDate(selectedDate);
  };

  const handleEditDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") setShowEditDatePicker(false);
    if (event.type === "dismissed") return;
    if (selectedDate) setEditDueDate(selectedDate);
  };

  // --------------------------------------------------
  // DASHBOARD STATISTICS
  // --------------------------------------------------

  const myAssignments = assignments.filter(
    (item) => item.teacher_id === currentUserId
  );

  const sharedAssignments = assignments.filter(
    (item) => item.teacher_id !== currentUserId
  );

  const totalAssignments = assignments.length;

  // --------------------------------------------------
  // STYLES
  // --------------------------------------------------

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
      fontSize: 30,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 7,
      marginBottom: 22,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 17,
      paddingVertical: 12,
      borderRadius: 12,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 14,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 18,
      marginBottom: 15,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "700",
      flex: 1,
    },
    subject: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 10,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 16,
    },
    detailLabel: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    detailValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 18,
      lineHeight: 21,
    },
    badge: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      marginLeft: 8,
    },
    badgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
    },
    empty: {
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 50,
      fontSize: 15,
    },
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      padding: 18,
    },
    modalCard: {
      backgroundColor: colors.background,
      borderRadius: 22,
      padding: 20,
      maxHeight: "90%",
    },
    modalTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 20,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 8,
      marginTop: 14,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 13,
      color: colors.text,
      fontSize: 15,
    },
    option: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 13,
      marginBottom: 9,
    },
    selectedOption: {
      borderColor: colors.primary,
      backgroundColor: colors.cardSecondary,
    },
    optionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    secondaryButton: {
      padding: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      marginTop: 10,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "700",
    },
    submissionCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      padding: 16,
      marginBottom: 12,
    },
    studentName: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 15,
      flex: 1,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 5,
    },
    statusButton: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      marginTop: 12,
      alignSelf: "flex-start",
    },
    statusButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 12,
    },
    backButton: {
      marginBottom: 20,
      alignSelf: "flex-start",
    },
    backText: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 15,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    editButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: "center",
    },
    deleteButton: {
      flex: 1,
      backgroundColor: "#DC2626",
      paddingVertical: 11,
      borderRadius: 10,
      alignItems: "center",
    },
    actionButtonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 13,
    },

    // Dark Academia-inspired assignment details screen
    detailsHeader: { marginBottom: 22 },
    detailsTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 25,
    },
    detailsBackButton: {
      paddingVertical: 8,
      paddingRight: 12,
    },
    detailsBackText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    detailsEyebrow: {
      color: "#C5A46D",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 9,
    },
    detailsTitle: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      lineHeight: 37,
    },
    detailsSubtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 9,
      lineHeight: 21,
    },
    detailsOwnershipBadge: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(35, 131, 95, 0.15)",
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginTop: 14,
    },
    detailsOwnershipText: {
      color: "#3C9B75",
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    detailsActionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 22,
      marginBottom: 20,
    },
    detailsEditButton: {
      flex: 1,
      backgroundColor: "#176B50",
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    detailsDeleteButton: {
      flex: 1,
      backgroundColor: "rgba(220, 38, 38, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(220, 38, 38, 0.25)",
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    detailsEditText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "800",
    },
    detailsDeleteText: {
      color: "#DC6262",
      fontSize: 13,
      fontWeight: "800",
    },
    detailsCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 19,
      padding: 19,
      marginBottom: 15,
    },
    detailsCardTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "800",
      marginBottom: 17,
    },
    detailsDescription: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 23,
    },
    detailsDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 17,
    },
    detailsDueLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    detailsDueValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "right",
      flexShrink: 1,
      marginLeft: 10,
    },
    overviewHeader: {
      marginBottom: 15,
    },
    overviewTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "800",
    },
    overviewSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 5,
    },
    overviewStats: {
      flexDirection: "row",
      gap: 9,
    },
    overviewStat: {
      flex: 1,
      backgroundColor: colors.cardSecondary,
      borderRadius: 13,
      paddingVertical: 15,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    overviewNumber: {
      color: colors.text,
      fontSize: 25,
      fontWeight: "800",
    },
    overviewLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 6,
      textAlign: "center",
    },
    submissionsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
      marginBottom: 12,
    },
    submissionsTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    submissionsCount: {
      color: "#C5A46D",
      fontSize: 11,
      fontWeight: "800",
    },
    submissionTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    submissionStudentName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      flex: 1,
    },
    submissionStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
    },
    submissionStatusText: {
      fontSize: 10,
      fontWeight: "800",
    },
    submissionDate: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 12,
    },
    submissionActionButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 14,
    },
    submissionActionText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "800",
    },
    detailsEmpty: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
      marginTop: 25,
      marginBottom: 25,
    },

    // Dark Academia-inspired assignment dashboard
    dashboardHeader: {
      marginBottom: 26,
    },
    eyebrow: {
      color: "#C5A46D",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 9,
    },
    dashboardTitle: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    dashboardSubtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 7,
    },
    createButton: {
      backgroundColor: "#176B50",
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 17,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
    },
    createButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    statsContainer: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 30,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 12,
    },
    statNumber: {
      color: colors.text,
      fontSize: 25,
      fontWeight: "800",
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      marginTop: 5,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    sectionCount: {
      color: "#C5A46D",
      fontSize: 12,
      fontWeight: "700",
    },
    assignmentCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 17,
      marginBottom: 13,
      overflow: "hidden",
    },
    assignmentCardMine: {
      borderLeftWidth: 3,
      borderLeftColor: "#23835F",
    },
    assignmentTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    assignmentTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
      flex: 1,
      lineHeight: 23,
    },
    ownershipBadge: {
      backgroundColor: "rgba(35, 131, 95, 0.15)",
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 20,
    },
    ownershipBadgeText: {
      color: "#3C9B75",
      fontSize: 10,
      fontWeight: "800",
    },
    sharedBadge: {
      backgroundColor: "rgba(197, 164, 109, 0.15)",
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 20,
    },
    sharedBadgeText: {
      color: "#C5A46D",
      fontSize: 10,
      fontWeight: "800",
    },
    assignmentSubject: {
      color: "#3C9B75",
      fontSize: 13,
      fontWeight: "700",
      marginTop: 12,
    },
    assignmentMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 17,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    assignmentMetaLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    assignmentMetaValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "right",
      flexShrink: 1,
      marginLeft: 8,
    },
    assignmentHint: {
      color: "#3C9B75",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 15,
    },
    cardActions: {
      flexDirection: "row",
      gap: 9,
      marginTop: 15,
    },
    cardActionButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },
    cardEditButton: {
      backgroundColor: "rgba(35, 131, 95, 0.15)",
    },
    cardDeleteButton: {
      backgroundColor: "rgba(220, 38, 38, 0.12)",
    },
    cardEditText: {
      color: "#3C9B75",
      fontSize: 12,
      fontWeight: "800",
    },
    cardDeleteText: {
      color: "#DC6262",
      fontSize: 12,
      fontWeight: "800",
    },
    emptyContainer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 28,
      alignItems: "center",
      marginTop: 5,
    },
    emptyIcon: {
      color: "#C5A46D",
      fontSize: 30,
      marginBottom: 12,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 8,
    },
  });

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
          Loading assignments...
        </Text>
      </View>
    );
  }

  // --------------------------------------------------
  // ASSIGNMENT DETAILS - CREATOR ONLY
  // --------------------------------------------------

  if (selectedAssignment) {
    const classInfo = selectedAssignment.classes;
    const subjectInfo = selectedAssignment.subjects;

    const submittedCount = submissions.filter(
      (item) => item.status === "submitted"
    ).length;

    const pendingCount = submissions.filter(
      (item) => item.status === "pending"
    ).length;

    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.detailsHeader}>
            <View style={styles.detailsTopRow}>
              <Pressable
                style={styles.detailsBackButton}
                onPress={() => {
                  setSelectedAssignment(null);
                  setSubmissions([]);
                }}
              >
                <Text style={styles.detailsBackText}>
                  ‹  Back to assignments
                </Text>
              </Pressable>
            </View>

            <Text style={styles.detailsEyebrow}>FACULTY WORKSPACE</Text>

            <Text style={styles.detailsTitle}>
              {selectedAssignment.title}
            </Text>

            <Text style={styles.detailsSubtitle}>
              {subjectInfo?.name ?? "Subject unavailable"} · Semester{" "}
              {classInfo?.semester ?? "—"}
            </Text>

            <View style={styles.detailsOwnershipBadge}>
              <Text style={styles.detailsOwnershipText}>
                MY ASSIGNMENT
              </Text>
            </View>

            <View style={styles.detailsActionRow}>
              <Pressable
                style={styles.detailsEditButton}
                onPress={() => openEditModal(selectedAssignment)}
              >
                <Text style={styles.detailsEditText}>Edit Assignment</Text>
              </Pressable>

              <Pressable
                style={styles.detailsDeleteButton}
                onPress={() => handleDeleteAssignment(selectedAssignment)}
              >
                <Text style={styles.detailsDeleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>

          {/* ASSIGNMENT DETAILS */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsCardTitle}>
              Assignment Details
            </Text>

            <Text style={styles.detailsDescription}>
              {selectedAssignment.description ||
                "No description provided."}
            </Text>

            <View style={styles.detailsDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailsDueLabel}>Due date</Text>

              <Text style={styles.detailsDueValue}>
                {formatDate(selectedAssignment.due_date)}
              </Text>
            </View>
          </View>

          {/* SUBMISSION OVERVIEW */}
          <View style={styles.detailsCard}>
            <View style={styles.overviewHeader}>
              <Text style={styles.overviewTitle}>
                Submission Overview
              </Text>

              <Text style={styles.overviewSubtitle}>
                Current student submission status
              </Text>
            </View>

            <View style={styles.overviewStats}>
              <View style={styles.overviewStat}>
                <Text style={styles.overviewNumber}>
                  {submissions.length}
                </Text>
                <Text style={styles.overviewLabel}>Total Students</Text>
              </View>

              <View style={styles.overviewStat}>
                <Text
                  style={[
                    styles.overviewNumber,
                    { color: "#3C9B75" },
                  ]}
                >
                  {submittedCount}
                </Text>
                <Text style={styles.overviewLabel}>Submitted</Text>
              </View>

              <View style={styles.overviewStat}>
                <Text
                  style={[
                    styles.overviewNumber,
                    { color: "#C5A46D" },
                  ]}
                >
                  {pendingCount}
                </Text>
                <Text style={styles.overviewLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* STUDENT SUBMISSIONS */}
          <View style={styles.submissionsHeader}>
            <Text style={styles.submissionsTitle}>
              Student Submissions
            </Text>

            <Text style={styles.submissionsCount}>
              {submissions.length}{" "}
              {submissions.length === 1 ? "STUDENT" : "STUDENTS"}
            </Text>
          </View>

          {loadingSubmissions ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginTop: 30 }}
            />
          ) : submissions.length === 0 ? (
            <Text style={styles.detailsEmpty}>
              No submission records found for this assignment.
            </Text>
          ) : (
            submissions.map((submission) => {
              const isSubmitted = submission.status === "submitted";

              return (
                <View
                  key={submission.id}
                  style={styles.submissionCard}
                >
                  <View style={styles.submissionTopRow}>
                    <Text style={styles.submissionStudentName}>
                      {getStudentName(submission)}
                    </Text>

                    <View
                      style={[
                        styles.submissionStatusBadge,
                        {
                          backgroundColor: isSubmitted
                            ? "rgba(35, 131, 95, 0.15)"
                            : "rgba(197, 164, 109, 0.16)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.submissionStatusText,
                          {
                            color: isSubmitted
                              ? "#3C9B75"
                              : "#C5A46D",
                          },
                        ]}
                      >
                        {isSubmitted ? "SUBMITTED" : "PENDING"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.submissionDate}>
                    {submission.submitted_at
                      ? `Marked on: ${formatDate(submission.submitted_at)}`
                      : "No submission date recorded"}
                  </Text>

                  <Pressable
                    style={[
                      styles.submissionActionButton,
                      {
                        backgroundColor: isSubmitted
                          ? "#B68B35"
                          : "#176B50",
                      },
                    ]}
                    onPress={() =>
                      handleStatusChange(
                        submission,
                        isSubmitted ? "pending" : "submitted"
                      )
                    }
                  >
                    <Text style={styles.submissionActionText}>
                      {isSubmitted
                        ? "Mark as Pending"
                        : "Mark as Submitted"}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* EDIT MODAL ON DETAILS SCREEN */}

        <Modal
          visible={showEditModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowEditModal(false);
            resetEditForm();
          }}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Edit Assignment</Text>

                <Text style={styles.label}>Assignment title *</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Enter assignment title"
                  placeholderTextColor={colors.textSecondary}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />

                <Text style={styles.label}>Description</Text>

                <TextInput
                  style={[
                    styles.input,
                    { minHeight: 95, textAlignVertical: "top" },
                  ]}
                  placeholder="Enter assignment instructions"
                  placeholderTextColor={colors.textSecondary}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                />

                <Text style={styles.label}>Due date (optional)</Text>

                <Pressable
                  style={styles.option}
                  onPress={() => setShowEditDatePicker(true)}
                >
                  <Text style={styles.optionText}>
                    {editDueDate
                      ? editDueDate.toLocaleDateString("en-IN")
                      : "Choose due date"}
                  </Text>
                </Pressable>

                {editDueDate ? (
                  <Pressable onPress={() => setEditDueDate(null)}>
                    <Text style={{ color: colors.primary, marginTop: 5 }}>
                      Remove due date
                    </Text>
                  </Pressable>
                ) : null}

                {showEditDatePicker ? (
                  <DateTimePicker
                    value={editDueDate ?? new Date()}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={new Date()}
                    onChange={handleEditDateChange}
                  />
                ) : null}

                {Platform.OS === "ios" && showEditDatePicker ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setShowEditDatePicker(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Done</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={[
                    styles.primaryButton,
                    {
                      alignItems: "center",
                      marginTop: 22,
                      opacity: saving ? 0.6 : 1,
                    },
                  ]}
                  disabled={saving}
                  onPress={handleUpdateAssignment}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Save Changes
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setShowEditModal(false);
                    resetEditForm();
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // --------------------------------------------------
  // MAIN ASSIGNMENT LIST
  // --------------------------------------------------

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadData}
            tintColor={colors.primary}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.dashboardHeader}>
          <Text style={styles.eyebrow}>FACULTY WORKSPACE</Text>
          <Text style={styles.dashboardTitle}>Assignments</Text>
          <Text style={styles.dashboardSubtitle}>
            Manage your assignments and track student submissions across
            your department.
          </Text>

          <Pressable
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>
              +  Create New Assignment
            </Text>
          </Pressable>
        </View>

        {/* STATISTICS */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalAssignments}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{myAssignments.length}</Text>
            <Text style={styles.statLabel}>Created by me</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{sharedAssignments.length}</Text>
            <Text style={styles.statLabel}>Shared</Text>
          </View>
        </View>

        {/* ASSIGNMENT LIST */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Assignments</Text>
          <Text style={styles.sectionCount}>
            {totalAssignments} {totalAssignments === 1 ? "ITEM" : "ITEMS"}
          </Text>
        </View>

        {assignments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>No assignments yet</Text>
            <Text style={styles.emptyDescription}>
              Assignments shared within your department will appear here.
              Create your first assignment to get started.
            </Text>
          </View>
        ) : (
          assignments.map((assignment) => {
            const classInfo = assignment.classes;
            const subjectInfo = assignment.subjects;
            const isMine = assignment.teacher_id === currentUserId;

            return (
              <View
                key={assignment.id}
                style={[
                  styles.assignmentCard,
                  isMine && styles.assignmentCardMine,
                ]}
              >
                <Pressable
                  disabled={!isMine}
                  onPress={() => openAssignment(assignment)}
                >
                  <View style={styles.assignmentTopRow}>
                    <Text style={styles.assignmentTitle}>
                      {assignment.title}
                    </Text>

                    {isMine ? (
                      <View style={styles.ownershipBadge}>
                        <Text style={styles.ownershipBadgeText}>
                          MY ASSIGNMENT
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.sharedBadge}>
                        <Text style={styles.sharedBadgeText}>SHARED</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.assignmentSubject}>
                    {subjectInfo?.name ?? "Subject unavailable"}
                  </Text>

                  <View style={styles.assignmentMetaRow}>
                    <Text style={styles.assignmentMetaLabel}>Semester</Text>
                    <Text style={styles.assignmentMetaValue}>
                      {classInfo?.semester
                        ? `Semester ${classInfo.semester}`
                        : "Not specified"}
                    </Text>
                  </View>

                  {!isMine && (
                    <View style={styles.assignmentMetaRow}>
                      <Text style={styles.assignmentMetaLabel}>
                        Created by
                      </Text>
                      <Text style={styles.assignmentMetaValue}>
                        {assignment.creator_name}
                      </Text>
                    </View>
                  )}

                  <View style={styles.assignmentMetaRow}>
                    <Text style={styles.assignmentMetaLabel}>Due date</Text>
                    <Text style={styles.assignmentMetaValue}>
                      {formatDate(assignment.due_date)}
                    </Text>
                  </View>

                  {isMine && (
                    <Text style={styles.assignmentHint}>
                      View assignment details and student submissions →
                    </Text>
                  )}
                </Pressable>

                {isMine && (
                  <View style={styles.cardActions}>
                    <Pressable
                      style={[
                        styles.cardActionButton,
                        styles.cardEditButton,
                      ]}
                      onPress={() => openEditModal(assignment)}
                    >
                      <Text style={styles.cardEditText}>
                        Edit Assignment
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.cardActionButton,
                        styles.cardDeleteButton,
                      ]}
                      onPress={() => handleDeleteAssignment(assignment)}
                    >
                      <Text style={styles.cardDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE ASSIGNMENT MODAL */}

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Create Assignment</Text>

              <Text style={styles.label}>Assignment title *</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter assignment title"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Description</Text>

              <TextInput
                style={[
                  styles.input,
                  { minHeight: 95, textAlignVertical: "top" },
                ]}
                placeholder="Enter assignment instructions"
                placeholderTextColor={colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text style={styles.label}>
                Select assigned class and subject *
              </Text>

              {teachingAssignments.length === 0 ? (
                <Text style={styles.empty}>
                  You do not have any teaching assignments.
                </Text>
              ) : (
                teachingAssignments.map((item) => {
                  const classInfo = item.classes;
                  const subjectInfo = item.subjects;
                  const value = `${item.class_id}_${item.subject_id}`;
                  const selected = selectedClassSubject === value;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.option,
                        selected && styles.selectedOption,
                      ]}
                      onPress={() => setSelectedClassSubject(value)}
                    >
                      <Text style={styles.optionText}>
                        {subjectInfo?.name ?? "Subject"} · Semester{" "}
                        {classInfo?.semester ?? "—"}
                      </Text>

                      {selected ? (
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 12,
                            marginTop: 5,
                            fontWeight: "700",
                          }}
                        >
                          Selected
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}

              <Text style={styles.label}>Due date (optional)</Text>

              <Pressable
                style={styles.option}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.optionText}>
                  {dueDate
                    ? dueDate.toLocaleDateString("en-IN")
                    : "Choose due date"}
                </Text>
              </Pressable>

              {dueDate ? (
                <Pressable onPress={() => setDueDate(null)}>
                  <Text style={{ color: colors.primary, marginTop: 5 }}>
                    Remove due date
                  </Text>
                </Pressable>
              ) : null}

              {showDatePicker ? (
                <DateTimePicker
                  value={dueDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              ) : null}

              {Platform.OS === "ios" && showDatePicker ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.secondaryButtonText}>Done</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  {
                    alignItems: "center",
                    marginTop: 22,
                    opacity: saving ? 0.6 : 1,
                  },
                ]}
                disabled={saving}
                onPress={handleCreateAssignment}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Create Assignment
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* EDIT ASSIGNMENT MODAL */}

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          resetEditForm();
        }}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Edit Assignment</Text>

              <Text style={styles.label}>Assignment title *</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter assignment title"
                placeholderTextColor={colors.textSecondary}
                value={editTitle}
                onChangeText={setEditTitle}
              />

              <Text style={styles.label}>Description</Text>

              <TextInput
                style={[
                  styles.input,
                  { minHeight: 95, textAlignVertical: "top" },
                ]}
                placeholder="Enter assignment instructions"
                placeholderTextColor={colors.textSecondary}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
              />

              <Text style={styles.label}>Due date (optional)</Text>

              <Pressable
                style={styles.option}
                onPress={() => setShowEditDatePicker(true)}
              >
                <Text style={styles.optionText}>
                  {editDueDate
                    ? editDueDate.toLocaleDateString("en-IN")
                    : "Choose due date"}
                </Text>
              </Pressable>

              {editDueDate ? (
                <Pressable onPress={() => setEditDueDate(null)}>
                  <Text style={{ color: colors.primary, marginTop: 5 }}>
                    Remove due date
                  </Text>
                </Pressable>
              ) : null}

              {showEditDatePicker ? (
                <DateTimePicker
                  value={editDueDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date()}
                  onChange={handleEditDateChange}
                />
              ) : null}

              {Platform.OS === "ios" && showEditDatePicker ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setShowEditDatePicker(false)}
                >
                  <Text style={styles.secondaryButtonText}>Done</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={[
                  styles.primaryButton,
                  {
                    alignItems: "center",
                    marginTop: 22,
                    opacity: saving ? 0.6 : 1,
                  },
                ]}
                disabled={saving}
                onPress={handleUpdateAssignment}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Changes</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setShowEditModal(false);
                  resetEditForm();
                }}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}