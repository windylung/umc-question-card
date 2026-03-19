"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { User } from "@/types";

interface UserSelectProps {
  users: User[];
  selectedUserId: string | null;
  onChange: (userId: string | null) => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  label?: string;
}

function buildDisplayLabel(user: User): string {
  const realName = user.real_name?.trim() ?? "";
  return realName.length > 0 ? `${user.nickname} / ${realName}` : user.nickname;
}

function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function UserSelect({
  users,
  selectedUserId,
  onChange,
  isLoading = false,
  errorMessage,
  label = "닉네임 선택",
}: UserSelectProps) {
  const hasUsers = users.length > 0;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const stableIdSuffix = useMemo(() => reactId.replace(/:/g, ""), [reactId]);
  const labelId = `user-select-label-${stableIdSuffix}`;
  const clearButtonRef = useRef<HTMLButtonElement | null>(null);
  const listboxId = `user-select-listbox-${stableIdSuffix}`;

  const selectedUser = useMemo(
    () => users.find((user) => user.id === (selectedUserId ?? "")) ?? null,
    [users, selectedUserId],
  );

  const [query, setQuery] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  useEffect(() => {
    if (selectedUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(buildDisplayLabel(selectedUser));
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery("");
  }, [selectedUserId, selectedUser]);

  // 로딩 중이거나, 사용자 목록이 없거나, 로드 실패(에러)가 있으면 비활성화
  const isDisabled = isLoading || !hasUsers || !!errorMessage;

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query);
    const result =
      normalizedQuery.length === 0
        ? users
        : users.filter((user) => {
            const nickname = normalizeForSearch(user.nickname);
            const realName = normalizeForSearch(user.real_name);
            return (
              nickname.includes(normalizedQuery) || realName.includes(normalizedQuery)
            );
          });

    return result;
  }, [users, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setIsOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, []);

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setQuery(event.target.value);
    setIsOpen(true);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const handleSelectUser = (user: User) => {
    onChange(user.id);
    setQuery(buildDisplayLabel(user));
    setIsOpen(false);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (isDisabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filteredUsers.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Backspace") {
      if (query.trim().length === 0 && selectedUserId) {
        event.preventDefault();
        handleClear();
      }
      return;
    }

    if (event.key === "Enter") {
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const candidate = filteredUsers[highlightedIndex];
      if (candidate) {
        event.preventDefault();
        handleSelectUser(candidate);
      }
      return;
    }

    if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
      return;
    }

    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
  };

  return (
    <div ref={rootRef} className="w-full space-y-2">
      <label
        id={labelId}
        className="block text-center text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300"
      >
        {label}
      </label>
      <div className="relative">
        <div
          className={[
            "relative flex w-full items-center gap-2 rounded-xl border bg-slate-200/10 px-3 py-2.5 pr-9 text-base text-zinc-50 shadow-[0_16px_40px_rgba(15,23,42,0.8)] backdrop-blur-xl outline-none",
            isDisabled ? "cursor-not-allowed opacity-60 border-white/25" : "border-white/25",
            !isDisabled ? "focus-within:border-white/70 focus-within:ring-1 focus-within:ring-white/60" : "",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            disabled={isDisabled}
            placeholder={
              isLoading
                ? "닉네임 목록을 불러오는 중..."
                : hasUsers
                  ? "닉네임 또는 실명을 검색해 주세요"
                  : errorMessage
                    ? "닉네임을 불러오지 못했어요"
                    : "닉네임 데이터를 준비 중이에요"
            }
            className="w-full bg-transparent outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
            role="combobox"
            aria-labelledby={labelId}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={
              isOpen && filteredUsers[highlightedIndex]
                ? `${listboxId}-option-${filteredUsers[highlightedIndex].id}`
                : undefined
            }
          />

          {selectedUserId && !isDisabled && (
            <button
              type="button"
              onClick={handleClear}
            ref={clearButtonRef}
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs text-zinc-200 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/50"
              aria-label="선택 해제"
            >
              ✕
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isDisabled) return;
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            disabled={isDisabled}
            className="absolute inset-y-0 right-2 inline-flex items-center text-xs text-zinc-500 disabled:cursor-not-allowed"
            aria-label="드롭다운 열기"
          >
            ▼
          </button>
        </div>

        {isOpen && !isDisabled && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-white/20 bg-slate-950/80 p-1 shadow-[0_18px_45px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          >
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-300">
                검색 결과가 없어요
              </div>
            ) : (
              filteredUsers.map((user, index) => {
                const isHighlighted = index === highlightedIndex;
                const isSelected = user.id === selectedUserId;
                return (
                  <button
                    key={user.id}
                    id={`${listboxId}-option-${user.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectUser(user)}
                    className={[
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      isHighlighted ? "bg-white/10 text-zinc-50" : "text-zinc-200",
                    ].join(" ")}
                  >
                    <span className="truncate">{buildDisplayLabel(user)}</span>
                    {isSelected && (
                      <span className="ml-3 shrink-0 text-[11px] text-cyan-200">
                        선택됨
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {errorMessage && (
        <p className="text-center text-xs font-medium text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

