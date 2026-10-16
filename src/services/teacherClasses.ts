
import { supabase } from "@/lib/supabase";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type TeacherClass = {
  id: string;
  name: string;
  section: string | null;
  semester: number | null;
  department_id: string | null;
  subjects: {
    id: string;
    name: string;
  }[];
};

export type TeacherClassStudent = {
  id: string;
  student_id: string;
  roll_number: string | null;
  full_name: string | null;
};

// --------------------------------------------------
// GET TEACHER'S ASSIGNED CLASSES
// --------------------------------------------------

export async function getMyTeacherClasses(): Promise<{
  data: TeacherClass[] | null;
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

    // Fetch teaching assignments
    const { data: assignments, error: assignmentError } =
      await supabase
        .from("teaching_assignments")
        .select("class_id, subject_id")
        .eq("teacher_id", user.id);

    if (assignmentError) throw assignmentError;

    if (!assignments || assignments.length === 0) {
      return { data: [], error: null };
    }

    // Get unique class and subject IDs
    const classIds = [
      ...new Set(assignments.map((item) => item.class_id)),
    ];

    const subjectIds = [
      ...new Set(assignments.map((item) => item.subject_id)),
    ];

    // Fetch class details
    const { data: classes, error: classError } = await supabase
      .from("classes")
      .select("id, name, section, semester, department_id")
      .in("id", classIds);

    if (classError) throw classError;

    // Fetch subject details
    const { data: subjects, error: subjectError } = await supabase
      .from("subjects")
      .select("id, name")
      .in("id", subjectIds);

    if (subjectError) throw subjectError;

    // Combine classes with their assigned subjects
    const result: TeacherClass[] = (classes ?? []).map((classItem) => {
      const assignedSubjectIds = assignments
        .filter((item) => item.class_id === classItem.id)
        .map((item) => item.subject_id);

      const classSubjects = (subjects ?? [])
        .filter((subject) => assignedSubjectIds.includes(subject.id))
        .map((subject) => ({
          id: subject.id,
          name: subject.name,
        }));

      return {
        id: classItem.id,
        name: classItem.name,
        section: classItem.section,
        semester: classItem.semester,
        department_id: classItem.department_id,
        subjects: classSubjects,
      };
    });

    return { data: result, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to load teacher classes."),
    };
  }
}

// --------------------------------------------------
// GET STUDENTS ENROLLED IN A CLASS
// --------------------------------------------------

export async function getStudentsInClass(classId: string): Promise<{
  data: TeacherClassStudent[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id,
        student_id,
        student_profiles (
          id,
          roll_number,
          profiles (
            full_name
          )
        )
      `)
      .eq("class_id", classId);

    if (error) throw error;

    const students: TeacherClassStudent[] = (data ?? []).map((item) => {
      const profile = item.student_profiles as any;

      return {
        id: item.id,
        student_id: item.student_id,
        roll_number: profile?.roll_number ?? null,
        full_name: profile?.profiles?.full_name ?? null,
      };
    });

    return { data: students, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error
          : new Error("Unable to load students."),
    };
  }
}
