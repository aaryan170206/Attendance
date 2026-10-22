
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
        case "partial":
        case "onLeave":
          totalScore += 0.5;
          eligibleRecords += 1;
          break;

        // These statuses do not affect the calculation.
        case "club":
        case "noClass":
        case "noLab":
        case "pending":
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
