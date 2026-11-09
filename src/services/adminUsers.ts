
import { supabase } from "@/lib/supabase";

export type AdminUser = {
  id: string;
  user_id: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  status: "active" | "invited" | "suspended";
  created_at: string;
};

type ServiceResponse<T> = {
  data: T | null;
  error: string | null;
};

/**
 * Gets the logged-in Institution Admin's active institution.
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
 * Fetches users belonging to the logged-in Institution Admin's institution.
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

    // Fetch memberships belonging to this institution.
    const { data: memberships, error: membershipError } = await supabase
      .from("institution_memberships")
      .select("id, user_id, role, status, created_at")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });

    if (membershipError) {
      throw membershipError;
    }

    if (!memberships || memberships.length === 0) {
      return { data: [], error: null };
    }

    // Fetch profile names for the membership users.
    const userIds = memberships.map((membership) => membership.user_id);

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    const profileMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile.full_name,
      ])
    );

    const users: AdminUser[] = memberships.map((membership) => ({
      id: membership.id,
      user_id: membership.user_id,
      full_name:
        profileMap.get(membership.user_id) || "Unknown User",
      role: membership.role,
      status: membership.status,
      created_at: membership.created_at,
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
