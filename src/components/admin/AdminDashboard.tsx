"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { QuestionDetailModal } from "@/components/QuestionDetailModal";
import type {
  DbQuestionSetRow,
  DbQuestionSelectionRow,
  DbSubQuestionRow,
  QuestionSet,
  SubQuestion,
  User,
} from "@/types";

type AdminQuestionSetDetail = {
  id: string; // question_sets.id (uuid)
  teamNumber: number;
  section: "growth" | "connect";
  mainQuestion: string;
  capacity: number;
  assignedUsers: User[];
  assignedCount: number;
};

type AdminRole = "challenger_1" | "challenger_2" | "staff";

const ROLE_LABEL_BY_ROLE: Record<AdminRole, string> = {
  challenger_1: "1부 입장 챌린저",
  challenger_2: "2부 입장 챌린저",
  staff: "중앙운영진 및 프로덕트 팀",
};

function buildUserDisplayLabel(user: User): string {
  const realName = (user.real_name ?? "").trim();
  return realName.length > 0 ? `${user.nickname} / ${realName}` : user.nickname;
}

export function AdminDashboard() {
  const [questionSetDetails, setQuestionSetDetails] = useState<
    AdminQuestionSetDetail[]
  >([]);
  const [selectedCountByRole, setSelectedCountByRole] = useState<
    Record<AdminRole, number>
  >({
    challenger_1: 0,
    challenger_2: 0,
    staff: 0,
  });
  const [totalCountByRole, setTotalCountByRole] = useState<
    Record<AdminRole, number>
  >({
    challenger_1: 0,
    challenger_2: 0,
    staff: 0,
  });
  const [unselectedUsersByRole, setUnselectedUsersByRole] = useState<
    Record<AdminRole, User[]>
  >({
    challenger_1: [],
    challenger_2: [],
    staff: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null,
  );
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailQuestionSetId, setDetailQuestionSetId] = useState<string | null>(
    null,
  );
  const [detailSubQuestions, setDetailSubQuestions] = useState<SubQuestion[]>(
    [],
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const subQuestionCacheRef = useRef<Map<string, SubQuestion[]>>(new Map());
  const latestDetailRequestRef = useRef<string | null>(null);

  const detailQuestionSet: QuestionSet | null = useMemo(() => {
    if (!detailQuestionSetId) return null;
    const q = questionSetDetails.find((x) => x.id === detailQuestionSetId);
    if (!q) return null;
    return {
      id: q.id,
      teamNumber: q.teamNumber,
      section: q.section,
      mainQuestion: q.mainQuestion,
      capacity: q.capacity,
    };
  }, [detailQuestionSetId, questionSetDetails]);

  const refreshData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
      setErrorMessage(null);
      setActionErrorMessage(null);
    }

    try {
      const supabase = getSupabaseClient();

      const [setsRes, selectionsRes, usersRes, subRes] = await Promise.all([
        supabase
          .from("question_sets")
          .select("id, team_number, section, main_question, capacity")
          .order("team_number", { ascending: true }),
        supabase.from("question_selections").select("question_set_id, user_id"),
        supabase
          .from("users")
          .select("id, nickname, real_name, role")
          .order("nickname", { ascending: true }),
        supabase
          .from("sub_questions")
          .select("id, question_set_id, sort_order, question")
          .order("question_set_id", { ascending: true })
          .order("sort_order", { ascending: true }),
      ]);

      if (setsRes.error) {
        throw new Error(
          `질문(팀) 목록을 불러오지 못했습니다: ${setsRes.error.message}`,
        );
      }
      if (selectionsRes.error) {
        throw new Error(
          `할당 정보를 불러오지 못했습니다: ${selectionsRes.error.message}`,
        );
      }
      if (usersRes.error) {
        throw new Error(
          `사용자 정보를 불러오지 못했습니다: ${usersRes.error.message}`,
        );
      }
      if (subRes.error) {
        throw new Error(
          `하위 질문 목록을 불러오지 못했습니다: ${subRes.error.message}`,
        );
      }

      const sets = (setsRes.data ?? []) as DbQuestionSetRow[];
      const subRows = (subRes.data ?? []) as DbSubQuestionRow[];
      const cache = new Map<string, SubQuestion[]>();
      for (const row of subRows) {
        const list = cache.get(row.question_set_id) ?? [];
        list.push({
          id: row.id,
          questionSetId: row.question_set_id,
          sortOrder: row.sort_order,
          question: row.question,
        });
        cache.set(row.question_set_id, list);
      }
      subQuestionCacheRef.current = cache;
      const selections = (selectionsRes.data ?? []) as DbQuestionSelectionRow[];
      const users = (usersRes.data ?? []) as User[];

      const userById = new Map<string, User>();
      for (const u of users) userById.set(u.id, u);

      const selectedUserIds = new Set<string>(selections.map((s) => s.user_id));

      const nextUnselectedUsersByRole: Record<AdminRole, User[]> = {
        challenger_1: [],
        challenger_2: [],
        staff: [],
      };

      for (const u of users) {
        const role = u.role ?? null;
        if (role === "challenger_1" || role === "challenger_2" || role === "staff") {
          if (!selectedUserIds.has(u.id)) {
            nextUnselectedUsersByRole[role].push(u);
          }
        }
      }

      // role 기준으로
      // - 분모: 해당 role의 전체 인원(users)
      // - 분자: 해당 role 중 question_selections에 존재하는 인원(= 질문을 할당받은 인원)
      const nextTotalCountByRole: Record<AdminRole, number> = {
        challenger_1: 0,
        challenger_2: 0,
        staff: 0,
      };
      const nextSelectedCountByRole: Record<AdminRole, number> = {
        challenger_1: 0,
        challenger_2: 0,
        staff: 0,
      };

      const usersRoleCounts: Record<string, number> = {};
      for (const u of users) {
        const roleKey = u.role ?? "null";
        usersRoleCounts[roleKey] = (usersRoleCounts[roleKey] ?? 0) + 1;
      }

      const selectedRoleCounts: Record<string, number> = {};
      for (const s of selections) {
        const user = userById.get(s.user_id);
        const roleKey = user?.role ?? "null";
        selectedRoleCounts[roleKey] = (selectedRoleCounts[roleKey] ?? 0) + 1;
      }


      for (const u of users) {
        const role = u.role ?? null;
        if (role === "challenger_1" || role === "challenger_2" || role === "staff") {
          nextTotalCountByRole[role] += 1;
        }
      }

      for (const s of selections) {
        const user = userById.get(s.user_id);
        const role = user?.role ?? null;
        if (role === "challenger_1" || role === "challenger_2" || role === "staff") {
          nextSelectedCountByRole[role] += 1;
        }
      }

      setSelectedCountByRole(nextSelectedCountByRole);
      setTotalCountByRole(nextTotalCountByRole);
      setUnselectedUsersByRole(nextUnselectedUsersByRole);


      const userIdsByQuestionSetId = new Map<string, string[]>();
      for (const s of selections) {
        const list = userIdsByQuestionSetId.get(s.question_set_id) ?? [];
        list.push(s.user_id);
        userIdsByQuestionSetId.set(s.question_set_id, list);
      }

      const mappedDetails: AdminQuestionSetDetail[] = sets.map((setRow) => {
        const assignedUserIds = userIdsByQuestionSetId.get(setRow.id) ?? [];
        const assignedUsers: User[] = assignedUserIds
          .map((userId) => userById.get(userId))
          .filter((u): u is User => !!u);

        return {
          id: setRow.id,
          teamNumber: setRow.team_number,
          section: setRow.section,
          mainQuestion: setRow.main_question,
          capacity: setRow.capacity,
          assignedUsers,
          assignedCount: assignedUsers.length,
        };
      });

      setQuestionSetDetails(mappedDetails);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  // 카드별 할당 인원 변경 시 실시간 반영
  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel("admin-question-selections")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "question_selections",
        },
        () => {
          void refreshDataRef.current({ silent: true });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const teamDetails = useMemo(() => {
    return questionSetDetails.slice().sort((a, b) => a.teamNumber - b.teamNumber);
  }, [questionSetDetails]);

  const updateCapacity = async (questionSetId: string, delta: -1 | 1) => {
    setUpdatingIds((prev) => ({ ...prev, [questionSetId]: true }));
    setActionErrorMessage(null);

    try {
      const res = await fetch(
        `/api/admin/question-sets/${encodeURIComponent(questionSetId)}/capacity`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ delta }),
        },
      );

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error ?? "요청 실패")
            : "요청 실패";
        throw new Error(msg);
      }

      // 전체 재로딩 대신, 해당 row만 로컬 state 갱신합니다.
      if (data && typeof data === "object") {
        const obj = data as {
          capacity?: unknown;
          assignedCount?: unknown;
          id?: unknown;
        };
        const newCapacity =
          typeof obj.capacity === "number" && Number.isFinite(obj.capacity)
            ? obj.capacity
            : null;
        const newAssignedCount =
          typeof obj.assignedCount === "number" &&
          Number.isFinite(obj.assignedCount)
            ? obj.assignedCount
            : null;
        const returnedId =
          typeof obj.id === "string" ? obj.id : questionSetId;

        setQuestionSetDetails((prev) =>
          prev.map((item) => {
            if (item.id !== returnedId) return item;
            return {
              ...item,
              capacity: newCapacity ?? item.capacity,
              assignedCount: newAssignedCount ?? item.assignedCount,
            };
          }),
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "capacity 업데이트 실패";
      setActionErrorMessage(msg);
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [questionSetId]: false }));
    }
  };

  const handleOpenDetail = async (id: string) => {
    setDetailQuestionSetId(id);
    setIsDetailOpen(true);
    setDetailError(null);
    latestDetailRequestRef.current = id;

    const cached = subQuestionCacheRef.current.get(id);
    if (cached) {
      setDetailSubQuestions(cached);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    setDetailSubQuestions([]);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("sub_questions")
        .select("id, question_set_id, sort_order, question")
        .eq("question_set_id", id)
        .order("sort_order", { ascending: true });

      if (error) {
        setDetailError("서브 질문을 불러오는 중 오류가 발생했어요.");
        setDetailSubQuestions([]);
        return;
      }

      const mapped: SubQuestion[] = ((
        (data ?? []) as unknown as DbSubQuestionRow[]
      )).map((row) => ({
        id: row.id,
        questionSetId: row.question_set_id,
        sortOrder: row.sort_order,
        question: row.question,
      }));

      subQuestionCacheRef.current.set(id, mapped);
      if (latestDetailRequestRef.current === id) {
        setDetailSubQuestions(mapped);
      }
    } catch {
      setDetailError("서브 질문을 불러오는 중 알 수 없는 오류가 발생했어요.");
      setDetailSubQuestions([]);
    } finally {
      if (latestDetailRequestRef.current === id) {
        setDetailLoading(false);
      }
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setDetailQuestionSetId(null);
    setDetailSubQuestions([]);
    setDetailLoading(false);
    setDetailError(null);
    latestDetailRequestRef.current = null;
  };

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="flex w-full max-w-6xl flex-col space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div aria-hidden="true" />
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {errorMessage}
          </div>
        )}

        {actionErrorMessage && (
          <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
            {actionErrorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-white/20 bg-slate-200/10 px-4 py-6 text-sm text-zinc-200/90">
            데이터를 불러오는 중...
          </div>
        ) : (
          <div className="flex flex-col space-y-6">
            <section className="rounded-2xl border border-white/20 bg-slate-200/10 p-[25px] shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(["challenger_1", "challenger_2", "staff"] as AdminRole[]).map(
                  (role) => (
                    <div
                      key={role}
                      className="rounded-2xl border border-white/15 bg-black/25 px-4 py-4 text-center"
                    >
                      <p className="text-xs font-semibold text-zinc-300">
                        {ROLE_LABEL_BY_ROLE[role]}
                      </p>
                      <p className="mt-1 text-3xl font-extrabold leading-none text-zinc-50">
                        {selectedCountByRole[role]}/{totalCountByRole[role]}
                      </p>
                      {role === "challenger_1" && (
                        <p className="mt-2 text-[11px] font-medium text-zinc-400">
                          *1부 후 퇴장하는 챌린저 1명 포함
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/20 bg-slate-200/10 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl">
              <h2 className="mb-4 text-lg font-semibold text-zinc-50">
                팀 내 인원
              </h2>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pr-1">
                {teamDetails.length === 0 ? (
                  <p className="text-sm text-zinc-300">데이터가 없습니다.</p>
                ) : (
                  teamDetails.map((detail) => {
                    const canDecrease =
                      detail.capacity - 1 >= detail.assignedCount;
                    const isUpdating = updatingIds[detail.id] === true;

                    return (
                      <div
                        key={detail.id}
                        className="rounded-2xl border border-white/15 bg-black/25 p-4"
                      >
                        <div className="flex flex-col gap-4 md:grid md:grid-cols-12 md:grid-rows-[auto_auto] md:items-stretch md:gap-6">
                          {/* 데스크탑: 좌 6칸 팀 정보 / 우 6칸 분수+버튼(세로) */}
                          <div className="md:col-span-6 md:row-start-1">
                            <p className="text-[12px] md:text-[13px] font-semibold text-zinc-300">
                              TEAM{" "}
                              {detail.teamNumber
                                .toString()
                                .padStart(2, "0")}{" "}
                              ·{" "}
                              {detail.section === "growth"
                                ? "GROWTH"
                                : "CONNECT"}
                            </p>
                            <p className="mt-1 text-[16px] md:text-[18px] font-semibold text-zinc-50">
                              {detail.mainQuestion}
                            </p>

                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(detail.id)}
                                className="rounded-full bg-black/20 px-2 py-[4px] text-[11px] font-medium backdrop-blur border border-white/15 md:px-3 md:py-[7px] md:text-[12px]"
                              >
                                카드 상세 보기
                              </button>
                            </div>
                          </div>

                          <div className="md:col-span-6 md:row-start-1 flex flex-col items-end justify-center gap-3">
                            <p className="text-right text-3xl font-extrabold leading-none text-zinc-50">
                              {detail.assignedCount}/{detail.capacity}
                            </p>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => updateCapacity(detail.id, -1)}
                                disabled={isUpdating || !canDecrease}
                                className={[
                                  "rounded-full border px-4 py-2 text-sm font-semibold",
                                  "transition-colors",
                                  isUpdating || !canDecrease
                                    ? "cursor-not-allowed border-white/10 bg-zinc-900/40 text-zinc-500"
                                    : "border-white/25 bg-white/10 text-zinc-200 hover:bg-white/15",
                                ].join(" ")}
                              >
                                내리기
                              </button>
                              <button
                                type="button"
                                onClick={() => updateCapacity(detail.id, 1)}
                                disabled={isUpdating}
                                className={[
                                  "rounded-full border px-4 py-2 text-sm font-semibold",
                                  "transition-colors",
                                  isUpdating
                                    ? "cursor-not-allowed border-white/10 bg-zinc-900/40 text-zinc-500"
                                    : "border-white/25 bg-white/10 text-zinc-200 hover:bg-white/15",
                                ].join(" ")}
                              >
                                올리기
                              </button>
                            </div>
                          </div>

                          {/* 하단 블럭: 참여자만 표시 */}
                          <div className="md:col-span-12 md:row-start-2 rounded-2xl bg-white/5 px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {detail.assignedUsers.length === 0 ? (
                                <span className="text-xs text-zinc-400">
                                  아직 선택된 인원이 없어요.
                                </span>
                              ) : (
                                detail.assignedUsers.map((user) => (
                                  <span
                                    key={user.id}
                                    className={[
                                      "rounded-full border px-3 py-1 text-[13px] text-zinc-50",
                                      (() => {
                                        const roleLower = (user.role ?? "")
                                          .toString()
                                          .trim()
                                          .toLowerCase();
                                        const isStaff =
                                          roleLower === "staff" ||
                                          roleLower.includes("staff");

                                        return isStaff
                                          ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40"
                                          : "border-white/15 bg-white/10";
                                      })(),
                                    ].join(" ")}
                                  >
                                    {buildUserDisplayLabel(user)}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/20 bg-slate-200/10 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl">
              <h2 className="mb-4 text-lg font-semibold text-zinc-50">
                질문 미선택 인원
              </h2>

              <div className="space-y-4">
                {(["challenger_1", "challenger_2", "staff"] as AdminRole[]).map(
                  (role, idx, arr) => (
                    <div key={role}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-50">
                          {ROLE_LABEL_BY_ROLE[role]} (
                          {unselectedUsersByRole[role].length}명)
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {unselectedUsersByRole[role].length === 0 ? (
                          <span className="text-xs text-zinc-400">
                            선택한 인원이 없어요.
                          </span>
                        ) : (
                          unselectedUsersByRole[role].map((user) => {
                            const roleLower = (user.role ?? "")
                              .toString()
                              .trim()
                              .toLowerCase();
                            const isStaff =
                              roleLower === "staff" ||
                              roleLower.includes("staff");

                            return (
                              <span
                                key={user.id}
                                className={[
                                  "rounded-full border px-3 py-1 text-[13px] text-zinc-50",
                                  isStaff
                                    ? "border-cyan-300 bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40"
                                    : "border-white/15 bg-white/10",
                                ].join(" ")}
                              >
                                {buildUserDisplayLabel(user)}
                              </span>
                            );
                          })
                        )}
                      </div>

                      {idx < arr.length - 1 && (
                        <div className="mt-4 border-t border-white/10" />
                      )}
                    </div>
                  ),
                )}
              </div>
            </section>
          </div>
        )}

        <QuestionDetailModal
          questionSet={detailQuestionSet}
          subQuestions={detailSubQuestions}
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
        />
        {detailError && (
          <p className="mt-3 text-sm font-medium text-red-300">{detailError}</p>
        )}
        {detailLoading && !detailError && (
          <p className="mt-3 text-sm text-zinc-300">서브 질문을 불러오는 중...</p>
        )}
      </div>
    </main>
  );
}

