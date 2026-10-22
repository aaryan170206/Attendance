
import { supabase } from "@/lib/supabase";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type TeacherAttendanceRecord = {
  id: string;
  student_id: string;
  subject_id: string;
  attendance_date: string;
  type: "theory" | "lab";
  session_id: string | null;
  status:
    | "present"
    | "absent"
    | "leftEarly"
    | "club"
    | "partial"
    | "noClass"
    | "noLab"
    | "onLeave"
    | "pending";
  full_name: string | null;
  roll_number: string | null;
};

export type AttendanceSession = {
  id: string;
  class_id: string;
  subject_id: string;
  attendance_date: string;
  type: "theory" | "lab";
  status: "open" | "closed" | "cancelled";
  opened_at: string;
  closed_at: string | null;
};

export type AttendanceCorrectionResult = {
  attendance_id: string;
  correction_id: string;
  old_status: string;
  new_status: string;
  corrected_at: string;
};

export type TeacherCorrectionHistoryRecord = {
  id: string;
  attendance_id: string;
  student_id: string;
  subject_id: string;
  teacher_id: string;
  attendance_date: string;
  type: "theory" | "lab";
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
  student_name: string | null;
  roll_number: string | null;
  teacher_name: string | null;
};

// --------------------------------------------------
// DATE VALIDATION
// --------------------------------------------------

function validateAttendanceDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  const formattedDate = [
    parsedDate.getFullYear(),
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
  ].join("-");

  return formattedDate === date;
}

function getLocalToday(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

// --------------------------------------------------
// OPEN ATTENDANCE SESSION
// --------------------------------------------------

export async function openAttendanceSession(
  classId: string,
  subjectId: string,
  type: "theory" | "lab"
): Promise<{
  data: string | null;
  error: Error | null;
}> {
  try {
    if (!classId.trim()) {
      throw new Error("Class ID is required.");
    }

    if (!subjectId.trim()) {
      throw new Error("Subject ID is required.");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated teacher found.");
    }

    const { data, error } = await supabase.rpc(
      "open_attendance_session",
      {
        p_class_id: classId,
        p_subject_id: subjectId,
        p_type: type,
      }
    );

    if (error) throw error;

    if (typeof data !== "string" || !data) {
      throw new Error("The session could not be opened.");
    }

    return {
      data,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to open attendance session."),
    };
  }
}


// --------------------------------------------------
// CLOSE ATTENDANCE SESSION
// --------------------------------------------------

export async function closeAttendanceSession(
  sessionId: string
): Promise<{
  data: string | null;
  error: Error | null;
}> {
  try {
    if (!sessionId.trim()) {
      throw new Error("Attendance session ID is required.");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated teacher found.");
    }

    const { data, error } = await supabase.rpc(
      "close_attendance_session",
      {
        p_session_id: sessionId,
      }
    );

    if (error) throw error;

    if (typeof data !== "string" || !data) {
      throw new Error("The attendance session could not be closed.");
    }

    return {
      data,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to close attendance session."),
    };
  }
}

// --------------------------------------------------
// GET ATTENDANCE SESSION
// --------------------------------------------------

export async function getAttendanceSession(
  classId: string,
  subjectId: string,
  attendanceDate: string,
  type: "theory" | "lab"
): Promise<{
  data: AttendanceSession | null;
  error: Error | null;
}> {
  try {
    if (!classId.trim()) {
      throw new Error("Class ID is required.");
    }

    if (!subjectId.trim()) {
      throw new Error("Subject ID is required.");
    }

    if (!validateAttendanceDate(attendanceDate)) {
      throw new Error("Invalid attendance date.");
    }

    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(`
        id,
        class_id,
        subject_id,
        attendance_date,
        type,
        status,
        opened_at,
        closed_at
      `)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .eq("attendance_date", attendanceDate)
      .eq("type", type)
      .maybeSingle();

    if (error) throw error;

    return {
      data: data as AttendanceSession | null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to retrieve attendance session."),
    };
  }
}

// --------------------------------------------------
// GET ATTENDANCE FOR A CLASS, SUBJECT AND DATE
// --------------------------------------------------

export async function getTodayTeacherAttendance(
  classId: string,
  subjectId: string,
  selectedDate?: string
): Promise<{
  data: TeacherAttendanceRecord[] | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated teacher found.");
    }

    const attendanceDate = selectedDate ?? getLocalToday();

    if (!validateAttendanceDate(attendanceDate)) {
      throw new Error("Invalid attendance date.");
    }

    // Verify teacher assignment.
    const { data: assignment, error: assignmentError } =
      await supabase
        .from("teaching_assignments")
        .select("id")
        .eq("teacher_id", user.id)
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .maybeSingle();

    if (assignmentError) throw assignmentError;

    if (!assignment) {
      throw new Error(
        "You are not assigned to this class and subject."
      );
    }

    // Fetch attendance.
    const { data: attendance, error: attendanceError } =
      await supabase
        .from("attendance")
        .select(`
          id,
          student_id,
          subject_id,
          attendance_date,
          type,
          status,
          session_id,
          student_profiles (
            roll_number,
            profiles (
              full_name
            )
          )
        `)
        .eq("subject_id", subjectId)
        .eq("attendance_date", attendanceDate)
        .order("created_at", { ascending: true });

    if (attendanceError) throw attendanceError;

    // Fetch enrolled students.
    const { data: enrollments, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId);

    if (enrollmentError) throw enrollmentError;

    const enrolledStudentIds = new Set(
      (enrollments ?? []).map((item) => item.student_id)
    );

    const records: TeacherAttendanceRecord[] = (
      attendance ?? []
    )
      .filter((item) =>
        enrolledStudentIds.has(item.student_id)
      )
      .map((item) => {
        const profile = item.student_profiles as any;

        return {
          id: item.id,
          student_id: item.student_id,
          subject_id: item.subject_id,
          attendance_date: item.attendance_date,
          type: item.type,
          session_id: item.session_id,
          status: item.status,
          full_name:
            profile?.profiles?.full_name ?? null,
          roll_number:
            profile?.roll_number ?? null,
        };
      });

    return {
      data: records,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to load attendance."),
    };
  }
}

// --------------------------------------------------
// ATTENDANCE CORRECTION
// --------------------------------------------------

export async function correctAttendance(
  attendanceId: string,
  newStatus: "present" | "absent" | "onLeave",
  reason: string
): Promise<{
  data: AttendanceCorrectionResult | null;
  error: Error | null;
}> {
  try {
    if (!attendanceId.trim()) {
      throw new Error("Attendance record ID is required.");
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      throw new Error(
        "Please provide a reason for the correction."
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated teacher found.");
    }

    const { data, error } = await supabase.rpc(
      "correct_attendance",
      {
        p_attendance_id: attendanceId,
        p_new_status: newStatus,
        p_reason: trimmedReason,
      }
    );

    if (error) throw error;

    return {
      data: data as AttendanceCorrectionResult,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to correct attendance."),
    };
  }
}

// --------------------------------------------------
// GET CORRECTION HISTORY FOR A SUBJECT AND DATE
// --------------------------------------------------

export async function getCorrectionHistory(
  classId: string,
  subjectId: string,
  selectedDate: string
): Promise<{
  data: TeacherCorrectionHistoryRecord[] | null;
  error: Error | null;
}> {
  try {
    // Verify authenticated teacher.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;

    if (!user) {
      throw new Error("No authenticated teacher found.");
    }

    // Validate selected date.
    if (!validateAttendanceDate(selectedDate)) {
      throw new Error("Invalid attendance date.");
    }

    // Verify teacher assignment to this exact class and subject.
    const { data: assignment, error: assignmentError } =
      await supabase
        .from("teaching_assignments")
        .select("id")
        .eq("teacher_id", user.id)
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .maybeSingle();

    if (assignmentError) throw assignmentError;

    if (!assignment) {
      throw new Error(
        "You are not assigned to this class and subject."
      );
    }

    // Fetch attendance IDs for the selected subject and date.
    const { data: attendance, error: attendanceError } =
      await supabase
        .from("attendance")
        .select("id, attendance_date, type, student_id")
        .eq("subject_id", subjectId)
        .eq("attendance_date", selectedDate);

    if (attendanceError) throw attendanceError;

    if (!attendance || attendance.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    // Keep only students enrolled in the selected class.
    const { data: enrollments, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId);

    if (enrollmentError) throw enrollmentError;

    const enrolledStudentIds = new Set(
      (enrollments ?? []).map((item) => item.student_id)
    );

    const validAttendance = attendance.filter((item) =>
      enrolledStudentIds.has(item.student_id)
    );

    const attendanceIds = validAttendance.map(
      (item) => item.id
    );

    if (attendanceIds.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    // Fetch correction logs for those attendance records.
    // RLS ensures the teacher can only read assigned subject history.
    const { data: logs, error: logsError } = await supabase
      .from("attendance_correction_logs")
      .select(`
        id,
        attendance_id,
        student_id,
        subject_id,
        teacher_id,
        old_status,
        new_status,
        reason,
        created_at
      `)
      .eq("subject_id", subjectId)
      .in("attendance_id", attendanceIds)
      .order("created_at", { ascending: false });

    if (logsError) throw logsError;

    if (!logs || logs.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    // Fetch student profiles.
    const studentIds = [
      ...new Set(logs.map((item) => item.student_id)),
    ];

    const { data: students, error: studentsError } =
      await supabase
        .from("student_profiles")
        .select(`
          id,
          roll_number,
          profiles (
            full_name
          )
        `)
        .in("id", studentIds);

    if (studentsError) throw studentsError;

    // Fetch teacher profiles.
    const teacherIds = [
      ...new Set(logs.map((item) => item.teacher_id)),
    ];

    const { data: teachers, error: teachersError } =
      await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);

    if (teachersError) throw teachersError;

    // Create lookup maps.
    const attendanceMap = new Map(
      validAttendance.map((item) => [item.id, item])
    );

    const studentMap = new Map(
      (students ?? []).map((item) => [
        item.id,
        {
          roll_number: item.roll_number,
          full_name:
            (item.profiles as any)?.full_name ?? null,
        },
      ])
    );

    const teacherMap = new Map(
      (teachers ?? []).map((item) => [
        item.id,
        item.full_name,
      ])
    );

    // Combine correction logs with attendance and profile details.
    const records: TeacherCorrectionHistoryRecord[] = logs
      .map((log) => {
        const attendanceRecord = attendanceMap.get(
          log.attendance_id
        );

        const student = studentMap.get(log.student_id);

        if (!attendanceRecord) return null;

        return {
          id: log.id,
          attendance_id: log.attendance_id,
          student_id: log.student_id,
          subject_id: log.subject_id,
          teacher_id: log.teacher_id,
          attendance_date: attendanceRecord.attendance_date,
          type: attendanceRecord.type,
          old_status: log.old_status,
          new_status: log.new_status,
          reason: log.reason,
          created_at: log.created_at,
          student_name: student?.full_name ?? null,
          roll_number: student?.roll_number ?? null,
          teacher_name:
            teacherMap.get(log.teacher_id) ?? null,
        };
      })
      .filter(
        (
          record
        ): record is TeacherCorrectionHistoryRecord =>
          record !== null
      );

    return {
      data: records,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to load correction history."),
    };
  }
}
