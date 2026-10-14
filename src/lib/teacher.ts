
import { supabase } from "@/lib/supabase";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type ClassInfo = {
  id: string;
  semester: number;
  department_id: string | null;
};

type SubjectInfo = {
  id: string;
  name: string;
};

type TeachingAssignment = {
  id: string;
  class_id: string;
  subject_id: string;
  classes: ClassInfo[];
  subjects: SubjectInfo[];
};

type CreateAssignmentInput = {
  classId: string;
  subjectId: string;
  title: string;
  description?: string;
  dueDate?: string | null;
};

type SubmissionStatus = "pending" | "submitted";

type AssignmentSubmission = {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  submitted_at: string | null;
  marked_by: string | null;
  student_profiles: {
    id: string;
    profiles: {
      full_name: string;
    } | null;
  } | null;
};

// --------------------------------------------------
// GET LOGGED-IN USER
// --------------------------------------------------

async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { user: null, error };
  }

  if (!user) {
    return {
      user: null,
      error: new Error("User is not logged in."),
    };
  }

  return { user, error: null };
}

// --------------------------------------------------
// GET TEACHING ASSIGNMENTS
// --------------------------------------------------

export async function getMyTeachingAssignments() {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { data: null, error: userError };
  }

  // Step 1: Fetch the teacher's assigned class-subject combinations.
  const { data: assignments, error: assignmentError } = await supabase
    .from("teaching_assignments")
    .select("id, class_id, subject_id")
    .eq("teacher_id", user.id);

  if (assignmentError) {
    return { data: null, error: assignmentError };
  }

  if (!assignments || assignments.length === 0) {
    return { data: [], error: null };
  }

  // Step 2: Get unique class and subject IDs.
  const classIds = [
    ...new Set(assignments.map((item) => item.class_id)),
  ];

  const subjectIds = [
    ...new Set(assignments.map((item) => item.subject_id)),
  ];

  // Step 3: Fetch class information separately.
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, semester, department_id")
    .in("id", classIds);

  if (classError) {
    return { data: null, error: classError };
  }

  // Step 4: Fetch subject information separately.
  const { data: subjects, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds);

  if (subjectError) {
    return { data: null, error: subjectError };
  }

  // Step 5: Combine assignment, class and subject information.
  const result: TeachingAssignment[] = assignments.map((assignment) => {
    const classInfo = classes?.find(
      (item) => item.id === assignment.class_id
    );

    const subjectInfo = subjects?.find(
      (item) => item.id === assignment.subject_id
    );

    return {
      id: assignment.id,
      class_id: assignment.class_id,
      subject_id: assignment.subject_id,
      classes: classInfo ? [classInfo] : [],
      subjects: subjectInfo ? [subjectInfo] : [],
    };
  });

  return { data: result, error: null };
}

// --------------------------------------------------
// GET TOTAL STUDENT ENROLMENTS
// --------------------------------------------------

export async function getMyTotalEnrolments() {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { count: null, error: userError };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("teaching_assignments")
    .select("class_id")
    .eq("teacher_id", user.id);

  if (assignmentError) {
    return { count: null, error: assignmentError };
  }

  const classIds = [
    ...new Set((assignments ?? []).map((item) => item.class_id)),
  ];

  if (classIds.length === 0) {
    return { count: 0, error: null };
  }

  const { count, error } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .in("class_id", classIds);

  return { count, error };
}

// --------------------------------------------------
// GET CLASSES CONDUCTED
// --------------------------------------------------

export async function getMyClassesConducted() {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { count: null, error: userError };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("teaching_assignments")
    .select("class_id, subject_id")
    .eq("teacher_id", user.id);

  if (assignmentError) {
    return { count: null, error: assignmentError };
  }

  if (!assignments?.length) {
    return { count: 0, error: null };
  }

  const sessions = new Set<string>();

  for (const assignment of assignments) {
    const { data: enrollments, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("class_id", assignment.class_id);

    if (enrollmentError) {
      return { count: null, error: enrollmentError };
    }

    const studentIds = [
      ...new Set((enrollments ?? []).map((item) => item.student_id)),
    ];

    if (studentIds.length === 0) {
      continue;
    }

    const { data: records, error } = await supabase
      .from("attendance")
      .select("attendance_date, type, status")
      .eq("subject_id", assignment.subject_id)
      .in("student_id", studentIds)
      .not("status", "in", '("noClass","noLab")');

    if (error) {
      return { count: null, error };
    }

    for (const record of records ?? []) {
      const sessionKey = [
        assignment.class_id,
        assignment.subject_id,
        record.attendance_date,
        record.type,
      ].join(":");

      sessions.add(sessionKey);
    }
  }

  return { count: sessions.size, error: null };
}

// --------------------------------------------------
// GET DEPARTMENT-WIDE ASSIGNMENTS
// --------------------------------------------------

export async function getMyAssignments() {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { data: null, error: userError };
  }

  // Step 1: Fetch assignments visible under RLS.
  const { data: assignments, error: assignmentError } = await supabase
    .from("assignments")
    .select(`
      id,
      teacher_id,
      class_id,
      subject_id,
      title,
      description,
      due_date,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (assignmentError) {
    return { data: null, error: assignmentError };
  }

  if (!assignments?.length) {
    return { data: [], error: null };
  }

  // Step 2: Get unique IDs.
  const classIds = [
    ...new Set(assignments.map((item) => item.class_id)),
  ];

  const subjectIds = [
    ...new Set(assignments.map((item) => item.subject_id)),
  ];

  // Step 3: Fetch classes.
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id, semester, department_id")
    .in("id", classIds);

  if (classError) {
    return { data: null, error: classError };
  }

  // Step 4: Fetch subjects.
  const { data: subjects, error: subjectError } = await supabase
    .from("subjects")
    .select("id, name")
    .in("id", subjectIds);

  if (subjectError) {
    return { data: null, error: subjectError };
  }

  // Step 5: Combine the results.
  const result = assignments.map((assignment) => {
    const classInfo = classes?.find(
      (item) => item.id === assignment.class_id
    );

    const subjectInfo = subjects?.find(
      (item) => item.id === assignment.subject_id
    );

    return {
      ...assignment,
      classes: classInfo ? [classInfo] : [],
      subjects: subjectInfo ? [subjectInfo] : [],
    };
  });

  return { data: result, error: null };
}

// --------------------------------------------------
// CREATE ASSIGNMENT
// --------------------------------------------------

export async function createAssignment({
  classId,
  subjectId,
  title,
  description,
  dueDate,
}: CreateAssignmentInput) {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { data: null, error: userError };
  }

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id: user.id,
      class_id: classId,
      subject_id: subjectId,
      title: title.trim(),
      description: description?.trim() || null,
      due_date: dueDate || null,
    })
    .select()
    .single();

  return { data, error };
}

// --------------------------------------------------
// GET ASSIGNMENT SUBMISSIONS
// --------------------------------------------------

export async function getAssignmentSubmissions(assignmentId: string) {
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(`
      id,
      assignment_id,
      student_id,
      status,
      submitted_at,
      marked_by,
      student_profiles (
        id,
        profiles (
          full_name
        )
      )
    `)
    .eq("assignment_id", assignmentId);

  return {
    data: data as AssignmentSubmission[] | null,
    error,
  };
}

// --------------------------------------------------
// UPDATE SUBMISSION STATUS
// --------------------------------------------------

export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
) {
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    return { data: null, error: userError };
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({
      status,
      submitted_at: status === "submitted" ? now : null,
      marked_by: user.id,
      updated_at: now,
    })
    .eq("id", submissionId)
    .select()
    .single();

  return { data, error };
}
