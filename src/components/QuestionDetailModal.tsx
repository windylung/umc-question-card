"use client";

import { useEffect } from "react";
import type { QuestionSet, SubQuestion } from "@/types";

interface QuestionDetailModalProps {
  questionSet: QuestionSet | null;
  subQuestions: SubQuestion[];
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestionSet?: (id: string) => void;
}

export function QuestionDetailModal({
  questionSet,
  subQuestions,
  isOpen,
  onClose,
  onSelectQuestionSet,
}: QuestionDetailModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !questionSet) return null;

  const handleBackgroundClick: React.MouseEventHandler<HTMLDivElement> = (
    event,
  ) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-lg"
      onClick={handleBackgroundClick}
      aria-modal="true"
      role="dialog"
      aria-labelledby="question-detail-title"
    >
      <div className="relative w-full max-w-2xl max-h-[86vh] overflow-hidden rounded-3xl border border-white/25 bg-slate-200/10 p-5 text-zinc-50 shadow-[0_38px_120px_rgba(15,23,42,0.98)] backdrop-blur-2xl md:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_100%_0,rgba(148,163,184,0.26),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-70 bg-gradient-to-b from-white/10 via-transparent to-black/30" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="eyebrow-label text-[0.7rem] text-cyan-200/90">
              TEAM {questionSet.teamNumber.toString().padStart(2, "0")}
            </p>
            <h2
              id="question-detail-title"
              className="text-lg font-semibold leading-snug md:text-2xl"
            >
              {questionSet.mainQuestion}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/40 text-xs text-zinc-200"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="relative z-10 mt-5 max-h-[56vh] space-y-3 overflow-y-auto pr-1 text-base leading-relaxed text-zinc-100 md:text-lg">
          <ol className="space-y-3">
            {subQuestions.length === 0 ? (
              <li className="text-zinc-300">서브 질문이 아직 없습니다.</li>
            ) : (
              subQuestions
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((sq) => (
                  <li
                    key={sq.id}
                    className="rounded-2xl border border-white/15 bg-black/35 px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.65)] backdrop-blur-md md:px-5 md:py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-zinc-100 md:h-8 md:w-8 md:text-base">
                        {sq.sortOrder}
                      </span>
                      <p className="text-zinc-50">{sq.question}</p>
                    </div>
                  </li>
                ))
            )}
          </ol>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-2 md:flex-row md:justify-end">
          {onSelectQuestionSet && (
            <button
              type="button"
              onClick={() => {
                onSelectQuestionSet(questionSet.id);
                onClose();
              }}
              className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/20 px-4 py-2 text-sm font-semibold text-zinc-50 shadow-[0_22px_60px_rgba(0,0,0,0.95)] backdrop-blur-xl"
            >
              이 질문으로 선택하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

