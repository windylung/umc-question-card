import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
}

let supabaseClient: SupabaseClient | null = null;

function createSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }

  const url: string = supabaseUrl;
  const key: string = supabaseAnonKey;

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
}

export function getSupabaseClient(): SupabaseClient {
  return createSupabaseClient();
}

