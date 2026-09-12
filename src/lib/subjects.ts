import { supabase } from "@/lib/supabase";

export type SupabaseSubject = {
  id: string;
  class_id: string;
  name: string;
  has_lab: boolean;
  created_at: string;
};

export async function getMySubjects(): Promise<{
  data: SupabaseSubject[] | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        data: null,
        error: userError,
      };
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
      data: enrollments,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("class_id")
      .eq("student_id", user.id);

    if (enrollmentError) {
      return {
        data: null,
        error: enrollmentError,
      };
    }

    if (
      !enrollments ||
      enrollments.length === 0
    ) {
      return {
        data: [],
        error: null,
      };
    }

    const classIds =
      enrollments.map(
        (enrollment) =>
          enrollment.class_id
      );

    const {
      data: subjects,
      error: subjectError,
    } = await supabase
      .from("subjects")
      .select(
        "id, class_id, name, has_lab, created_at"
      )
      .in("class_id", classIds)
      .order("name");

    if (subjectError) {
      return {
        data: null,
        error: subjectError,
      };
    }

    return {
      data: subjects,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error(
              "Unknown error occurred."
            ),
    };
  }
}