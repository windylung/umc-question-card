import { NextResponse, type NextRequest } from "next/server";
import { getAdminCookieName } from "@/lib/adminAuth";

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const cookieName = getAdminCookieName();
  res.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return res;
}

