import { cookies } from "next/headers";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import {
  getAdminCookieName,
  verifyAdminSessionCookieValue,
} from "@/lib/adminAuth";

export default async function AdminPage() {
  // next/headers `cookies()`는 Next 버전에 따라 Promise로 동작할 수 있습니다.
  // 동기적으로 접근하면 `.get`이 없어서 런타임 에러가 발생할 수 있어,
  // 항상 await로 unwrap 합니다.
  const cookieStore = await cookies();
  const sessionCookieValue = cookieStore.get(getAdminCookieName())?.value;

  let isAuthed = false;
  try {
    isAuthed = verifyAdminSessionCookieValue(sessionCookieValue);
  } catch {
    // ADMIN_PASSWORD 등이 설정되지 않았을 때
    isAuthed = false;
  }

  return isAuthed ? <AdminDashboard /> : <AdminLoginForm />;
}

