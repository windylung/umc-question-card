import { NextResponse, type NextRequest } from "next/server";
import {
  createAdminSessionCookieValue,
  getAdminCookieName,
  getAdminSessionTtlMs,
  verifyAdminPassword,
} from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 읽을 수 없습니다." },
      { status: 400 },
    );
  }

  const password =
    body && typeof body === "object" && "password" in body
      ? (body as { password?: unknown }).password
      : undefined;

  if (typeof password !== "string") {
    return NextResponse.json(
      { error: "`password` 문자열이 필요합니다." },
      { status: 400 },
    );
  }

  if (!verifyAdminPassword(password)) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });

  const cookieName = getAdminCookieName();
  const value = createAdminSessionCookieValue();
  const maxAgeSeconds = Math.floor(getAdminSessionTtlMs() / 1000);

  res.cookies.set(cookieName, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return res;
}

