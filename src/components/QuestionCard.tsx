"use client";

import type { QuestionSection, QuestionSet } from "@/types";

interface QuestionCardProps {
  question: QuestionSet;
  isSelected: boolean;
  isDisabled?: boolean;
  onSelect: (id: string) => void;
  onOpenDetail?: (id: string) => void;
  className?: string;
}

function getQuestionSectionLabel(section: QuestionSection): string {
  return section === "growth" ? "GROWTH" : "CONNECT";
}

export function QuestionCard({
  question,
  isSelected,
  isDisabled = false,
  onSelect,
  onOpenDetail,
  className,
}: QuestionCardProps) {
  const section = question.section;

  const handleClick = () => {
    if (isDisabled) return;
    onSelect(question.id);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (isDisabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(question.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={isDisabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        "relative flex h-auto flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left text-slate-900 lg:scale-95 lg:origin-top",
        "border-white/70 shadow-[0_18px_46px_rgba(15,23,42,0.55)] backdrop-blur-2xl bg-white/20 bg-clip-padding",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
        isDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
        isSelected
          ? "ring-2 ring-white shadow-[0_0_32px_rgba(255,255,255,0.9),0_20px_60px_rgba(15,23,42,0.9)] border-white"
          : "",
        className ?? "",
      ].join(" ")}
    >
      <div className="relative z-10 flex items-start justify-end">
        <p className="text-3xl font-semibold leading-none text-slate-900 md:text-4xl">
          {question.teamNumber.toString().padStart(2, "0")}
        </p>
      </div>

      <div className="relative z-10 mt-4">
        <h3 className="line-clamp-4 text-[15px] font-semibold leading-snug tracking-wide text-slate-900 md:text-base">
          {question.mainQuestion}
        </h3>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-end text-[11px] text-slate-900/80 md:text-xs">
        {onOpenDetail && (
          <button
            type="button"
            className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium backdrop-blur"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(question.id);
            }}
          >
            자세히 보기
          </button>
        )}
      </div>
    </div>
  );
}

