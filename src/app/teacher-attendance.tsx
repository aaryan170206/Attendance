
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Calendar, DateData } from "react-native-calendars";

import { useTheme } from "@/context/ThemeContext";

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

const isDarkTheme = (background: string) => {
  const hex = background.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return false;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
};

const formatCorrectionTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function TeacherAttendance() {
  const { colors: themeColors } = useTheme();

  const isDark = isDarkTheme(themeColors.background);

  const colors = {
    background: isDark ? "#101F19" : "#F0F7F3",
    card: isDark ? "#1B3026" : "#FFFFFF",
    cardSecondary: isDark ? "#223B2E" : "#DDF0E4",
    text: isDark ? "#E8F5EC" : "#18352A",
    secondaryText: isDark ? "#A7BCAF" : "#718579",
    border: isDark ? "#345342" : "#D5E5DA",

    button: isDark ? "#A7F3D0" : "#047857",
    buttonText: isDark ? "#064E3B" : "#FFFFFF",

    separator: isDark ? "#345342" : "#E5EDE7",
    selectedBackground: isDark ? "#294536" : "#D1FAE5",
    inputBackground: isDark ? "#223B2E" : "#F0F7F3",

    danger: isDark ? "#F28B82" : "#C6534D",

    present: isDark ? "#86EFAC" : "#15803D",
    absent: isDark ? "#FCA5A5" : "#DC2626",
    leave: isDark ? "#FCD34D" : "#B45309",
  };

  const today = getLocalDateString();

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] =
    useState<string | null>(null);

  const [selectedSubjectId, setSelectedSubjectId] =
    useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState(today);

  const [attendance, setAttendance] =
    useState<TeacherAttendanceRecord[]>([]);

  const [students, setStudents] =
    useState<TeacherClassStudent[]>([]);

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] =
    useState<string | null>(null);

  const [correctionHistory, setCorrectionHistory] =
    useState<TeacherCorrectionHistoryRecord[]>([]);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [selectedAttendance, setSelectedAttendance] =
    useState<SelectedAttendance | null>(null);

  const [newStatus, setNewStatus] =
    useState<CorrectionStatus | null>(null);

  const [reason, setReason] = useState("");
  const [correctionLoading, setCorrectionLoading] = useState(false);

  const [correctionError, setCorrectionError] =
    useState<string | null>(null);

  const [correctionSuccess, setCorrectionSuccess] =
    useState<string | null>(null);

  const attendanceRequestId = useRef(0);

  // LOAD TEACHER CLASSES

  const loadClasses = useCallback(async () => {
    setError(null);

    try {
      const result = await getMyTeacherClasses();

      if (result.error) {
        throw result.error;
      }

      setClasses(result.data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load classes."
      );

      setClasses([]);
      setSelectedClassId(null);
      setSelectedSubjectId(null);
      setAttendance([]);
      setStudents([]);
      setCorrectionHistory([]);
      setSelectedAttendance(null);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await loadClasses();
      setLoading(false);
    };

    initialize();
  }, [loadClasses]);

  // LOAD ATTENDANCE AND CORRECTION HISTORY

  const loadAttendance = useCallback(async () => {
    const requestId = ++attendanceRequestId.current;

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
      const [
        attendanceResult,
        studentsResult,
        historyResult,
      ] = await Promise.all([
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

      if (requestId !== attendanceRequestId.current) {
        return;
      }

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
    } catch (err) {
      if (requestId !== attendanceRequestId.current) {
        return;
      }

      setAttendanceError(
        err instanceof Error
          ? err.message
          : "Unable to load attendance."
      );
    } finally {
      if (requestId === attendanceRequestId.current) {
        setAttendanceLoading(false);
        setHistoryLoading(false);
      }
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
      setCorrectionError(
        "Please select a new attendance status."
      );
      return;
    }

    if (!reason.trim()) {
      setCorrectionError(
        "Please enter a correction reason."
      );
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

      setCorrectionSuccess(
        "Attendance corrected successfully."
      );

      setSelectedAttendance(null);
      setNewStatus(null);
      setReason("");

      await loadAttendance();
    } catch (err) {
      setCorrectionError(
        err instanceof Error
          ? err.message
          : "Unable to save attendance correction."
      );
    } finally {
      setCorrectionLoading(false);
    }
  };

  // FORMAT ATTENDANCE STATUS

  const formatStatus = (
    status: TeacherAttendanceRecord["status"]
  ) => {
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

  // STATUS COLOUR

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return colors.present;
      case "absent":
        return colors.absent;
      case "onLeave":
        return colors.leave;
      default:
        return colors.button;
    }
  };

  // FORMAT DATE

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
    selectedDayTextColor: colors.buttonText,
    todayTextColor: "#EC4899",
    dayTextColor: colors.text,
    textDisabledColor: isDark ? "#53645A" : "#C5D1C9",
    monthTextColor: colors.text,
    arrowColor: colors.button,
    textMonthFontWeight: "700" as const,
    textDayFontWeight: "500" as const,
    textDayHeaderFontWeight: "600" as const,
  };

  const styles = createStyles(colors);

  // LOADING SCREEN

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator
            size="large"
            color={colors.button}
          />
        </View>

        <Text style={styles.loadingTitle}>
          Preparing attendance
        </Text>

        <Text style={styles.message}>
          Loading your assigned classes...
        </Text>
      </View>
    );
  }

  // MAIN SCREEN

  return (
    <FlatList
      style={styles.screen}
      data={classes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.button}
          colors={[colors.button]}
        />
      }
      ListHeaderComponent={
        <View>
          {/* HEADER */}

          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.eyebrow}>
                ATTENDFLOW  /  FACULTY
              </Text>

              <View style={styles.facultyBadge}>
                <View style={styles.badgeDot} />
                <Text style={styles.facultyBadgeText}>
                  FACULTY
                </Text>
              </View>
            </View>

            <Text style={styles.title}>
              Attendance{"\n"}
              <Text style={styles.titleAccent}>
                Management.
              </Text>
            </Text>

            <Text style={styles.subtitle}>
              Review attendance records, manage student
              attendance and maintain accurate academic records.
            </Text>
          </View>

          {/* DATE SUMMARY */}

          <View style={styles.dateSummary}>
            <View style={styles.dateIcon}>
              <Text style={styles.dateIconText}>◷</Text>
            </View>

            <View style={styles.dateSummaryContent}>
              <Text style={styles.dateSummaryLabel}>
                SELECTED DATE
              </Text>

              <Text style={styles.dateSummaryValue}>
                {formatSelectedDate(selectedDate)}
              </Text>
            </View>
          </View>

          {/* SECTION TITLE */}

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>
                TEACHING RESPONSIBILITIES
              </Text>

              <Text style={styles.sectionTitle}>
                Your Classes
              </Text>
            </View>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {classes.length}
              </Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>
                Unable to load classes
              </Text>

              <Text style={styles.errorText}>
                {error}
              </Text>

              <Pressable
                onPress={loadClasses}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>▤</Text>

          <Text style={styles.emptyTitle}>
            No classes assigned
          </Text>

          <Text style={styles.message}>
            Your assigned classes will appear here once
            they have been allocated to you.
          </Text>
        </View>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          <View style={styles.footerLine} />

          <Text style={styles.footerTitle}>
            ATTENDFLOW
          </Text>

          <Text style={styles.footerSubtitle}>
            FACULTY WORKSPACE
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const isSelected = selectedClassId === item.id;

        const selectedSubject = item.subjects.find(
          (subject) => subject.id === selectedSubjectId
        );

        const selectedSubjectHasLab =
          (selectedSubject as
            | { has_lab?: boolean }
            | undefined)?.has_lab === true;

        return (
          <View style={styles.classCard}>
            {/* CLASS HEADER */}

            <View style={styles.classHeader}>
              <View style={styles.classIdentity}>
                <View style={styles.classNumber}>
                  <Text style={styles.classNumberText}>
                    {String(classes.indexOf(item) + 1).padStart(2, "0")}
                  </Text>
                </View>

                <View style={styles.classInfo}>
                  <Text style={styles.classEyebrow}>
                    ACADEMIC CLASS
                  </Text>

                  <Text style={styles.className}>
                    {item.name}
                    {item.section ? ` - ${item.section}` : ""}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.classDetails}>
              {item.section && (
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>
                    SECTION {item.section}
                  </Text>
                </View>
              )}

              {item.semester !== null && (
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>
                    SEMESTER {item.semester}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={styles.button}
              onPress={() => handleClassSelection(item.id)}
            >
              <Text style={styles.buttonText}>
                {isSelected ? "Hide Subjects" : "View Subjects"}
              </Text>

              <Text style={styles.buttonArrow}>
                {isSelected ? "−" : "+"}
              </Text>
            </Pressable>

            {/* SUBJECT LIST */}

            {isSelected && (
              <View style={styles.subjectList}>
                <Text style={styles.subjectHeading}>
                  ASSIGNED SUBJECTS
                </Text>

                {item.subjects.length === 0 ? (
                  <Text style={styles.message}>
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
                          isSubjectSelected &&
                            styles.subjectItemSelected,
                        ]}
                      >
                        <View style={styles.subjectItemLeft}>
                          <View
                            style={[
                              styles.subjectDot,
                              isSubjectSelected &&
                                styles.subjectDotSelected,
                            ]}
                          />

                          <Text
                            style={[
                              styles.subjectName,
                              isSubjectSelected &&
                                styles.subjectNameSelected,
                            ]}
                          >
                            {subject.name}
                          </Text>
                        </View>

                        {isSubjectSelected && (
                          <Text style={styles.selectedMark}>
                            ✓
                          </Text>
                        )}
                      </Pressable>
                    );
                  })
                )}

                {/* SELECTED SUBJECT ATTENDANCE */}

                {selectedSubjectId &&
                  item.subjects.some(
                    (subject) =>
                      subject.id === selectedSubjectId
                  ) && (
                    <View style={styles.attendanceSection}>
                      <View style={styles.attendanceSectionHeader}>
                        <View>
                          <Text style={styles.sectionEyebrow}>
                            ATTENDANCE RECORDS
                          </Text>

                          <Text style={styles.attendanceHeading}>
                            Attendance Details
                          </Text>
                        </View>

                        <View style={styles.attendanceIcon}>
                          <Text style={styles.attendanceIconText}>
                            ✓
                          </Text>
                        </View>
                      </View>

                      {/* CALENDAR */}

                      <View style={styles.calendarCard}>
                        <Text style={styles.calendarLabel}>
                          SELECT ATTENDANCE DATE
                        </Text>

                        <Calendar
                          key={`${colors.background}-${selectedDate}`}
                          current={selectedDate}
                          maxDate={today}
                          onDayPress={handleDateSelection}
                          markedDates={{
                            [selectedDate]: {
                              selected: true,
                              selectedColor: colors.button,
                              selectedTextColor: colors.buttonText,
                            },
                          }}
                          theme={calendarTheme}
                          enableSwipeMonths
                          hideExtraDays={false}
                        />

                        <View style={styles.calendarFooter}>
                          <View style={styles.calendarFooterDot} />

                          <Text style={styles.selectedDateText}>
                            {formatSelectedDate(selectedDate)}
                          </Text>
                        </View>
                      </View>

                      {/* SUCCESS MESSAGE */}

                      {correctionSuccess && (
                        <View style={styles.successCard}>
                          <Text style={styles.successText}>
                            ✓ {correctionSuccess}
                          </Text>
                        </View>
                      )}

                      {/* ATTENDANCE LOADING / ERROR */}

                      {attendanceLoading ? (
                        <View style={styles.attendanceMessage}>
                          <ActivityIndicator
                            size="small"
                            color={colors.button}
                          />

                          <Text style={styles.message}>
                            Loading attendance...
                          </Text>
                        </View>
                      ) : attendanceError ? (
                        <View style={styles.errorCard}>
                          <Text style={styles.errorText}>
                            {attendanceError}
                          </Text>

                          <Pressable
                            onPress={loadAttendance}
                            style={styles.retryButton}
                          >
                            <Text style={styles.retryText}>
                              Retry
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <>
                          <View style={styles.recordSummary}>
                            <Text style={styles.recordCount}>
                              {students.length} enrolled student(s)
                            </Text>
                          </View>

                          {/* THEORY AND LAB */}

                          {(["theory", "lab"] as const)
                            .filter(
                              (type) =>
                                type === "theory" ||
                                selectedSubjectHasLab
                            )
                            .map((type) => {
                              const typeStudents = students.map(
                                (student) => {
                                  const record = attendance.find(
                                    (attendanceRecord) =>
                                      attendanceRecord.student_id ===
                                        student.student_id &&
                                      attendanceRecord.type === type
                                  );

                                  return { student, record };
                                }
                              );

                              return (
                                <View
                                  key={type}
                                  style={styles.attendanceGroup}
                                >
                                  <View style={styles.groupHeader}>
                                    <View style={styles.groupHeaderLeft}>
                                      <View style={styles.groupAccent} />

                                      <View>
                                        <Text style={styles.groupEyebrow}>
                                          {type === "theory"
                                            ? "LECTURE RECORDS"
                                            : "PRACTICAL RECORDS"}
                                        </Text>

                                        <Text style={styles.groupHeading}>
                                          {type === "theory"
                                            ? "Theory Attendance"
                                            : "Lab Attendance"}
                                        </Text>
                                      </View>
                                    </View>

                                    <View style={styles.groupCount}>
                                      <Text style={styles.groupCountText}>
                                        {typeStudents.length}
                                      </Text>
                                    </View>
                                  </View>

                                  {typeStudents.length === 0 ? (
                                    <Text style={styles.message}>
                                      No students enrolled in this class.
                                    </Text>
                                  ) : (
                                    typeStudents.map(
                                      ({ student, record }) => {
                                        const isCorrectionOpen =
                                          selectedAttendance?.attendanceId ===
                                          record?.id;

                                        return (
                                          <View
                                            key={`${student.student_id}-${type}`}
                                            style={styles.attendanceItem}
                                          >
                                            <Pressable
                                              style={styles.studentInfo}
                                              disabled={
                                                !record ||
                                                correctionLoading
                                              }
                                              onPress={() =>
                                                handleAttendanceSelection(
                                                  record,
                                                  type,
                                                  student.student_id
                                                )
                                              }
                                            >
                                              <View
                                                style={styles.studentAvatar}
                                              >
                                                <Text
                                                  style={
                                                    styles.studentAvatarText
                                                  }
                                                >
                                                  {(student.full_name || "S")
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                                </Text>
                                              </View>

                                              <View style={styles.studentText}>
                                                <Text
                                                  style={styles.studentName}
                                                >
                                                  {student.full_name ??
                                                    "Unnamed Student"}
                                                </Text>

                                                <Text
                                                  style={styles.studentDetails}
                                                >
                                                  Roll No:{" "}
                                                  {student.roll_number ??
                                                    "Not assigned"}
                                                </Text>
                                              </View>
                                            </Pressable>

                                            <Pressable
                                              disabled={
                                                !record ||
                                                correctionLoading
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
                                                  borderColor: record
                                                    ? getStatusColor(
                                                        record.status
                                                      )
                                                    : colors.border,
                                                },
                                              ]}
                                            >
                                              <View
                                                style={[
                                                  styles.statusDot,
                                                  {
                                                    backgroundColor: record
                                                      ? getStatusColor(
                                                          record.status
                                                        )
                                                      : colors.secondaryText,
                                                  },
                                                ]}
                                              />

                                              <Text
                                                style={[
                                                  styles.statusText,
                                                  {
                                                    color: record
                                                      ? getStatusColor(
                                                          record.status
                                                        )
                                                      : colors.secondaryText,
                                                  },
                                                ]}
                                              >
                                                {record
                                                  ? formatStatus(record.status)
                                                  : "Not Submitted"}
                                              </Text>
                                            </Pressable>

                                            {/* CORRECTION PANEL */}

                                            {isCorrectionOpen && record && (
                                              <View
                                                style={styles.correctionCard}
                                              >
                                                <View
                                                  style={
                                                    styles.correctionHeader
                                                  }
                                                >
                                                  <View>
                                                    <Text
                                                      style={
                                                        styles.correctionTitle
                                                      }
                                                    >
                                                      Correct Attendance
                                                    </Text>

                                                    <Text
                                                      style={
                                                        styles.correctionDetails
                                                      }
                                                    >
                                                      {student.full_name} ·{" "}
                                                      {type === "theory"
                                                        ? "Theory"
                                                        : "Lab"}
                                                    </Text>
                                                  </View>

                                                  <Pressable
                                                    onPress={closeCorrection}
                                                    style={styles.closeButton}
                                                  >
                                                    <Text
                                                      style={styles.closeButtonText}
                                                    >
                                                      ×
                                                    </Text>
                                                  </Pressable>
                                                </View>

                                                <View
                                                  style={styles.currentStatusBox}
                                                >
                                                  <Text
                                                    style={
                                                      styles.currentStatusLabel
                                                    }
                                                  >
                                                    CURRENT STATUS
                                                  </Text>

                                                  <Text
                                                    style={[
                                                      styles.currentStatusValue,
                                                      {
                                                        color: getStatusColor(
                                                          record.status
                                                        ),
                                                      },
                                                    ]}
                                                  >
                                                    {formatStatus(record.status)}
                                                  </Text>
                                                </View>

                                                <Text
                                                  style={
                                                    styles.correctionLabel
                                                  }
                                                >
                                                  SELECT NEW STATUS
                                                </Text>

                                                <View
                                                  style={styles.statusOptions}
                                                >
                                                  {(
                                                    [
                                                      "present",
                                                      "absent",
                                                      "onLeave",
                                                    ] as const
                                                  ).map((status) => {
                                                    const selected =
                                                      newStatus === status;

                                                    const statusColor =
                                                      getStatusColor(status);

                                                    return (
                                                      <Pressable
                                                        key={status}
                                                        onPress={() =>
                                                          setNewStatus(status)
                                                        }
                                                        style={[
                                                          styles.statusOption,
                                                          selected && {
                                                            borderColor:
                                                              statusColor,
                                                            backgroundColor:
                                                              colors.selectedBackground,
                                                          },
                                                        ]}
                                                      >
                                                        <View
                                                          style={[
                                                            styles.statusOptionDot,
                                                            {
                                                              backgroundColor:
                                                                statusColor,
                                                            },
                                                          ]}
                                                        />

                                                        <Text
                                                          style={[
                                                            styles.statusOptionText,
                                                            selected && {
                                                              color:
                                                                statusColor,
                                                            },
                                                          ]}
                                                        >
                                                          {formatStatus(status)}
                                                        </Text>
                                                      </Pressable>
                                                    );
                                                  })}
                                                </View>

                                                <Text
                                                  style={
                                                    styles.correctionLabel
                                                  }
                                                >
                                                  REASON FOR CORRECTION *
                                                </Text>

                                                <TextInput
                                                  value={reason}
                                                  onChangeText={setReason}
                                                  placeholder="Enter the reason..."
                                                  placeholderTextColor={
                                                    colors.secondaryText
                                                  }
                                                  multiline
                                                  editable={
                                                    !correctionLoading
                                                  }
                                                  style={styles.reasonInput}
                                                />

                                                {correctionError && (
                                                  <Text
                                                    style={styles.feedback}
                                                  >
                                                    {correctionError}
                                                  </Text>
                                                )}

                                                <View
                                                  style={styles.actions}
                                                >
                                                  <Pressable
                                                    onPress={closeCorrection}
                                                    disabled={
                                                      correctionLoading
                                                    }
                                                    style={styles.cancelButton}
                                                  >
                                                    <Text
                                                      style={styles.cancelText}
                                                    >
                                                      Cancel
                                                    </Text>
                                                  </Pressable>

                                                  <Pressable
                                                    onPress={
                                                      handleSaveCorrection
                                                    }
                                                    disabled={
                                                      correctionLoading
                                                    }
                                                    style={[
                                                      styles.saveButton,
                                                      {
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
                                                        color={
                                                          colors.buttonText
                                                        }
                                                      />
                                                    ) : (
                                                      <Text
                                                        style={
                                                          styles.saveText
                                                        }
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
                                      }
                                    )
                                  )}
                                </View>
                              );
                            })}

                          {/* CORRECTION HISTORY */}

                          <View style={styles.historySection}>
                            <View style={styles.historyHeader}>
                              <View>
                                <Text style={styles.sectionEyebrow}>
                                  AUDIT TRAIL
                                </Text>

                                <Text style={styles.historyHeading}>
                                  Correction History
                                </Text>
                              </View>

                              <View style={styles.historyIcon}>
                                <Text style={styles.historyIconText}>
                                  ↺
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.historySubtitle}>
                              Attendance changes for{" "}
                              {formatSelectedDate(selectedDate)}
                            </Text>

                            {historyLoading ? (
                              <View style={styles.attendanceMessage}>
                                <ActivityIndicator
                                  size="small"
                                  color={colors.button}
                                />

                                <Text style={styles.message}>
                                  Loading correction history...
                                </Text>
                              </View>
                            ) : historyError ? (
                              <Text style={styles.historyError}>
                                {historyError}
                              </Text>
                            ) : correctionHistory.length === 0 ? (
                              <View style={styles.historyEmptyCard}>
                                <Text style={styles.historyEmptyIcon}>
                                  ◷
                                </Text>

                                <Text style={styles.historyEmpty}>
                                  No attendance corrections have been
                                  recorded for this date.
                                </Text>
                              </View>
                            ) : (
                              correctionHistory.map((record) => {
                                  const formattedTime = formatCorrectionTimestamp(
                                    record.created_at
                                  );


                                return (
                                  <View
                                    key={record.id}
                                    style={styles.historyItem}
                                  >
                                    <View style={styles.historyTopRow}>
                                      <View
                                        style={styles.historyStudentBlock}
                                      >
                                        <Text
                                          style={styles.historyStudent}
                                        >
                                          {record.student_name ??
                                            "Unnamed Student"}
                                        </Text>

                                        <Text style={styles.historyRoll}>
                                          Roll No:{" "}
                                          {record.roll_number ??
                                            "Not assigned"}
                                        </Text>
                                      </View>

                                      <View style={styles.historyTypeBadge}>
                                        <Text style={styles.historyType}>
                                          {record.type === "theory"
                                            ? "THEORY"
                                            : "LAB"}
                                        </Text>
                                      </View>
                                    </View>

                                    <View style={styles.historyChangeBox}>
                                      <Text
                                        style={[
                                          styles.historyChangeOld,
                                          {
                                            color: getStatusColor(
                                              record.old_status
                                            ),
                                          },
                                        ]}
                                      >
                                        {formatHistoryStatus(
                                          record.old_status
                                        )}
                                      </Text>

                                      <Text style={styles.historyArrow}>
                                        →
                                      </Text>

                                      <Text
                                        style={[
                                          styles.historyChangeNew,
                                          {
                                            color: getStatusColor(
                                              record.new_status
                                            ),
                                          },
                                        ]}
                                      >
                                        {formatHistoryStatus(
                                          record.new_status
                                        )}
                                      </Text>
                                    </View>

                                    <Text style={styles.historyReason}>
                                      Reason: {record.reason}
                                    </Text>

                                    <View style={styles.historyFooter}>
                                      <Text style={styles.historyMeta}>
                                        Corrected by:{" "}
                                        {record.teacher_name ??
                                          "Unknown Teacher"}
                                      </Text>

                                      <Text style={styles.historyMeta}>
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

// EMERALD GREEN STYLES

const createStyles = (colors: {
  background: string;
  card: string;
  cardSecondary: string;
  text: string;
  secondaryText: string;
  border: string;
  button: string;
  buttonText: string;
  separator: string;
  selectedBackground: string;
  inputBackground: string;
  danger: string;
  present: string;
  absent: string;
  leave: string;
}) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },

    container: {
      paddingHorizontal: 20,
      paddingTop: 68,
      paddingBottom: 40,
      flexGrow: 1,
    },

    // HEADER

    header: {
      marginBottom: 25,
    },

    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 25,
    },

    eyebrow: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.8,
      color: colors.button,
    },

    facultyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.selectedBackground,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 6,
    },

    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.button,
    },

    facultyBadgeText: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
      color: colors.button,
    },

    title: {
      fontSize: 36,
      lineHeight: 42,
      fontWeight: "900",
      letterSpacing: -1,
      color: colors.text,
    },

    titleAccent: {
      fontWeight: "500",
      color: colors.button,
    },

    subtitle: {
      fontSize: 13,
      lineHeight: 21,
      color: colors.secondaryText,
      marginTop: 12,
      maxWidth: 310,
    },

    // DATE SUMMARY

    dateSummary: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.selectedBackground,
      borderRadius: 13,
      padding: 15,
      marginBottom: 30,
      gap: 12,
    },

    dateIcon: {
      width: 43,
      height: 43,
      borderRadius: 11,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },

    dateIconText: {
      fontSize: 23,
      color: colors.button,
    },

    dateSummaryContent: {
      flex: 1,
    },

    dateSummaryLabel: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.3,
      color: colors.secondaryText,
      marginBottom: 5,
    },

    dateSummaryValue: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },

    // SECTION HEADERS

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    sectionEyebrow: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.4,
      color: colors.button,
      marginBottom: 5,
    },

    sectionTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.text,
    },

    countBadge: {
      width: 35,
      height: 35,
      borderRadius: 10,
      backgroundColor: colors.selectedBackground,
      justifyContent: "center",
      alignItems: "center",
    },

    countBadgeText: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.button,
    },

    // CLASS CARD

    classCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 15,
      padding: 16,
      marginBottom: 15,
      overflow: "hidden",
    },

    classHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    classIdentity: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    classNumber: {
      width: 43,
      height: 43,
      borderRadius: 12,
      backgroundColor: colors.selectedBackground,
      justifyContent: "center",
      alignItems: "center",
    },

    classNumberText: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.button,
    },

    classInfo: {
      flex: 1,
      marginLeft: 12,
    },

    classEyebrow: {
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.2,
      color: colors.secondaryText,
      marginBottom: 5,
    },

    className: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.text,
    },

    classDetails: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
      marginTop: 14,
    },

    detailBadge: {
      backgroundColor: colors.cardSecondary,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 5,
    },

    detailBadgeText: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.6,
      color: colors.button,
    },

    button: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.button,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 9,
      marginTop: 16,
    },

    buttonText: {
      fontSize: 12,
      fontWeight: "900",
      color: colors.buttonText,
    },

    buttonArrow: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.buttonText,
    },

    // SUBJECTS

    subjectList: {
      marginTop: 19,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },

    subjectHeading: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.3,
      color: colors.secondaryText,
      marginBottom: 10,
    },

    subjectItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 13,
      paddingHorizontal: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      borderRadius: 8,
    },

    subjectItemSelected: {
      backgroundColor: colors.selectedBackground,
      borderBottomColor: colors.selectedBackground,
    },

    subjectItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
    },

    subjectDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.secondaryText,
    },

    subjectDotSelected: {
      backgroundColor: colors.button,
    },

    subjectName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
    },

    subjectNameSelected: {
      color: colors.button,
      fontWeight: "900",
    },

    selectedMark: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.button,
    },

    // ATTENDANCE SECTION

    attendanceSection: {
      marginTop: 20,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    attendanceSectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    attendanceHeading: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.text,
    },

    attendanceIcon: {
      width: 37,
      height: 37,
      borderRadius: 11,
      backgroundColor: colors.selectedBackground,
      justifyContent: "center",
      alignItems: "center",
    },

    attendanceIconText: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.button,
    },

    // CALENDAR

    calendarCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      padding: 10,
      marginBottom: 17,
    },

    calendarLabel: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.2,
      color: colors.secondaryText,
      marginHorizontal: 8,
      marginTop: 8,
      marginBottom: 5,
    },

    calendarFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      marginBottom: 5,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.separator,
    },

    calendarFooterDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.button,
    },

    selectedDateText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.secondaryText,
    },

    // RECORD SUMMARY

    recordSummary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },

    recordCount: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.secondaryText,
    },

    // ATTENDANCE GROUP

    attendanceGroup: {
      marginTop: 18,
    },

    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    groupHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    groupAccent: {
      width: 4,
      height: 34,
      borderRadius: 4,
      backgroundColor: colors.button,
    },

    groupEyebrow: {
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1.1,
      color: colors.secondaryText,
      marginBottom: 3,
    },

    groupHeading: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },

    groupCount: {
      minWidth: 30,
      height: 30,
      paddingHorizontal: 8,
      borderRadius: 9,
      backgroundColor: colors.selectedBackground,
      alignItems: "center",
      justifyContent: "center",
    },

    groupCountText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.button,
    },

    // STUDENT ROW

    attendanceItem: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.separator,
      gap: 10,
    },

    studentInfo: {
      flex: 1,
      minWidth: 140,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    studentAvatar: {
      width: 37,
      height: 37,
      borderRadius: 11,
      backgroundColor: colors.selectedBackground,
      alignItems: "center",
      justifyContent: "center",
    },

    studentAvatarText: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.button,
    },

    studentText: {
      flex: 1,
    },

    studentName: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },

    studentDetails: {
      fontSize: 10,
      color: colors.secondaryText,
      marginTop: 4,
    },

    statusContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: colors.cardSecondary,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },

    statusText: {
      fontSize: 10,
      fontWeight: "800",
    },

    // CORRECTION CARD

    correctionCard: {
      width: "100%",
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginTop: 9,
    },

    correctionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    correctionTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },

    correctionDetails: {
      fontSize: 11,
      color: colors.secondaryText,
      marginTop: 5,
    },

    closeButton: {
      width: 29,
      height: 29,
      borderRadius: 8,
      backgroundColor: colors.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },

    closeButtonText: {
      fontSize: 21,
      color: colors.text,
      lineHeight: 24,
    },

    currentStatusBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 11,
      borderRadius: 8,
      backgroundColor: colors.card,
      marginTop: 15,
    },

    currentStatusLabel: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.7,
      color: colors.secondaryText,
    },

    currentStatusValue: {
      fontSize: 12,
      fontWeight: "900",
    },

    correctionLabel: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.8,
      color: colors.text,
      marginTop: 16,
      marginBottom: 9,
    },

    statusOptions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    statusOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },

    statusOptionDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },

    statusOptionText: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.text,
    },

    reasonInput: {
      minHeight: 85,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      padding: 11,
      textAlignVertical: "top",
      fontSize: 13,
      color: colors.text,
      backgroundColor: colors.card,
    },

    feedback: {
      fontSize: 11,
      color: colors.danger,
      marginTop: 9,
      lineHeight: 17,
    },

    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 9,
      marginTop: 17,
    },

    cancelButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: 8,
      paddingVertical: 11,
      paddingHorizontal: 15,
    },

    cancelText: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.text,
    },

    saveButton: {
      backgroundColor: colors.button,
      borderRadius: 8,
      paddingVertical: 11,
      paddingHorizontal: 15,
      minWidth: 135,
      alignItems: "center",
      justifyContent: "center",
    },

    saveText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.buttonText,
    },

    // SUCCESS

    successCard: {
      backgroundColor: colors.selectedBackground,
      borderRadius: 9,
      padding: 12,
      marginBottom: 12,
    },

    successText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.button,
    },

    // CORRECTION HISTORY

    historySection: {
      marginTop: 27,
      paddingTop: 19,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    historyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    historyHeading: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.text,
    },

    historyIcon: {
      width: 37,
      height: 37,
      borderRadius: 10,
      backgroundColor: colors.selectedBackground,
      alignItems: "center",
      justifyContent: "center",
    },

    historyIconText: {
      fontSize: 21,
      color: colors.button,
    },

    historySubtitle: {
      fontSize: 11,
      color: colors.secondaryText,
      marginTop: 7,
      marginBottom: 12,
      lineHeight: 17,
    },

    historyEmptyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      padding: 17,
      alignItems: "center",
    },

    historyEmptyIcon: {
      fontSize: 23,
      color: colors.secondaryText,
      marginBottom: 7,
    },

    historyEmpty: {
      fontSize: 11,
      lineHeight: 18,
      textAlign: "center",
      color: colors.secondaryText,
    },

    historyError: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.danger,
    },

    historyItem: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      padding: 13,
      marginTop: 10,
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
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
    },

    historyRoll: {
      fontSize: 10,
      color: colors.secondaryText,
      marginTop: 4,
    },

    historyTypeBadge: {
      backgroundColor: colors.selectedBackground,
      borderRadius: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },

    historyType: {
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.6,
      color: colors.button,
    },

    historyChangeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 10,
      marginTop: 12,
    },

    historyChangeOld: {
      fontSize: 11,
      fontWeight: "800",
    },

    historyArrow: {
      fontSize: 14,
      color: colors.secondaryText,
    },

    historyChangeNew: {
      fontSize: 11,
      fontWeight: "900",
    },

    historyReason: {
      fontSize: 11,
      lineHeight: 18,
      color: colors.secondaryText,
      marginTop: 10,
    },

    historyFooter: {
      borderTopWidth: 1,
      borderTopColor: colors.separator,
      marginTop: 11,
      paddingTop: 9,
      gap: 5,
    },

    historyMeta: {
      fontSize: 10,
      color: colors.secondaryText,
    },

    // LOADING AND EMPTY STATES

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      backgroundColor: colors.background,
    },

    loadingIcon: {
      width: 62,
      height: 62,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 17,
    },

    loadingTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 6,
    },

    message: {
      fontSize: 12,
      lineHeight: 19,
      color: colors.secondaryText,
      textAlign: "center",
      marginTop: 7,
    },

    emptyCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      padding: 24,
      alignItems: "center",
    },

    emptyIcon: {
      fontSize: 30,
      color: colors.button,
      marginBottom: 12,
    },

    emptyTitle: {
      fontSize: 16,
      fontWeight: "900",
      color: colors.text,
    },

    // ERROR AND RETRY

    errorCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      padding: 14,
      marginBottom: 12,
    },

    errorTitle: {
      fontSize: 13,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 6,
    },

    errorText: {
      fontSize: 11,
      lineHeight: 18,
      color: colors.danger,
    },

    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.button,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 7,
      marginTop: 12,
    },

    retryText: {
      fontSize: 11,
      fontWeight: "900",
      color: colors.buttonText,
    },

    attendanceMessage: {
      alignItems: "center",
      paddingVertical: 18,
      gap: 5,
    },

    // FOOTER

    footer: {
      alignItems: "center",
      marginTop: 36,
      marginBottom: 10,
    },

    footerLine: {
      width: 43,
      height: 1,
      backgroundColor: colors.button,
      marginBottom: 13,
    },

    footerTitle: {
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 3,
      color: colors.text,
    },

    footerSubtitle: {
      fontSize: 8,
      fontWeight: "800",
      letterSpacing: 2,
      color: colors.secondaryText,
      marginTop: 5,
    },
  });
