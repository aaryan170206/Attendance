import { getMySubjects } from "./subjects";
import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("Current user:", user?.id);

  const {
    data: profiles,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .limit(1);

  if (profileError) {
    console.log(
      "❌ Supabase connection failed:"
    );
    console.log(profileError);
    return false;
  }

  console.log(
    "✅ Supabase connection successful!"
  );

  console.log(
    "Profile:",
    profiles
  );

  const {
    data: subjects,
    error: subjectError,
  } =
    await getMySubjects();

  if (subjectError) {
    console.log(
      "❌ Subject fetch failed:"
    );
    console.log(subjectError);
    return false;
  }

  console.log(
    "✅ Subjects fetched successfully!"
  );

  console.log(
    "Subjects:",
    subjects
  );

  return true;
}