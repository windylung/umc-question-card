"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password.trim().length === 0) {
      setErrorMessage("비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error ?? "로그인 실패")
            : "로그인 실패";
        setErrorMessage(msg);
        return;
      }

      setPassword("");
      router.refresh(); // 서버 컴포넌트가 쿠키를 읽어 대시보드를 렌더링
    } catch {
      setErrorMessage("로그인 중 알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-200/10 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-50">
          Admin 로그인
        </h1>
        <p className="mb-6 text-center text-xs text-zinc-300">
          capacity 변경은 관리자만 가능합니다.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/25 bg-slate-200/10 px-3 py-2.5 text-[17px] text-zinc-50 shadow-[0_16px_40px_rgba(15,23,42,0.8)] backdrop-blur-xl outline-none focus:border-white/70 focus:ring-1 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {errorMessage && (
            <p className="rounded-2xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-center text-sm font-medium text-red-200">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-white/20 px-4 py-2.5 text-sm font-semibold text-zinc-50 border border-white/30 shadow-[0_18px_45px_rgba(0,0,0,0.9)] backdrop-blur-xl disabled:cursor-not-allowed disabled:bg-zinc-800/70 disabled:text-zinc-500 disabled:border-zinc-700/80 disabled:shadow-none"
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}

