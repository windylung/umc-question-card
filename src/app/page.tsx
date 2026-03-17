import { useEffect, useState } from "react";
import { getSupabaseClient } from "../lib/supabase";

type User = {
  id: string;
  nickname: string;
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(
    null,
  );

  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true);
      setUsersError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("users")
          .select("id, nickname")
          .order("nickname", { ascending: true });

        if (error) {
          setUsersError("사용자 목록을 불러오는 중 오류가 발생했습니다.");
          setUsers([]);
        } else {
          setUsers(data ?? []);
        }
      } catch {
        setUsersError("사용자 목록을 불러오는 중 알 수 없는 오류가 발생했습니다.");
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    }

    void loadUsers();
  }, []);

  async function handleSaveSelection() {
    if (!selectedUserId) {
      setSaveMessage("닉네임을 먼저 선택해 주세요.");
      return;
    }

    if (!selectedQuestionId) {
      setSaveMessage("질문 카드를 먼저 선택해 주세요.");
      return;
    }

    setIsSavingSelection(true);
    setSaveMessage(null);

    try {
      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from("question_selections")
        .upsert(
          {
            user_id: selectedUserId,
            question_id: selectedQuestionId,
          },
          { onConflict: "user_id" },
        );

      if (error) {
        setSaveMessage(
          "선택을 저장하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } else {
        setSaveMessage("선택이 성공적으로 저장되었습니다!");
      }
    } catch {
      setSaveMessage(
        "선택을 저장하는 중 알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setIsSavingSelection(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-8 font-sans dark:bg-black">
      <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
        <h1 className="mb-4 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          질문 카드 선택 저장
        </h1>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            닉네임 선택
          </label>
          {usersLoading ? (
            <p className="text-sm text-zinc-500">사용자 목록을 불러오는 중...</p>
          ) : usersError ? (
            <p className="text-sm font-medium text-red-500">{usersError}</p>
          ) : (
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              value={selectedUserId ?? ""}
              onChange={(event) =>
                setSelectedUserId(
                  event.target.value ? event.target.value : null,
                )
              }
            >
              <option value="">닉네임을 선택해 주세요</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nickname}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            질문 카드 ID (임시)
          </label>
          <input
            type="number"
            min={1}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/30 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            placeholder="예: 1"
            value={selectedQuestionId ?? ""}
            onChange={(event) =>
              setSelectedQuestionId(
                event.target.value ? Number(event.target.value) : null,
              )
            }
          />
          <p className="mt-1 text-xs text-zinc-500">
            (추후 실제 질문 카드 컴포넌트와 연결 예정)
          </p>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          onClick={() => void handleSaveSelection()}
          disabled={isSavingSelection}
        >
          {isSavingSelection ? "저장 중..." : "질문 선택하기"}
        </button>

        {saveMessage && (
          <p
            className={`mt-3 text-sm ${
              saveMessage.includes("오류") ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {saveMessage}
          </p>
        )}
      </section>
    </main>
  );
}
