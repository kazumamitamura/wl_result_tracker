import { createClient } from "@supabase/supabase-js";
import type { WlDatabase } from "@/types/database";

export function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient<WlDatabase>(supabaseUrl, supabaseAnonKey);
}
