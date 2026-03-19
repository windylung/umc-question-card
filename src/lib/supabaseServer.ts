import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseServerClient: SupabaseClient | null = null;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} 환경 변수가 설정되지 않았습니다.`);
  }
  return value;
}

function createSupabaseServerClient(): SupabaseClient {
  if (supabaseServerClient) return supabaseServerClient;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase 서비스 키가 설정되지 않았습니다. `SUPABASE_SERVICE_ROLE_KEY` 와 `NEXT_PUBLIC_SUPABASE_URL`(또는 `SUPABASE_URL`)을 확인해 주세요.",
    );
  }

  supabaseServerClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return supabaseServerClient;
}

export function getSupabaseServerClient(): SupabaseClient {
  return createSupabaseServerClient();
}

