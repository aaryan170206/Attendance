
import { supabase } from "@/lib/supabase";

export type AdminUser = {
  id: string;
  user_id: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  status: "active" | "invited" | "suspended";
  created_at: string;
  roll_number: string | null;
};

type ServiceResponse<T> = {
  data: T | null;
  error: string | null;
};

/**
 * Gets the logged-in Institution Admin's active institution.
 * Assumes one active institution per admin account.
 */
export async function getAdminInstitutionId(): Promise<
  ServiceResponse<string>
> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Unable to identify the logged-in user.");
    }

    const { data, error } = await supabase
      .from("institution_memberships")
      .select("institution_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .single();

    if (error) {
      throw error;
    }

    return {
      data: data.institution_id,
      error: null,
    };
  } catch (error) {
    console.error("getAdminInstitutionId:", error);

    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to retrieve institution.",
    };
  }
}

/**
 * Fetches users belonging to the logged-in Admin's institution.
 */
export async function getAdminUsers(): Promise<
  ServiceResponse<AdminUser[]>
> {
  try {
    const institutionResult = await getAdminInstitutionId();

    if (institutionResult.error || !institutionResult.data) {
      throw new Error(
        institutionResult.error || "Institution not found."
      );
    }

    const institutionId = institutionResult.data;

    // Fetch institution memberships.
    const { data: memberships, error: membershipError } = await supabase
      .from("institution_memberships")
      .select("id, user_id, role, status, created_at")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });

    if (membershipError) {
      throw membershipError;
    }

    if (!memberships || memberships.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const userIds = memberships.map(
      (membership) => membership.user_id
    );

    // Fetch profile names.
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map<string, string | null>(
      (profiles || []).map((profile) => [
        profile.id,
        profile.full_name,
      ])
    );

    // Fetch roll numbers for student memberships only.
    const studentIds = memberships
      .filter((membership) => membership.role === "student")
      .map((membership) => membership.user_id);

    let rollNumberMap = new Map<string, string | null>();

    if (studentIds.length > 0) {
      const { data: studentProfiles, error: studentProfileError } =
        await supabase
          .from("student_profiles")
          .select("id, roll_number")
          .in("id", studentIds);

      if (studentProfileError) {
        throw studentProfileError;
      }

      rollNumberMap = new Map<string, string | null>(
        (studentProfiles || []).map((profile) => [
          profile.id,
          profile.roll_number,
        ])
      );
    }

    // Combine membership, profile and roll-number information.
    const users: AdminUser[] = memberships.map((membership) => ({
      id: membership.id,
      user_id: membership.user_id,
      full_name:
        profileMap.get(membership.user_id) || "Unknown User",
      role: membership.role,
      status: membership.status,
      created_at: membership.created_at,
      roll_number:
        membership.role === "student"
          ? rollNumberMap.get(membership.user_id) ?? null
          : null,
    }));

    return {
      data: users,
      error: null,
    };
  } catch (error) {
    console.error("getAdminUsers:", error);

    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch users.",
    };
  }
}

/**
 * Manually assigns or updates a student's roll number.
 * Authorization and duplicate validation are handled by Supabase RPC.
 */
export async function assignStudentRollNumber(
  studentId: string,
  rollNumber: string
): Promise<ServiceResponse<string | null>> {
  try {
    const normalizedRollNumber = rollNumber.trim();

    if (!normalizedRollNumber) {
      throw new Error("Please enter a valid roll number.");
    }

    const { data, error } = await supabase.rpc(
      "admin_assign_student_roll_number",
      {
        p_student_id: studentId,
        p_roll_number: normalizedRollNumber,
      }
    );

    if (error) {
      throw error;
    }

    return {
      data: data ?? null,
      error: null,
    };
  } catch (error) {
    console.error("assignStudentRollNumber:", error);

    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update student roll number.",
    };
  }
}
