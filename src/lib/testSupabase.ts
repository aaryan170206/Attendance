import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);

  if (error) {
    console.log("❌ Supabase connection failed:");
    console.log(error);
    return false;
  }

  console.log("✅ Supabase connection successful!");
  console.log(data);

  return true;
}