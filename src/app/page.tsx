"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DbQuestionSetRow,
  DbSubQuestionRow,
  QuestionSet,
  SubQuestion,
  User,
} from "@/types";
import { QuestionCard } from "@/components/QuestionCard";
import { QuestionDetailModal } from "@/components/QuestionDetailModal";
import { UserSelect } from "@/components/UserSelect";
import { getSupabaseClient } from "@/lib/supabase";

type FeedbackType = "success" | "error" | "info";

interface FeedbackMessage {
  type: FeedbackType;
  text: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default function Home() {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedQuestionSetId, setSelectedQuestionSetId] = useState<
    string | null
  >(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] =
    useState<FeedbackMessage | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);

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
  const [selectionCountByQuestionSetId, setSelectionCountByQuestionSetId] =
    useState<Record<string, number>>({});

  const refreshSelectionCounts = async (questionSetIds: string[]) => {
    if (questionSetIds.length === 0) {
      setSelectionCountByQuestionSetId({});
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("question_selections")
      .select("question_set_id")
      .in("question_set_id", questionSetIds);

    if (error) {
      setSelectionCountByQuestionSetId({});
      return;
    }

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { question_set_id: string }[]) {
      counts[row.question_set_id] = (counts[row.question_set_id] ?? 0) + 1;
    }
    setSelectionCountByQuestionSetId(counts);
  };

  const selectedQuestionSet: QuestionSet | undefined = useMemo(
    () => questionSets.find((q) => q.id === (selectedQuestionSetId ?? undefined)),
    [questionSets, selectedQuestionSetId],
  );

  const detailQuestionSet: QuestionSet | null = useMemo(
    () =>
      detailQuestionSetId != null
        ? questionSets.find((q) => q.id === detailQuestionSetId) ?? null
        : null,
    [detailQuestionSetId, questionSets],
  );

  const isSaveDisabled =
    !selectedQuestionSetId || !selectedUserId || isSaving || isLoadingUsers;

  const connectQuestionSets = useMemo(
    () =>
      questionSets
        .filter((q) => q.section === "connect")
        .slice()
        .sort((a, b) => a.teamNumber - b.teamNumber),
    [questionSets],
  );

  const growthQuestionSets = useMemo(
    () =>
      questionSets
        .filter((q) => q.section === "growth")
        .slice()
        .sort((a, b) => a.teamNumber - b.teamNumber),
    [questionSets],
  );

  useEffect(() => {
    async function loadQuestionSets() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("question_sets")
          .select("id, team_number, section, main_question, capacity")
          .order("team_number", { ascending: true });

        if (error) {
          // 질문 목록은 필수이지만, 에러 시에는 그냥 빈 배열로 두고 저장 시에만 에러 메시지로 안내
          // (필요하면 별도 에러 UI를 추가할 수 있음)
          // eslint-disable-next-line no-console
          console.error("질문 세트 로드 에러:", error.message);
          setQuestionSets([]);
        } else {
          const mapped: QuestionSet[] = ((data ?? []) as DbQuestionSetRow[]).map(
            (row) => ({
              id: row.id,
              teamNumber: row.team_number,
              section: row.section,
              mainQuestion: row.main_question,
              capacity: row.capacity,
            }),
          );
          setQuestionSets(mapped);

          // 클릭 지연을 줄이기 위해 서브 질문을 백그라운드로 미리 캐싱
          const questionSetIds = mapped.map((q) => q.id);
          void refreshSelectionCounts(questionSetIds);
          if (questionSetIds.length > 0) {
            const { data: subRows, error: subError } = await supabase
              .from("sub_questions")
              .select("id, question_set_id, sort_order, question")
              .in("question_set_id", questionSetIds)
              .order("question_set_id", { ascending: true })
              .order("sort_order", { ascending: true });

            if (!subError) {
              const grouped = new Map<string, SubQuestion[]>();
              for (const row of (subRows ?? []) as DbSubQuestionRow[]) {
                const questionSetId = row.question_set_id;
                const list = grouped.get(questionSetId) ?? [];
                list.push({
                  id: row.id,
                  questionSetId,
                  sortOrder: row.sort_order,
                  question: row.question,
                });
                grouped.set(questionSetId, list);
              }
              subQuestionCacheRef.current = grouped;
            }
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("질문 세트 로드 중 알 수 없는 오류:", error);
        setQuestionSets([]);
      }
    }

    void loadQuestionSets();
  }, []);

  useEffect(() => {
    async function loadUsers() {
      setIsLoadingUsers(true);
      setUserLoadError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("users")
          .select("id, nickname, real_name")
          .order("nickname", { ascending: true });

        if (error) {
          setUserLoadError("사용자 목록을 불러오는 중 오류가 발생했습니다.");
          setUsers([]);
        } else {
          setUsers((data ?? []) as User[]);
        }
      } catch {
        setUserLoadError(
          "사용자 목록을 불러오는 중 알 수 없는 오류가 발생했습니다.",
        );
        setUsers([]);
      } finally {
        setIsLoadingUsers(false);
      }
    }

    void loadUsers();
  }, []);

  const handleSelectQuestionSet = (id: string) => {
    setSelectedQuestionSetId(id);
    if (!selectedUserId) {
      setFeedbackMessage({
        type: "info",
        text: "질문을 골랐어요. 닉네임을 선택하면 저장할 수 있어요.",
      });
    } else {
      setFeedbackMessage({
        type: "info",
        text: "이 조합으로 질문을 저장할 수 있어요.",
      });
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
      } else {
        const mapped: SubQuestion[] = ((data ?? []) as DbSubQuestionRow[]).map(
          (row) => ({
            id: row.id,
            questionSetId: row.question_set_id,
            sortOrder: row.sort_order,
            question: row.question,
          }),
        );
        subQuestionCacheRef.current.set(id, mapped);
        if (latestDetailRequestRef.current === id) {
          setDetailSubQuestions(mapped);
        }
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
  };

  const handleUserChange = (userId: string | null) => {
    setSelectedUserId(userId);
    if (!userId) {
      setFeedbackMessage({
        type: "info",
        text: "질문을 저장할 닉네임을 다시 선택해 주세요.",
      });
      return;
    }

    if (!selectedQuestionSetId) {
      setFeedbackMessage({
        type: "info",
        text: "왼쪽에서 질문 카드를 먼저 선택해 주세요.",
      });
    } else {
      setFeedbackMessage({
        type: "info",
        text: "이 닉네임과 질문 조합으로 저장할 수 있어요.",
      });
    }
  };

  const handleSave = async () => {
    if (!selectedUserId && !selectedQuestionSetId) {
      setFeedbackMessage({
        type: "error",
        text: "닉네임과 질문 카드를 모두 선택해 주세요.",
      });
      return;
    }

    if (!selectedUserId) {
      setFeedbackMessage({
        type: "error",
        text: "닉네임을 선택해 주세요.",
      });
      return;
    }

    if (!selectedQuestionSetId) {
      setFeedbackMessage({
        type: "error",
        text: "질문 카드를 선택해 주세요.",
      });
      return;
    }

    if (!isUuid(selectedUserId)) {
      setFeedbackMessage({
        type: "error",
        text: "닉네임 데이터를 다시 불러온 뒤 선택해 주세요.",
      });
      return;
    }

    if (!isUuid(selectedQuestionSetId)) {
      setFeedbackMessage({
        type: "error",
        text: "질문 목록을 다시 불러온 뒤 다시 선택해 주세요.",
      });
      return;
    }

    try {
      setIsSaving(true);
      setFeedbackMessage({
        type: "info",
        text: "질문을 저장하는 중입니다...",
      });

      const supabase = getSupabaseClient();

      const { error } = await supabase
        .from("question_selections")
        .upsert(
          {
            user_id: selectedUserId,
            question_set_id: selectedQuestionSetId,
          },
          { onConflict: "user_id" },
        );

      if (error) {
        // eslint-disable-next-line no-console
        console.error("질문 선택 저장 오류:", error);
        const message = (error.message ?? "").toUpperCase();
        setFeedbackMessage({
          type: "error",
          text: message.includes("QUESTION_SET_FULL")
            ? "해당 질문은 정원이 마감되었어요. 다른 질문을 선택해 주세요."
            : "질문을 저장하는 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        });
        return;
      }

      setFeedbackMessage({
        type: "success",
        text: "질문 카드가 성공적으로 저장되었어요!",
      });

      void refreshSelectionCounts(questionSets.map((q) => q.id));
      setSelectedQuestionSetId(null);
      setSelectedUserId(null);
    } catch {
      setFeedbackMessage({
        type: "error",
        text: "질문을 저장하는 중 알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <section className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
        <div className="w-full lg:flex-[0_0_70%]">
          <div className="max-h-[680px] overflow-y-auto rounded-[1.75rem] border border-white/20 bg-slate-200/10 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl md:p-6">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-white/90 backdrop-blur">
                    GROWTH
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/40 via-white/20 to-transparent" />
                </div>
                <div className="grid grid-cols-2 items-start justify-items-start gap-6 lg:gap-5 md:grid-cols-3 xl:grid-cols-4">
                  {growthQuestionSets.map((questionSet) => (
                    <QuestionCard
                      key={questionSet.id}
                      question={questionSet}
                      isSelected={questionSet.id === selectedQuestionSetId}
                      isDisabled={
                        (selectionCountByQuestionSetId[questionSet.id] ?? 0) >=
                        (questionSet.capacity ?? 11)
                      }
                      onSelect={handleSelectQuestionSet}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center rounded-full border border-cyan-200/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-cyan-100 backdrop-blur">
                    CONNECT
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-cyan-200/40 via-white/20 to-transparent" />
                </div>
                <div className="grid grid-cols-2 items-start justify-items-start gap-6 lg:gap-5 md:grid-cols-3 xl:grid-cols-4">
                  {connectQuestionSets.map((questionSet) => (
                    <QuestionCard
                      key={questionSet.id}
                      question={questionSet}
                      isSelected={questionSet.id === selectedQuestionSetId}
                      isDisabled={
                        (selectionCountByQuestionSetId[questionSet.id] ?? 0) >=
                        (questionSet.capacity ?? 11)
                      }
                      onSelect={handleSelectQuestionSet}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full flex flex-col items-center space-y-4 rounded-[1.75rem] border border-white/20 bg-slate-200/10 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl lg:flex-[0_0_30%] lg:max-w-xs xl:max-w-sm xl:pl-10">
          <UserSelect
            users={users}
            selectedUserId={selectedUserId}
            onChange={handleUserChange}
            isLoading={isLoadingUsers}
            errorMessage={userLoadError}
          />

          <div className="w-full space-y-2 text-center">
            <p className="text-xs font-medium text-zinc-300">
              선택된 질문
            </p>
            {selectedQuestionSet ? (
              <>
                <p className="text-base font-semibold text-zinc-50">
                  {selectedQuestionSet.mainQuestion}
                </p>
              </>
            ) : (
              <p className="text-xs text-zinc-400">
                왼쪽에서 질문 카드를 하나 선택해 주세요.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className={[
              "flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold",
              "bg-white/20 text-zinc-50",
              "border border-white/30 shadow-[0_18px_45px_rgba(0,0,0,0.9)] backdrop-blur-xl",
              "disabled:cursor-not-allowed disabled:bg-zinc-800/70 disabled:text-zinc-500 disabled:border-zinc-700/80 disabled:shadow-none",
            ].join(" ")}
          >
            {isSaving ? "저장 중..." : "이 닉네임으로 질문 선택하기"}
          </button>

          {feedbackMessage && (
            <div
              className={[
                "mt-1 w-full rounded-2xl border px-3 py-2 text-center text-xs backdrop-blur-md bg-black/60",
                feedbackMessage.type === "success"
                  ? "border-emerald-400/70 text-emerald-200"
                  : feedbackMessage.type === "error"
                    ? "border-red-500/70 text-red-200"
                    : "border-cyan-400/60 text-cyan-100",
              ].join(" ")}
            >
              {feedbackMessage.text}
            </div>
          )}
        </aside>
      </section>

      <QuestionDetailModal
        questionSet={detailQuestionSet}
        subQuestions={detailSubQuestions}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onSelectQuestionSet={handleSelectQuestionSet}
      />
      {detailError && (
        <p className="mt-3 text-sm font-medium text-red-300">{detailError}</p>
      )}
      {detailLoading && (
        <p className="mt-3 text-sm text-zinc-300">서브 질문을 불러오는 중...</p>
      )}
    </>
  );
}

