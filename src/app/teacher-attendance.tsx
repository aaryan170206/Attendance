
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { Calendar, DateData } from "react-native-calendars";

import {
  getMyTeacherClasses,
  getStudentsInClass,
  TeacherClass,
  TeacherClassStudent,
} from "@/services/teacherClasses";

import {
  correctAttendance,
  getCorrectionHistory,
  getTodayTeacherAttendance,
  TeacherAttendanceRecord,
  TeacherCorrectionHistoryRecord,
} from "@/services/teacherAttendance";

type CorrectionStatus = "present" | "absent" | "onLeave";

type SelectedAttendance = {
  attendanceId: string;
  studentId: string;
  type: "theory" | "lab";
};

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export default function TeacherAttendance() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const today = getLocalDateString();

  const colors = {
    background: isDark ? "#000000" : "#FFFFFF",
    card: isDark ? "#1C1C1E" : "#FFFFFF",
    text: isDark ? "#FFFFFF" : "#111111",
    secondaryText: isDark ? "#A1A1A6" : "#6B7280",
    border: isDark ? "#38383A" : "#E5E7EB",
    button: isDark ? "#0A84FF" : "#007AFF",
    buttonText: "#FFFFFF",
    separator: isDark ? "#38383A" : "#F0F0F0",
    selectedBackground: isDark ? "#263B52" : "#E8F1FF",
    inputBackground: isDark ? "#2C2C2E" : "#F9FAFB",
    danger: "#DC2626",
  };

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    null
  );

  const [selectedDate, setSelectedDate] = useState(today);

  const [attendance, setAttendance] = useState<TeacherAttendanceRecord[]>([]);
  const [students, setStudents] = useState<TeacherClassStudent[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const [correctionHistory, setCorrectionHistory] = useState<
    TeacherCorrectionHistoryRecord[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [selectedAttendance, setSelectedAttendance] =
    useState<SelectedAttendance | null>(null);

  const [newStatus, setNewStatus] = useState<CorrectionStatus | null>(null);
  const [reason, setReason] = useState("");
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(
    null
  );

  // LOAD TEACHER CLASSES

  const loadClasses = useCallback(async () => {
    setError(null);

    const result = await getMyTeacherClasses();

    if (result.error) {
      setError(result.error.message);
      setClasses([]);
      setSelectedClassId(null);
      setSelectedSubjectId(null);
      setAttendance([]);
      setStudents([]);
      setCorrectionHistory([]);
      setSelectedAttendance(null);
    } else {
      setClasses(result.data ?? []);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadClasses();
      setLoading(false);
    };

    initialize();
  }, [loadClasses]);

  // LOAD ATTENDANCE AND CORRECTION HISTORY FOR SELECTED DATE

  const loadAttendance = useCallback(async () => {
    if (!selectedClassId || !selectedSubjectId) {
      setAttendance([]);
      setStudents([]);
      setCorrectionHistory([]);
      setAttendanceError(null);
      setHistoryError(null);
      setAttendanceLoading(false);
      setHistoryLoading(false);
      return;
    }

    setAttendanceLoading(true);
    setAttendanceError(null);
    setAttendance([]);

    setHistoryLoading(true);
    setHistoryError(null);
    setCorrectionHistory([]);

    try {
      const [attendanceResult, studentsResult, historyResult] =
        await Promise.all([
          getTodayTeacherAttendance(
            selectedClassId,
            selectedSubjectId,
            selectedDate
          ),
          getStudentsInClass(selectedClassId),
          getCorrectionHistory(
            selectedClassId,
            selectedSubjectId,
            selectedDate
          ),
        ]);

      if (attendanceResult.error) {
        throw attendanceResult.error;
      }

      if (studentsResult.error) {
        throw studentsResult.error;
      }

      setAttendance(attendanceResult.data ?? []);
      setStudents(studentsResult.data ?? []);

      if (historyResult.error) {
        setCorrectionHistory([]);
        setHistoryError(historyResult.error.message);
      } else {
        setCorrectionHistory(historyResult.data ?? []);
      }
    } catch (error) {
      setAttendanceError(
        error instanceof Error
          ? error.message
          : "Unable to load attendance."
      );
    } finally {
      setAttendanceLoading(false);
      setHistoryLoading(false);
    }
  }, [selectedClassId, selectedSubjectId, selectedDate]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // CLOSE CORRECTION INTERFACE

  const closeCorrection = () => {
    setSelectedAttendance(null);
    setNewStatus(null);
    setReason("");
    setCorrectionError(null);
    setCorrectionSuccess(null);
  };

  // DATE SELECTION

  const handleDateSelection = (day: DateData) => {
    if (day.dateString > today) return;

    closeCorrection();
    setSelectedDate(day.dateString);
  };

  // REFRESH

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadClasses();

      if (selectedClassId && selectedSubjectId) {
        await loadAttendance();
      }
    } finally {
      setRefreshing(false);
    }
  };

  // CLASS SELECTION

  const handleClassSelection = (classId: string) => {
    closeCorrection();

    setSelectedClassId((currentId) => {
      if (currentId === classId) {
        setSelectedSubjectId(null);
        setAttendance([]);
        setStudents([]);
        setCorrectionHistory([]);
        return null;
      }

      setSelectedSubjectId(null);
      setAttendance([]);
      setStudents([]);
      setCorrectionHistory([]);
      return classId;
    });
  };

  // SUBJECT SELECTION

  const handleSubjectSelection = (subjectId: string) => {
    closeCorrection();

    setSelectedSubjectId((currentId) => {
      if (currentId === subjectId) {
        setAttendance([]);
        setStudents([]);
        setCorrectionHistory([]);
        return null;
      }

      setAttendance([]);
      setStudents([]);
      setCorrectionHistory([]);
      return subjectId;
    });
  };

  // STUDENT CORRECTION SELECTION

  const handleAttendanceSelection = (
    record: TeacherAttendanceRecord | undefined,
    type: "theory" | "lab",
    studentId: string
  ) => {
    if (!record) return;

    if (selectedAttendance?.attendanceId === record.id) {
      closeCorrection();
      return;
    }

    setSelectedAttendance({
      attendanceId: record.id,
      studentId,
      type,
    });

    setNewStatus(null);
    setReason("");
    setCorrectionError(null);
    setCorrectionSuccess(null);
  };

  // SAVE CORRECTION

  const handleSaveCorrection = async () => {
    if (!selectedAttendance || !newStatus) {
      setCorrectionError("Please select a new attendance status.");
      return;
    }

    if (!reason.trim()) {
      setCorrectionError("Please enter a correction reason.");
      return;
    }

    setCorrectionLoading(true);
    setCorrectionError(null);
    setCorrectionSuccess(null);

    try {
      const result = await correctAttendance(
        selectedAttendance.attendanceId,
        newStatus,
        reason
      );

      if (result.error) {
        setCorrectionError(result.error.message);
        return;
      }

      setCorrectionSuccess("Attendance corrected successfully.");

      setSelectedAttendance(null);
      setNewStatus(null);
      setReason("");

      await loadAttendance();
    } catch (error) {
      setCorrectionError(
        error instanceof Error
          ? error.message
          : "Unable to save attendance correction."
      );
    } finally {
      setCorrectionLoading(false);
    }
  };

  // FORMAT STATUS

  const formatStatus = (status: TeacherAttendanceRecord["status"]) => {
    switch (status) {
      case "leftEarly":
        return "Left Early";
      case "onLeave":
        return "On Leave";
      case "noClass":
        return "No Class";
      case "noLab":
        return "No Lab";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // FORMAT CORRECTION HISTORY STATUS

  const formatHistoryStatus = (status: string) => {
    switch (status) {
      case "leftEarly":
        return "Left Early";
      case "onLeave":
        return "On Leave";
      case "noClass":
        return "No Class";
      case "noLab":
        return "No Lab";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // FORMAT SELECTED DATE FOR DISPLAY

  const formatSelectedDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // CALENDAR THEME

  const calendarTheme = {
    backgroundColor: colors.card,
    calendarBackground: colors.card,
    textSectionTitleColor: colors.secondaryText,
    selectedDayBackgroundColor: colors.button,
    selectedDayTextColor: "#FFFFFF",
    todayTextColor: "#EC4899",
    dayTextColor: colors.text,
    textDisabledColor: isDark ? "#555555" : "#C5C7CC",
    monthTextColor: colors.text,
    arrowColor: colors.button,
    textMonthFontWeight: "700" as const,
    textDayFontWeight: "500" as const,
    textDayHeaderFontWeight: "600" as const,
  };

  // LOADING SCREEN

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.button} />
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          Loading classes...
        </Text>
      </View>
    );
  }

  // MAIN SCREEN

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={classes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.button}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            Attendance
          </Text>

          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            Select a class and subject to view attendance by date.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            {error ?? "No classes have been assigned to you yet."}
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isSelected = selectedClassId === item.id;

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
            <Text style={[styles.className, { color: colors.text }]}>
              {item.name}
            </Text>

            <Text style={[styles.details, { color: colors.secondaryText }]}>
              {[
                item.section ? `Section ${item.section}` : null,
                item.semester ? `Semester ${item.semester}` : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </Text>

            <Pressable
              style={[
                styles.button,
                { backgroundColor: colors.button },
              ]}
              onPress={() => handleClassSelection(item.id)}
            >
              <Text style={[styles.buttonText, { color: colors.buttonText }]}>
                {isSelected ? "Hide Subjects" : "View Subjects"}
              </Text>
            </Pressable>

            {isSelected && (
              <View
                style={[
                  styles.subjectList,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.subjectHeading,
                    { color: colors.secondaryText },
                  ]}
                >
                  ASSIGNED SUBJECTS
                </Text>

                {item.subjects.length === 0 ? (
                  <Text
                    style={[
                      styles.message,
                      { color: colors.secondaryText },
                    ]}
                  >
                    No subjects assigned.
                  </Text>
                ) : (
                  item.subjects.map((subject) => {
                    const isSubjectSelected =
                      selectedSubjectId === subject.id;

                    return (
                      <Pressable
                        key={subject.id}
                        onPress={() =>
                          handleSubjectSelection(subject.id)
                        }
                        style={[
                          styles.subjectItem,
                          {
                            borderBottomColor: colors.separator,
                            backgroundColor: isSubjectSelected
                              ? colors.selectedBackground
                              : "transparent",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.subjectName,
                            {
                              color: isSubjectSelected
                                ? colors.button
                                : colors.text,
                            },
                          ]}
                        >
                          {subject.name}
                        </Text>

                        {isSubjectSelected && (
                          <Text
                            style={[
                              styles.selectedMark,
                              { color: colors.button },
                            ]}
                          >
                            ✓
                          </Text>
                        )}
                      </Pressable>
                    );
                  })
                )}

                {/* ATTENDANCE FOR SELECTED SUBJECT */}

                {selectedSubjectId &&
                  item.subjects.some(
                    (subject) => subject.id === selectedSubjectId
                  ) && (
                    <View
                      style={[
                        styles.attendanceSection,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.attendanceHeading,
                          { color: colors.text },
                        ]}
                      >
                        Attendance
                      </Text>

                      {/* DATE CALENDAR */}

                      <View
                        style={[
                          styles.calendarCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarLabel,
                            { color: colors.text },
                          ]}
                        >
                          SELECT DATE
                        </Text>

                        <Calendar
                          current={selectedDate}
                          maxDate={today}
                          onDayPress={handleDateSelection}
                          markedDates={{
                            [selectedDate]: {
                              selected: true,
                              selectedColor: colors.button,
                              selectedTextColor: "#FFFFFF",
                            },
                          }}
                          theme={calendarTheme}
                          enableSwipeMonths
                          hideExtraDays={false}
                        />

                        <Text
                          style={[
                            styles.selectedDateText,
                            { color: colors.secondaryText },
                          ]}
                        >
                          Showing attendance for{" "}
                          {formatSelectedDate(selectedDate)}
                        </Text>
                      </View>

                      {attendanceLoading ? (
                        <View style={styles.attendanceMessage}>
                          <ActivityIndicator
                            size="small"
                            color={colors.button}
                          />

                          <Text
                            style={[
                              styles.message,
                              { color: colors.secondaryText },
                            ]}
                          >
                            Loading attendance...
                          </Text>
                        </View>
                      ) : attendanceError ? (
                        <Text
                          style={[
                            styles.message,
                            { color: colors.secondaryText },
                          ]}
                        >
                          {attendanceError}
                        </Text>
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.recordCount,
                              { color: colors.secondaryText },
                            ]}
                          >
                            {students.length} enrolled student(s)
                          </Text>

                          {(["theory", "lab"] as const).map((type) => {
                            const typeStudents = students.map((student) => {
                              const record = attendance.find(
                                (attendanceRecord) =>
                                  attendanceRecord.student_id ===
                                    student.student_id &&
                                  attendanceRecord.type === type
                              );

                              return { student, record };
                            });

                            return (
                              <View
                                key={type}
                                style={styles.attendanceGroup}
                              >
                                <View style={styles.groupHeader}>
                                  <View
                                    style={[
                                      styles.groupAccent,
                                      { backgroundColor: colors.button },
                                    ]}
                                  />

                                  <Text
                                    style={[
                                      styles.groupHeading,
                                      { color: colors.text },
                                    ]}
                                  >
                                    {type === "theory"
                                      ? "Theory Attendance"
                                      : "Lab Attendance"}
                                  </Text>
                                </View>

                                {typeStudents.length === 0 ? (
                                  <Text
                                    style={[
                                      styles.message,
                                      { color: colors.secondaryText },
                                    ]}
                                  >
                                    No students enrolled in this class.
                                  </Text>
                                ) : (
                                  typeStudents.map(({ student, record }) => {
                                    const isCorrectionOpen =
                                      selectedAttendance?.attendanceId ===
                                      record?.id;

                                    return (
                                      <View
                                        key={`${student.student_id}-${type}`}
                                        style={[
                                          styles.attendanceItem,
                                          {
                                            borderBottomColor:
                                              colors.separator,
                                          },
                                        ]}
                                      >
                                        <Pressable
                                          style={styles.studentInfo}
                                          disabled={
                                            !record || correctionLoading
                                          }
                                          onPress={() =>
                                            handleAttendanceSelection(
                                              record,
                                              type,
                                              student.student_id
                                            )
                                          }
                                        >
                                          <Text
                                            style={[
                                              styles.studentName,
                                              {
                                                color: record
                                                  ? colors.button
                                                  : colors.text,
                                              },
                                            ]}
                                          >
                                            {student.full_name ??
                                              "Unnamed Student"}
                                          </Text>

                                          <Text
                                            style={[
                                              styles.studentDetails,
                                              {
                                                color: colors.secondaryText,
                                              },
                                            ]}
                                          >
                                            Roll No:{" "}
                                            {student.roll_number ??
                                              "Not assigned"}
                                          </Text>
                                        </Pressable>

                                        <Pressable
                                          disabled={
                                            !record || correctionLoading
                                          }
                                          onPress={() =>
                                            handleAttendanceSelection(
                                              record,
                                              type,
                                              student.student_id
                                            )
                                          }
                                          style={[
                                            styles.statusContainer,
                                            {
                                              borderColor: isCorrectionOpen
                                                ? colors.button
                                                : colors.border,
                                              backgroundColor:
                                                colors.selectedBackground,
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.statusText,
                                              { color: colors.text },
                                            ]}
                                          >
                                            {record
                                              ? formatStatus(record.status)
                                              : "Not Submitted"}
                                          </Text>
                                        </Pressable>

                                        {isCorrectionOpen && record && (
                                          <View
                                            style={[
                                              styles.correctionCard,
                                              {
                                                backgroundColor:
                                                  colors.inputBackground,
                                                borderColor: colors.border,
                                              },
                                            ]}
                                          >
                                            <Text
                                              style={[
                                                styles.correctionTitle,
                                                { color: colors.text },
                                              ]}
                                            >
                                              Correct Attendance
                                            </Text>

                                            <Text
                                              style={[
                                                styles.correctionDetails,
                                                {
                                                  color:
                                                    colors.secondaryText,
                                                },
                                              ]}
                                            >
                                              {student.full_name} ·{" "}
                                              {type === "theory"
                                                ? "Theory"
                                                : "Lab"}
                                            </Text>

                                            <Text
                                              style={[
                                                styles.correctionLabel,
                                                { color: colors.text },
                                              ]}
                                            >
                                              Current status:{" "}
                                              {formatStatus(record.status)}
                                            </Text>

                                            <Text
                                              style={[
                                                styles.correctionLabel,
                                                { color: colors.text },
                                              ]}
                                            >
                                              Select new status
                                            </Text>

                                            <View style={styles.statusOptions}>
                                              {(
                                                [
                                                  "present",
                                                  "absent",
                                                  "onLeave",
                                                ] as const
                                              ).map((status) => (
                                                <Pressable
                                                  key={status}
                                                  onPress={() =>
                                                    setNewStatus(status)
                                                  }
                                                  style={[
                                                    styles.statusOption,
                                                    {
                                                      borderColor:
                                                        newStatus === status
                                                          ? colors.button
                                                          : colors.border,
                                                      backgroundColor:
                                                        newStatus === status
                                                          ? colors.selectedBackground
                                                          : colors.card,
                                                    },
                                                  ]}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.statusOptionText,
                                                      {
                                                        color:
                                                          newStatus === status
                                                            ? colors.button
                                                            : colors.text,
                                                      },
                                                    ]}
                                                  >
                                                    {formatStatus(status)}
                                                  </Text>
                                                </Pressable>
                                              ))}
                                            </View>

                                            <Text
                                              style={[
                                                styles.correctionLabel,
                                                { color: colors.text },
                                              ]}
                                            >
                                              Reason for correction *
                                            </Text>

                                            <TextInput
                                              value={reason}
                                              onChangeText={setReason}
                                              placeholder="Enter the reason..."
                                              placeholderTextColor={
                                                colors.secondaryText
                                              }
                                              multiline
                                              editable={!correctionLoading}
                                              style={[
                                                styles.reasonInput,
                                                {
                                                  color: colors.text,
                                                  borderColor: colors.border,
                                                  backgroundColor:
                                                    colors.card,
                                                },
                                              ]}
                                            />

                                            {correctionError && (
                                              <Text
                                                style={[
                                                  styles.feedback,
                                                  { color: colors.danger },
                                                ]}
                                              >
                                                {correctionError}
                                              </Text>
                                            )}

                                            <View style={styles.actions}>
                                              <Pressable
                                                onPress={closeCorrection}
                                                disabled={correctionLoading}
                                                style={[
                                                  styles.cancelButton,
                                                  {
                                                    borderColor: colors.border,
                                                  },
                                                ]}
                                              >
                                                <Text
                                                  style={[
                                                    styles.cancelText,
                                                    { color: colors.text },
                                                  ]}
                                                >
                                                  Cancel
                                                </Text>
                                              </Pressable>

                                              <Pressable
                                                onPress={handleSaveCorrection}
                                                disabled={correctionLoading}
                                                style={[
                                                  styles.saveButton,
                                                  {
                                                    backgroundColor:
                                                      colors.button,
                                                    opacity:
                                                      correctionLoading
                                                        ? 0.6
                                                        : 1,
                                                  },
                                                ]}
                                              >
                                                {correctionLoading ? (
                                                  <ActivityIndicator
                                                    size="small"
                                                    color="#FFFFFF"
                                                  />
                                                ) : (
                                                  <Text
                                                    style={styles.saveText}
                                                  >
                                                    Save Correction
                                                  </Text>
                                                )}
                                              </Pressable>
                                            </View>
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })
                                )}
                              </View>
                            );
                          })}

                          {/* CORRECTION HISTORY */}

                          <View style={styles.historySection}>
                            <Text
                              style={[
                                styles.historyHeading,
                                { color: colors.text },
                              ]}
                            >
                              Correction History
                            </Text>

                            <Text
                              style={[
                                styles.historySubtitle,
                                { color: colors.secondaryText },
                              ]}
                            >
                              Attendance changes for{" "}
                              {formatSelectedDate(selectedDate)}
                            </Text>

                            {historyLoading ? (
                              <View style={styles.attendanceMessage}>
                                <ActivityIndicator
                                  size="small"
                                  color={colors.button}
                                />

                                <Text
                                  style={[
                                    styles.message,
                                    { color: colors.secondaryText },
                                  ]}
                                >
                                  Loading correction history...
                                </Text>
                              </View>
                            ) : historyError ? (
                              <Text
                                style={[
                                  styles.message,
                                  { color: colors.danger },
                                ]}
                              >
                                {historyError}
                              </Text>
                            ) : correctionHistory.length === 0 ? (
                              <Text
                                style={[
                                  styles.historyEmpty,
                                  { color: colors.secondaryText },
                                ]}
                              >
                                No attendance corrections have been recorded
                                for this date.
                              </Text>
                            ) : (
                              correctionHistory.map((record) => {
                                const correctedAt = new Date(
                                  record.created_at
                                );

                                const formattedTime = Number.isNaN(
                                  correctedAt.getTime()
                                )
                                  ? record.created_at
                                  : correctedAt.toLocaleString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    });

                                return (
                                  <View
                                    key={record.id}
                                    style={[
                                      styles.historyItem,
                                      {
                                        backgroundColor: colors.card,
                                        borderColor: colors.border,
                                      },
                                    ]}
                                  >
                                    <View style={styles.historyTopRow}>
                                      <View
                                        style={styles.historyStudentBlock}
                                      >
                                        <Text
                                          style={[
                                            styles.historyStudent,
                                            { color: colors.text },
                                          ]}
                                        >
                                          {record.student_name ??
                                            "Unnamed Student"}
                                        </Text>

                                        <Text
                                          style={[
                                            styles.historyRoll,
                                            {
                                              color: colors.secondaryText,
                                            },
                                          ]}
                                        >
                                          Roll No:{" "}
                                          {record.roll_number ??
                                            "Not assigned"}
                                        </Text>
                                      </View>

                                      <Text
                                        style={[
                                          styles.historyType,
                                          { color: colors.button },
                                        ]}
                                      >
                                        {record.type === "theory"
                                          ? "Theory"
                                          : "Lab"}
                                      </Text>
                                    </View>

                                    <Text
                                      style={[
                                        styles.historyChange,
                                        { color: colors.text },
                                      ]}
                                    >
                                      {formatHistoryStatus(record.old_status)}
                                      {"  →  "}
                                      {formatHistoryStatus(record.new_status)}
                                    </Text>

                                    <Text
                                      style={[
                                        styles.historyReason,
                                        {
                                          color: colors.secondaryText,
                                        },
                                      ]}
                                    >
                                      Reason: {record.reason}
                                    </Text>

                                    <View style={styles.historyFooter}>
                                      <Text
                                        style={[
                                          styles.historyMeta,
                                          {
                                            color: colors.secondaryText,
                                          },
                                        ]}
                                      >
                                        Corrected by:{" "}
                                        {record.teacher_name ??
                                          "Unknown Teacher"}
                                      </Text>

                                      <Text
                                        style={[
                                          styles.historyMeta,
                                          {
                                            color: colors.secondaryText,
                                          },
                                        ]}
                                      >
                                        {formattedTime}
                                      </Text>
                                    </View>
                                  </View>
                                );
                              })
                            )}
                          </View>
                        </>
                      )}
                    </View>
                  )}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

// STYLES

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 68,
    paddingBottom: 35,
    flexGrow: 1,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  className: {
    fontSize: 17,
    fontWeight: "700",
  },
  details: {
    fontSize: 13,
    marginTop: 5,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 14,
  },
  buttonText: {
    fontWeight: "600",
  },
  subjectList: {
    marginTop: 14,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  subjectHeading: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subjectItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subjectName: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectedMark: {
    fontSize: 16,
    fontWeight: "700",
  },
  attendanceSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  attendanceHeading: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  calendarLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginHorizontal: 8,
    marginTop: 5,
    marginBottom: 4,
  },
  selectedDateText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  attendanceGroup: {
    marginTop: 12,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 9,
  },
  groupAccent: {
    width: 4,
    height: 20,
    borderRadius: 4,
  },
  groupHeading: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  attendanceMessage: {
    alignItems: "center",
    paddingVertical: 12,
  },
  recordCount: {
    fontSize: 12,
    marginBottom: 8,
  },
  attendanceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
    flexWrap: "wrap",
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "600",
  },
  studentDetails: {
    fontSize: 12,
    marginTop: 4,
  },
  statusContainer: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  correctionCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
  },
  correctionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  correctionDetails: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  correctionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 7,
  },
  statusOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  reasonInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: "top",
    fontSize: 14,
  },
  feedback: {
    fontSize: 12,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // CORRECTION HISTORY STYLES

  historySection: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  historyHeading: {
    fontSize: 16,
    fontWeight: "700",
  },
  historySubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  historyEmpty: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  historyItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 9,
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  historyStudentBlock: {
    flex: 1,
  },
  historyStudent: {
    fontSize: 14,
    fontWeight: "700",
  },
  historyRoll: {
    fontSize: 11,
    marginTop: 3,
  },
  historyType: {
    fontSize: 11,
    fontWeight: "700",
  },
  historyChange: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  historyReason: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  historyFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.25)",
    marginTop: 10,
    paddingTop: 8,
    gap: 4,
  },
  historyMeta: {
    fontSize: 11,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
});
