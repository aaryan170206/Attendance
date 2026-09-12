import { getMySubjects } from "@/lib/subjects";
import { supabase } from "@/lib/supabase";

export type CloudAttendanceStatus =
  | "present"
  | "absent"
  | "leftEarly"
  | "club"
  | "partial"
  | "noClass"
  | "noLab";

/*
 * Find the Supabase subject ID using
 * the subject name used by the current app.
 */
async function getSubjectId(
  subjectName: string
): Promise<{
  id: string | null;
  error: Error | null;
}> {
  try {
    const {
      data: subjects,
      error,
    } = await getMySubjects();

    if (error) {
      return {
        id: null,
        error,
      };
    }

    const subject = subjects?.find(
      (item) => item.name === subjectName
    );

    if (!subject) {
      return {
        id: null,
        error: new Error(
          `Subject "${subjectName}" was not found.`
        ),
      };
    }

    return {
      id: subject.id,
      error: null,
    };
  } catch (error) {
    return {
      id: null,
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not find subject."
            ),
    };
  }
}

/*
 * Save or update one attendance record
 * in Supabase.
 */
export async function saveAttendance(
  date: string,
  subjectName: string,
  type: "theory" | "lab",
  status: CloudAttendanceStatus
): Promise<{
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        error: userError,
      };
    }

    if (!user) {
      return {
        error: new Error(
          "No authenticated user found."
        ),
      };
    }

    const {
      id: subjectId,
      error: subjectError,
    } = await getSubjectId(subjectName);

    if (subjectError || !subjectId) {
      return {
        error:
          subjectError ??
          new Error(
            "Subject ID could not be found."
          ),
      };
    }

    const { error } =
      await supabase
        .from("attendance")
        .upsert(
          {
            student_id: user.id,
            subject_id: subjectId,
            attendance_date: date,
            type,
            status,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "student_id,subject_id,attendance_date,type",
          }
        );

    return {
      error: error ?? null,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not save attendance."
            ),
    };
  }
}

/*
 * Delete one attendance record
 * from Supabase.
 */
export async function deleteAttendance(
  date: string,
  subjectName: string,
  type: "theory" | "lab"
): Promise<{
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        error: userError,
      };
    }

    if (!user) {
      return {
        error: new Error(
          "No authenticated user found."
        ),
      };
    }

    const {
      id: subjectId,
      error: subjectError,
    } = await getSubjectId(subjectName);

    if (subjectError || !subjectId) {
      return {
        error:
          subjectError ??
          new Error(
            "Subject ID could not be found."
          ),
      };
    }

    const { error } =
      await supabase
        .from("attendance")
        .delete()
        .eq("student_id", user.id)
        .eq("subject_id", subjectId)
        .eq("attendance_date", date)
        .eq("type", type);

    return {
      error: error ?? null,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not delete attendance."
            ),
    };
  }
}

/*
 * Delete all attendance belonging
 * to the current student.
 */
export async function deleteAllAttendance(): Promise<{
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        error: userError,
      };
    }

    if (!user) {
      return {
        error: new Error(
          "No authenticated user found."
        ),
      };
    }

    const { error } =
      await supabase
        .from("attendance")
        .delete()
        .eq("student_id", user.id);

    return {
      error: error ?? null,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not delete attendance."
            ),
    };
  }
}

/*
 * Delete all attendance belonging
 * to one subject.
 */
export async function deleteSubjectAttendance(
  subjectName: string
): Promise<{
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        error: userError,
      };
    }

    if (!user) {
      return {
        error: new Error(
          "No authenticated user found."
        ),
      };
    }

    const {
      id: subjectId,
      error: subjectError,
    } = await getSubjectId(subjectName);

    if (subjectError || !subjectId) {
      return {
        error:
          subjectError ??
          new Error(
            "Subject ID could not be found."
          ),
      };
    }

    const { error } =
      await supabase
        .from("attendance")
        .delete()
        .eq("student_id", user.id)
        .eq("subject_id", subjectId);

    return {
      error: error ?? null,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not delete subject attendance."
            ),
    };
  }
}

export async function getMyAttendance(): Promise<{
  data: {
    attendance_date: string;
    type: "theory" | "lab";
    status: CloudAttendanceStatus;
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
        error: new Error(
          "No authenticated user found."
        ),
      };
    }

    const {
      data: attendanceRows,
      error: attendanceError,
    } = await supabase
      .from("attendance")
      .select(
        `
        attendance_date,
        type,
        status,
        subject_id,
        subjects (
          name
        )
        `
      )
      .eq("student_id", user.id)
      .order("attendance_date");

    if (attendanceError) {
      return {
        data: null,
        error: attendanceError,
      };
    }

    const formattedData =
      (attendanceRows ?? []).map((row: any) => ({
        attendance_date: row.attendance_date,
        type: row.type,
        status: row.status,
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
          : new Error(
              "Could not load attendance."
            ),
    };
  }
}

export async function migrateLocalAttendance(
  localAttendance: {
    [date: string]: {
      [subjectName: string]: {
        theory?: CloudAttendanceStatus;
        lab?: CloudAttendanceStatus;
      };
    };
  }
): Promise<{ error: Error | null }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return { error: userError };
    }

    if (!user) {
      return {
        error: new Error(
          "No authenticated user found."
        ),
      };
    }

    for (const date of Object.keys(localAttendance)) {
      const subjects = localAttendance[date];

      for (const subjectName of Object.keys(subjects)) {
        const record = subjects[subjectName];

        for (const type of ["theory", "lab"] as const) {
          const status = record[type];

          if (!status) {
            continue;
          }

          // These statuses don't represent an actual
          // attendance class and therefore don't need
          // to be migrated.
          if (
            status === "noClass" ||
            status === "noLab"
          ) {
            continue;
          }

          const { error } = await saveAttendance(
            date,
            subjectName,
            type,
            status
          );

          if (error) {
            console.log(
              `⚠️ Could not migrate ${subjectName} ${type} on ${date}:`,
              error
            );

            continue;
          }

          console.log(
            `✅ Migrated ${subjectName} ${type} on ${date}`
          );
        }
      }
    }

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not migrate local attendance."
            ),
    };
  }
}