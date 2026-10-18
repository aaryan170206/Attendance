
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

import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";

import {
  createAssignment,
  deleteAssignment,
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

type ProfileInfo = {
  full_name: string;
};

type StudentProfile = {
  id: string;
  profiles: ProfileInfo | null;
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
  student_profiles: StudentProfile | null;
};

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

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [teachingAssignments, setTeachingAssignments] = useState<
    TeachingAssignment[]
  >([]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClassSubject, setSelectedClassSubject] = useState("");

  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] =
    useState<Assignment | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState<Date | null>(null);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const [saving, setSaving] = useState(false);

  // ------------------------------------------------
  // LOAD DATA
  // ------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error("User is not logged in.");
      }

      setCurrentUserId(user.id);

      const [teachingResult, assignmentResult] = await Promise.all([
        getMyTeachingAssignments(),
        getMyAssignments(),
      ]);

      if (teachingResult.error) {
        throw teachingResult.error;
      }

      if (assignmentResult.error) {
        throw assignmentResult.error;
      }

      const normalizedTeaching: TeachingAssignment[] = (
        teachingResult.data ?? []
      ).map((item) => ({
        id: item.id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        classes: item.classes?.[0] ?? null,
        subjects: item.subjects?.[0] ?? null,
      }));

      const normalizedAssignments: Assignment[] = (
        assignmentResult.data ?? []
      ).map((item) => ({
        id: item.id,
        teacher_id: item.teacher_id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        title: item.title,
        description: item.description,
        due_date: item.due_date,
        created_at: item.created_at,
        classes: item.classes?.[0] ?? null,
        subjects: item.subjects?.[0] ?? null,
      }));

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

  // ------------------------------------------------
  // LOAD SUBMISSIONS
  // ------------------------------------------------

  const loadSubmissions = async (assignment: Assignment) => {
    try {
      setLoadingSubmissions(true);

      const result = await getAssignmentSubmissions(assignment.id);

      if (result.error) {
        throw result.error;
      }

      const normalizedSubmissions: Submission[] = (
        result.data ?? []
      ).map((item) => {
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
            ? {
                id: student.id,
                profiles: profile,
              }
            : null,
        };
      });

      setSubmissions(normalizedSubmissions);
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

  const openAssignment = async (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setSubmissions([]);
    await loadSubmissions(assignment);
  };

  // ------------------------------------------------
  // RESET CREATE FORM
  // ------------------------------------------------

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSelectedClassSubject("");
    setDueDate(null);
    setShowDatePicker(false);
  };

  // ------------------------------------------------
  // CREATE ASSIGNMENT
  // ------------------------------------------------

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

      if (result.error) {
        throw result.error;
      }

      setShowCreateModal(false);
      resetForm();

      await loadData();

      Alert.alert(
        "Assignment created",
        "The assignment was created successfully. Pending submission records are created automatically by your database trigger."
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

  // ------------------------------------------------
  // OPEN EDIT FORM
  // ------------------------------------------------

  const openEditModal = (assignment: Assignment) => {
    setEditingAssignment(assignment);

    setEditTitle(assignment.title);
    setEditDescription(assignment.description ?? "");

    setEditDueDate(
      assignment.due_date ? new Date(assignment.due_date) : null
    );

    setShowEditDatePicker(false);
    setShowEditModal(true);
  };

  const resetEditForm = () => {
    setEditingAssignment(null);
    setEditTitle("");
    setEditDescription("");
    setEditDueDate(null);
    setShowEditDatePicker(false);
  };

  // ------------------------------------------------
  // SAVE EDITED ASSIGNMENT
  // ------------------------------------------------

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) {
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

      if (result.error) {
        throw result.error;
      }

      setShowEditModal(false);
      resetEditForm();

      await loadData();

      Alert.alert(
        "Assignment updated",
        "The assignment has been updated successfully."
      );
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

  // ------------------------------------------------
  // DELETE ASSIGNMENT
  // ------------------------------------------------

  const handleDeleteAssignment = (assignment: Assignment) => {
    Alert.alert(
      "Delete assignment",
      `Are you sure you want to permanently delete "${assignment.title}"?\n\nAll associated student submission records will also be deleted. This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);

              const result = await deleteAssignment(assignment.id);

              if (result.error) {
                throw result.error;
              }

              if (selectedAssignment?.id === assignment.id) {
                setSelectedAssignment(null);
                setSubmissions([]);
              }

              await loadData();

              Alert.alert(
                "Assignment deleted",
                "The assignment and its associated submission records have been deleted."
              );
            } catch (error) {
              console.error("Assignment deletion error:", error);

              Alert.alert(
                "Unable to delete assignment",
                error instanceof Error
                  ? error.message
                  : "Please try again."
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // ------------------------------------------------
  // UPDATE SUBMISSION STATUS
  // ------------------------------------------------

  const handleStatusChange = (
    submission: Submission,
    status: "pending" | "submitted"
  ) => {
    const action =
      status === "submitted" ? "mark as submitted" : "mark as pending";

    Alert.alert(
      "Update submission",
      `Are you sure you want to ${action} for ${getStudentName(submission)}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const result = await updateSubmissionStatus(
                submission.id,
                status
              );

              if (result.error) {
                throw result.error;
              }

              if (selectedAssignment) {
                await loadSubmissions(selectedAssignment);
              }
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

  // ------------------------------------------------
  // CREATE DATE PICKER
  // ------------------------------------------------

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed") {
      return;
    }

    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  // ------------------------------------------------
  // EDIT DATE PICKER
  // ------------------------------------------------

  const handleEditDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (Platform.OS === "android") {
      setShowEditDatePicker(false);
    }

    if (event.type === "dismissed") {
      return;
    }

    if (selectedDate) {
      setEditDueDate(selectedDate);
    }
  };

  // ------------------------------------------------
  // THEME STYLES
  // ------------------------------------------------

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
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginTop: 10,
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
  });

  // ------------------------------------------------
  // LOADING SCREEN
  // ------------------------------------------------

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

  // ------------------------------------------------
  // ASSIGNMENT DETAILS / SUBMISSIONS
  // ------------------------------------------------

  if (selectedAssignment) {
    const classInfo = selectedAssignment.classes;
    const subjectInfo = selectedAssignment.subjects;

    const isOwner = selectedAssignment.teacher_id === currentUserId;

    const submittedCount = submissions.filter(
      (item) => item.status === "submitted"
    ).length;

    const pendingCount = submissions.filter(
      (item) => item.status === "pending"
    ).length;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              setSelectedAssignment(null);
              setSubmissions([]);
            }}
          >
            <Text style={styles.backText}>‹  Back to assignments</Text>
          </Pressable>

          <Text style={styles.heading}>{selectedAssignment.title}</Text>

          <Text style={styles.subtitle}>
            {subjectInfo?.name ?? "Subject unavailable"} · Semester{" "}
            {classInfo?.semester ?? "—"}
          </Text>

          {isOwner ? (
            <View style={styles.actionRow}>
              <Pressable
                style={styles.editButton}
                onPress={() => openEditModal(selectedAssignment)}
              >
                <Text style={styles.actionButtonText}>Edit Assignment</Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteAssignment(selectedAssignment)}
              >
                <Text style={styles.actionButtonText}>Delete Assignment</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.card, { marginTop: 20 }]}>
            <Text style={styles.cardTitle}>Submission Overview</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total students</Text>
              <Text style={styles.detailValue}>{submissions.length}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Submitted</Text>
              <Text style={[styles.detailValue, { color: "#22C55E" }]}>
                {submittedCount}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pending</Text>
              <Text style={[styles.detailValue, { color: "#EAB308" }]}>
                {pendingCount}
              </Text>
            </View>
          </View>

          <Text
            style={{
              color: colors.text,
              fontSize: 20,
              fontWeight: "800",
              marginTop: 10,
              marginBottom: 5,
            }}
          >
            Student Submissions
          </Text>

          {loadingSubmissions ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginTop: 30 }}
            />
          ) : submissions.length === 0 ? (
            <Text style={styles.empty}>
              No submission records found for this assignment.
            </Text>
          ) : (
            submissions.map((submission) => (
              <View key={submission.id} style={styles.submissionCard}>
                <Text style={styles.studentName}>
                  {getStudentName(submission)}
                </Text>

                <Text style={styles.statusText}>
                  Status:{" "}
                  {submission.status === "submitted"
                    ? "Submitted"
                    : "Pending"}
                </Text>

                {submission.submitted_at ? (
                  <Text style={styles.statusText}>
                    Marked on: {formatDate(submission.submitted_at)}
                  </Text>
                ) : null}

                <Pressable
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor:
                        submission.status === "submitted"
                          ? "#EAB308"
                          : "#22C55E",
                    },
                  ]}
                  onPress={() =>
                    handleStatusChange(
                      submission,
                      submission.status === "submitted"
                        ? "pending"
                        : "submitted"
                    )
                  }
                >
                  <Text style={styles.statusButtonText}>
                    {submission.status === "submitted"
                      ? "Mark as Pending"
                      : "Mark as Submitted"}
                  </Text>
                </Pressable>
              </View>
            ))
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
                    <Text
                      style={{
                        color: colors.primary,
                        marginTop: 5,
                        fontWeight: "600",
                      }}
                    >
                      Remove due date
                    </Text>
                  </Pressable>
                ) : null}

                {showEditDatePicker ? (
                  <DateTimePicker
                    value={editDueDate ?? new Date()}
                    mode="date"
                    display={
                      Platform.OS === "ios" ? "spinner" : "default"
                    }
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

  // ------------------------------------------------
  // MAIN ASSIGNMENT LIST
  // ------------------------------------------------

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
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Assignments</Text>
            <Text style={styles.subtitle}>
              Assignments shared within your department
            </Text>
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.primaryButtonText}>+ Create</Text>
          </Pressable>
        </View>

        {assignments.length === 0 ? (
          <Text style={styles.empty}>No assignments found.</Text>
        ) : (
          assignments.map((assignment) => {
            const classInfo = assignment.classes;
            const subjectInfo = assignment.subjects;

            // Ownership is based on the actual creator.
            const isMine = assignment.teacher_id === currentUserId;

            return (
              <View key={assignment.id} style={styles.card}>
                <Pressable onPress={() => openAssignment(assignment)}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Text style={styles.cardTitle}>
                      {assignment.title}
                    </Text>

                    {isMine ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Created by me</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.subject}>
                    {subjectInfo?.name ?? "Subject unavailable"}
                  </Text>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Semester</Text>
                    <Text style={styles.detailValue}>
                      {classInfo?.semester
                        ? `Semester ${classInfo.semester}`
                        : "Not specified"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due date</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(assignment.due_date)}
                    </Text>
                  </View>

                  {assignment.description ? (
                    <Text style={styles.description}>
                      {assignment.description}
                    </Text>
                  ) : null}
                </Pressable>

                {isMine ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={styles.editButton}
                      onPress={() => openEditModal(assignment)}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => handleDeleteAssignment(assignment)}
                    >
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
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
                  <Text
                    style={{
                      color: colors.primary,
                      marginTop: 5,
                      fontWeight: "600",
                    }}
                  >
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
                  <Text
                    style={{
                      color: colors.primary,
                      marginTop: 5,
                      fontWeight: "600",
                    }}
                  >
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
