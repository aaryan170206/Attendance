import { supabase } from "@/lib/supabase";

export type CloudAttendanceStatus =
  | "present"
  | "absent"
  | "leftEarly"
  | "club"
  | "partial"
  | "noClass"
  | "noLab";

export type AttendanceRecordStatus =
  | CloudAttendanceStatus
  | "pending"
  | "onLeave";

export type StudentAttendanceSession = {
  session_id: string;
  session_date: string;
  session_type: "theory" | "lab";
  session_status: "open" | "closed" | "cancelled";
  closing_time: string;
  can_submit: boolean;
};

/*
 * Get attendance belonging to the
 * currently authenticated student.
 */
export async function getMyAttendance(): Promise<{
  data: {
    attendance_date: string;
    type: "theory" | "lab";
    status: AttendanceRecordStatus;
    subject_id: string;
    subject_name: string;
  }[] | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return { data: null, error: userError };
    }

    if (!user) {
      return {
        data: null,
        error: new Error("No authenticated user found."),
      };
    }

    const { data, error } = await supabase
      .from("attendance")
      .select(`
        attendance_date,
        type,
        status,
        subject_id,
        subjects (
          name
        )
      `)
      .eq("student_id", user.id)
      .order("attendance_date");

    if (error) {
      return { data: null, error };
    }

    const formattedData = (data ?? []).map((row: any) => ({
      attendance_date: row.attendance_date,
      type: row.type,
      status: row.status as AttendanceRecordStatus,
      subject_id: row.subject_id,
      subject_name: row.subjects?.name ?? "",
    }));

    return {
      data: formattedData,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Could not load attendance."),
    };
  }
}

/*
 * Get the session for a student,
 * subject, date and attendance type.
 */
export async function getStudentAttendanceSession(
  subjectId: string,
  attendanceDate: string,
  type: "theory" | "lab"
): Promise<{
  data: StudentAttendanceSession | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc(
      "get_student_attendance_session",
      {
        p_subject_id: subjectId,
        p_attendance_date: attendanceDate,
        p_type: type,
      }
    );

    if (error) {
      return { data: null, error };
    }

    const session = Array.isArray(data)
      ? data[0] ?? null
      : data;

    return {
      data: session as StudentAttendanceSession | null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Could not load attendance session."),
    };
  }
}

/*
 * Submit attendance through the
 * secure Supabase RPC.
 */
export async function submitStudentAttendance(
  sessionId: string,
  status: CloudAttendanceStatus
): Promise<{
  data: string | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.rpc(
      "submit_student_attendance",
      {
        p_session_id: sessionId,
        p_status: status,
      }
    );

    if (error) {
      return {
        data: null,
        error,
      };
    }

    return {
      data: data as string,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Could not submit attendance."),
    };
  }
}