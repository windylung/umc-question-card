"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type {
  DbQuestionSetRow,
  DbSubQuestionRow,
  QuestionSet,
  SubQuestion,
  User,
} from "@/types";
import { UserSelect } from "@/components/UserSelect";

export default function SearchPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);

  const [isLoadingSelection, setIsLoadingSelection] = useState(false);
  const [selectionLoadError, setSelectionLoadError] = useState<string | null>(
    null,
  );
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [emptySelectionMessage, setEmptySelectionMessage] = useState<
    string | null
  >(null);

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
          return;
        }

        setUsers((data ?? []) as User[]);
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

  useEffect(() => {
    async function loadSelection() {
      setSelectionLoadError(null);
      setEmptySelectionMessage(null);
      setQuestionSet(null);
      setSubQuestions([]);

      if (!selectedUserId) {
        return;
      }

      setIsLoadingSelection(true);

      try {
        const supabase = getSupabaseClient();

        const { data: selectionRow, error: selectionError } = await supabase
          .from("question_selections")
          .select("question_set_id")
          .eq("user_id", selectedUserId)
          .maybeSingle();

        if (selectionError) {
          setSelectionLoadError(
            "선택한 질문 카드를 불러오는 중 오류가 발생했습니다.",
          );
          return;
        }

        if (!selectionRow) {
          setEmptySelectionMessage("질문 카드를 먼저 선택해주세요");
          return;
        }

        const questionSetId: string = selectionRow.question_set_id;

        const { data: setRow, error: setError } = await supabase
          .from("question_sets")
          .select("id, team_number, section, main_question, capacity")
          .eq("id", questionSetId)
          .maybeSingle();

        if (setError || !setRow) {
          setSelectionLoadError(
            "선택한 질문 카드를 찾을 수 없습니다. 잠시 후 다시 시도해 주세요.",
          );
          return;
        }

        const mappedSet: QuestionSet = {
          id: (setRow as DbQuestionSetRow).id,
          teamNumber: (setRow as DbQuestionSetRow).team_number,
          section: (setRow as DbQuestionSetRow).section,
          mainQuestion: (setRow as DbQuestionSetRow).main_question,
          capacity: (setRow as DbQuestionSetRow).capacity,
        };
        setQuestionSet(mappedSet);

        const { data: subRows, error: subError } = await supabase
          .from("sub_questions")
          .select("id, question_set_id, sort_order, question")
          .eq("question_set_id", questionSetId)
          .order("sort_order", { ascending: true });

        if (subError) {
          setSubQuestions([]);
          return;
        }

        const mappedSubs: SubQuestion[] = ((subRows ?? []) as DbSubQuestionRow[]).map(
          (row) => ({
            id: row.id,
            questionSetId: row.question_set_id,
            sortOrder: row.sort_order,
            question: row.question,
          }),
        );
        setSubQuestions(mappedSubs);
      } catch {
        setSelectionLoadError(
          "선택한 질문 카드를 불러오는 중 알 수 없는 오류가 발생했습니다.",
        );
      } finally {
        setIsLoadingSelection(false);
      }
    }

    void loadSelection();
  }, [selectedUserId]);

  return (
    <section className="flex w-full justify-center px-4 pt-10">
      <div className="w-full max-w-sm space-y-6 lg:max-w-lg">
        <div className="w-full">
          <UserSelect
            users={users}
            selectedUserId={selectedUserId}
            onChange={setSelectedUserId}
            isLoading={isLoadingUsers}
            errorMessage={userLoadError}
            label="닉네임 선택"
          />
        </div>

        <aside className="relative w-full overflow-hidden rounded-2xl border border-white/20 bg-slate-200/10 p-4 shadow-[0_28px_80px_rgba(15,23,42,0.85)] backdrop-blur-2xl md:p-6">
          {isLoadingSelection ? (
            <p className="mt-2 text-[15px] text-zinc-200/90 lg:text-[17px]">
              질문 카드를 불러오는 중...
            </p>
          ) : selectionLoadError ? (
            <p className="mt-2 text-[15px] font-medium text-red-300 lg:text-[17px]">
              {selectionLoadError}
            </p>
          ) : emptySelectionMessage ? (
            <p className="mt-2 text-[15px] font-medium text-zinc-100 lg:text-[17px]">
              {emptySelectionMessage}
            </p>
          ) : !questionSet ? (
            <p className="mt-2 text-[15px] text-zinc-200/90 lg:text-[17px]">
              닉네임을 선택하면 질문 카드가 표시됩니다.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 -translate-x-6 -translate-y-8 text-[110px] font-semibold leading-none text-white/25 lg:text-[128px]"
              >
                {questionSet.teamNumber.toString().padStart(2, "0")}
              </div>
              <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-zinc-50 backdrop-blur-md">
                <p className="text-[15px] font-semibold leading-relaxed lg:text-[17px]">
                  {questionSet.mainQuestion}
                </p>
              </div>

              {subQuestions
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .filter(
                  (sq) => sq.question.trim() !== questionSet.mainQuestion.trim(),
                ).length === 0 ? (
                <p className="text-[15px] text-zinc-200/90 lg:text-[17px]">
                  서브 질문이 아직 없습니다.
                </p>
              ) : (
                <ol className="max-h-[320px] space-y-2 overflow-y-auto pr-1 text-[15px] leading-relaxed text-zinc-50 lg:text-[17px]">
                  {subQuestions
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .filter(
                      (sq) =>
                        sq.question.trim() !== questionSet.mainQuestion.trim(),
                    )
                    .map((sq) => (
                      <li
                        key={sq.id}
                        className="rounded-2xl border border-white/15 px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[15px] font-semibold text-zinc-100 lg:text-[17px]">
                            {sq.sortOrder}
                          </span>
                          <p>{sq.question}</p>
                        </div>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
