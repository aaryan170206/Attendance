
import { supabase } from "@/lib/supabase";

export type AdminDashboardStats = {
  students: number;
  teachers: number;
  departments: number;
  attendance: number | null;
};

const PAGE_SIZE = 1000;

// Fetch the exact count of records from a table.
async function getCount(
  table: string,
  column?: string,
  value?: string
): Promise<number> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (column && value) {
    query = query.eq(column, value);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// Calculate overall attendance using the agreed status values.
async function getOverallAttendance(): Promise<number | null> {
  let totalScore = 0;
  let eligibleRecords = 0;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("attendance")
      .select("status")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const record of data) {
      switch (record.status) {
        case "present":
          totalScore += 1;
          eligibleRecords += 1;
          break;

        case "absent":
          eligibleRecords += 1;
          break;

        case "leftEarly":
          totalScore += 0.5;
          eligibleRecords += 1;
          break;

        // Excluded from attendance percentage.
        case "onLeave":
        case "pending":
        case "club":
        case "noClass":
        case "noLab":
          break;
      }
    }

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  if (eligibleRecords === 0) {
    return null;
  }

  return Number(
    ((totalScore / eligibleRecords) * 100).toFixed(1)
  );
}

// Fetch all statistics required by the Admin Dashboard.
export async function getAdminDashboardStats(): Promise<{
  data: AdminDashboardStats | null;
  error: string | null;
}> {
  try {
    const [
      students,
      teachers,
      departments,
      attendance,
    ] = await Promise.all([
      getCount("profiles", "role", "student"),
      getCount("profiles", "role", "teacher"),
      getCount("departments"),
      getOverallAttendance(),
    ]);

    return {
      data: {
        students,
        teachers,
        departments,
        attendance,
      },
      error: null,
    };
  } catch (error) {
    console.error("Admin dashboard statistics error:", error);

    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load dashboard statistics.",
    };
  }
}

export type MonthlyDepartmentAttendance = {
  month: string;
  departmentId: string;
  departmentName: string;
  chartColor: string | null;
  attendance: number | null;
  present: number;
  absent: number;
  leftEarly: number;
  onLeave: number;
  pending: number;
};

// Fetch monthly attendance grouped by department.
export async function getMonthlyDepartmentAttendance(): Promise<{
  data: MonthlyDepartmentAttendance[] | null;
  error: string | null;
}> {
  try {
    const PAGE_SIZE = 1000;
    let from = 0;

    type AttendanceRecord = {
      status: string;
      attendance_date: string;
      subjects: {
        classes: {
          departments: {
            id: string;
            name: string;
            chart_color: string | null;
          };
        };
      };
    };

    const records: AttendanceRecord[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          status,
          attendance_date,
          subjects!inner (
            classes!inner (
              departments!inner (
                id,
                name,
                chart_color
              )
            )
          )
        `)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const page = (data ?? []) as unknown as AttendanceRecord[];
      records.push(...page);

      if (page.length < PAGE_SIZE) break;

      from += PAGE_SIZE;
    }

    const grouped = new Map<string, MonthlyDepartmentAttendance>();

    for (const record of records) {
      const department = record.subjects.classes.departments;
      const month = `${record.attendance_date.slice(0, 7)}-01`;
      const key = `${department.id}_${month}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          month,
          departmentId: department.id,
          departmentName: department.name,
          chartColor: department.chart_color,
          attendance: null,
          present: 0,
          absent: 0,
          leftEarly: 0,
          onLeave: 0,
          pending: 0,
        });
      }

      const item = grouped.get(key)!;

      switch (record.status) {
        case "present":
          item.present++;
          break;
        case "absent":
          item.absent++;
          break;
        case "leftEarly":
          item.leftEarly++;
          break;
        case "onLeave":
          item.onLeave++;
          break;
        case "pending":
          item.pending++;
          break;
      }
    }

    const result = Array.from(grouped.values());

    for (const item of result) {
      const eligibleRecords =
        item.present + item.absent + item.leftEarly;

      item.attendance =
        eligibleRecords === 0
          ? null
          : Number(
              (
                ((item.present + item.leftEarly * 0.5) /
                  eligibleRecords) *
                100
              ).toFixed(1)
            );
    }

    result.sort(
      (a, b) =>
        a.month.localeCompare(b.month) ||
        a.departmentName.localeCompare(b.departmentName)
    );

    return { data: result, error: null };
  } catch (error) {
    console.error("Monthly department attendance error:", error);

    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load monthly department attendance.",
    };
  }
}


export type RecentActivity = {
  id: string;
  studentName: string;
  rollNumber: string | null;
  subjectName: string;
  teacherName: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
  createdAt: string;
};

export async function getRecentActivity(): Promise<{
  data: RecentActivity[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("attendance_correction_logs")
      .select(`
        id,
        old_status,
        new_status,
        reason,
        created_at,
        student_profiles!attendance_correction_logs_student_id_fkey (
          roll_number,
          profiles!student_profiles_id_fkey (
            full_name
          )
        ),
        subjects!attendance_correction_logs_subject_id_fkey (
          name
        ),
        profiles!attendance_correction_logs_teacher_id_fkey (
          full_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    const activities: RecentActivity[] = (data ?? []).map(
      (item: any) => ({
        id: item.id,
        studentName:
          item.student_profiles?.profiles?.full_name ??
          "Unknown Student",
        rollNumber:
          item.student_profiles?.roll_number ?? null,
        subjectName:
          item.subjects?.name ?? "Unknown Subject",
        teacherName:
          item.profiles?.full_name ?? "Unknown Teacher",
        oldStatus: item.old_status,
        newStatus: item.new_status,
        reason: item.reason,
        createdAt: item.created_at,
      })
    );

    return { data: activities, error: null };
  } catch (error) {
    console.error("Recent activity error:", error);

    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load recent activity.",
    };
  }
}
