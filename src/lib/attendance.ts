import AsyncStorage from "@react-native-async-storage/async-storage";

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
        subject_name:
          row.subjects?.name ?? "",
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

        for (const type of [
          "theory",
          "lab",
        ] as const) {
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

          const { error } =
            await saveAttendance(
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

/*
 * Pending attendance record for
 * offline create/update operations.
 */
type PendingAttendance = {
  date: string;
  subjectName: string;
  type: "theory" | "lab";
  status: CloudAttendanceStatus;
};

/*
 * Pending attendance record for
 * offline delete operations.
 */
type PendingAttendanceDelete = {
  date: string;
  subjectName: string;
  type: "theory" | "lab";
};

function getPendingAttendanceKey(userId: string): string {
  return `@pending_attendance_${userId}`;
}

function getPendingAttendanceDeleteKey(userId: string): string {
  return `@pending_attendance_delete_${userId}`;
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}

/*
 * Add an attendance record to the
 * offline create/update queue.
 */
export async function addPendingAttendance(
  record: PendingAttendance
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      console.log("⚠️ Cannot queue attendance without an authenticated user.");
      return;
    }

    const pendingAttendanceKey = getPendingAttendanceKey(userId);

    const savedQueue =
      await AsyncStorage.getItem(
        pendingAttendanceKey
      );

    const queue: PendingAttendance[] =
      savedQueue
        ? JSON.parse(savedQueue)
        : [];

    // Remove an older pending record for the
    // same attendance entry.
    const filteredQueue = queue.filter(
      (item) =>
        !(
          item.date === record.date &&
          item.subjectName ===
            record.subjectName &&
          item.type === record.type
        )
    );

    filteredQueue.push(record);

    await AsyncStorage.setItem(
      pendingAttendanceKey,
      JSON.stringify(filteredQueue)
    );

    console.log(
      "📦 Attendance added to offline queue"
    );
  } catch (error) {
    console.log(
      "Error adding attendance to offline queue:",
      error
    );
  }
}

/*
 * Add an attendance deletion to the
 * offline delete queue.
 */
export async function addPendingAttendanceDelete(
  record: PendingAttendanceDelete
): Promise<void> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      console.log("⚠️ Cannot queue attendance deletion without an authenticated user.");
      return;
    }

    const pendingAttendanceDeleteKey =
      getPendingAttendanceDeleteKey(userId);

    const savedQueue =
      await AsyncStorage.getItem(
        pendingAttendanceDeleteKey
      );

    const queue: PendingAttendanceDelete[] =
      savedQueue
        ? JSON.parse(savedQueue)
        : [];

    const filteredQueue = queue.filter(
      (item) =>
        !(
          item.date === record.date &&
          item.subjectName ===
            record.subjectName &&
          item.type === record.type
        )
    );

    filteredQueue.push(record);

    await AsyncStorage.setItem(
      pendingAttendanceDeleteKey,
      JSON.stringify(filteredQueue)
    );

    console.log(
      "📦 Attendance deletion added to offline queue"
    );
  } catch (error) {
    console.log(
      "Error adding attendance deletion to offline queue:",
      error
    );
  }
}

/*
 * Synchronize pending attendance
 * create/update operations.
 */
export async function syncPendingAttendance(): Promise<{
  error: Error | null;
}> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return { error: new Error("No authenticated user found.") };
    }

    const pendingAttendanceKey = getPendingAttendanceKey(userId);

    const savedQueue =
      await AsyncStorage.getItem(
        pendingAttendanceKey
      );

    if (!savedQueue) {
      return { error: null };
    }

    const queue: PendingAttendance[] =
      JSON.parse(savedQueue);

    if (queue.length === 0) {
      return { error: null };
    }

    console.log(
      `📦 Found ${queue.length} pending attendance record(s)`
    );

    const remainingQueue: PendingAttendance[] =
      [];

    for (const record of queue) {
      const { error } =
        await saveAttendance(
          record.date,
          record.subjectName,
          record.type,
          record.status
        );

      if (error) {
        console.log(
          `⚠️ Retry failed for ${record.subjectName} on ${record.date}:`,
          error
        );

        remainingQueue.push(record);
      } else {
        console.log(
          `✅ Pending attendance synced: ${record.subjectName} ${record.type} on ${record.date}`
        );
      }
    }

    /*
     * Keep only records that still failed.
     */
    if (remainingQueue.length === 0) {
      await AsyncStorage.removeItem(
        pendingAttendanceKey
      );

      console.log(
        "✅ Offline attendance queue cleared"
      );
    } else {
      await AsyncStorage.setItem(
        pendingAttendanceKey,
        JSON.stringify(remainingQueue)
      );

      console.log(
        `📦 ${remainingQueue.length} record(s) remain in the offline queue`
      );
    }

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not sync pending attendance."
            ),
    };
  }
}

/*
 * Synchronize pending attendance
 * delete operations.
 */
export async function syncPendingAttendanceDeletes(): Promise<{
  error: Error | null;
}> {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return { error: new Error("No authenticated user found.") };
    }

    const pendingAttendanceDeleteKey =
      getPendingAttendanceDeleteKey(userId);

    const savedQueue =
      await AsyncStorage.getItem(
        pendingAttendanceDeleteKey
      );

    if (!savedQueue) {
      return { error: null };
    }

    const queue: PendingAttendanceDelete[] =
      JSON.parse(savedQueue);

    if (queue.length === 0) {
      return { error: null };
    }

    console.log(
      `🗑️ Found ${queue.length} pending attendance deletion(s)`
    );

    const remainingQueue: PendingAttendanceDelete[] =
      [];

    for (const record of queue) {
      const { error } =
        await deleteAttendance(
          record.date,
          record.subjectName,
          record.type
        );

      if (error) {
        console.log(
          `⚠️ Retry deletion failed for ${record.subjectName} on ${record.date}:`,
          error
        );

        remainingQueue.push(record);
      } else {
        console.log(
          `✅ Pending attendance deletion synced: ${record.subjectName} ${record.type} on ${record.date}`
        );
      }
    }

    if (remainingQueue.length === 0) {
      await AsyncStorage.removeItem(
        pendingAttendanceDeleteKey
      );

      console.log(
        "✅ Offline attendance deletion queue cleared"
      );
    } else {
      await AsyncStorage.setItem(
        pendingAttendanceDeleteKey,
        JSON.stringify(remainingQueue)
      );

      console.log(
        `🗑️ ${remainingQueue.length} deletion(s) remain in the offline queue`
      );
    }

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error
          : new Error(
              "Could not sync pending attendance deletions."
            ),
    };
  }
}