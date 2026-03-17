export type AccentKey =
  | "memory"
  | "confession"
  | "future"
  | "daily"
  | "deep"
  | "fun";

export interface QuestionCard {
  id: number;
  title: string;
  shortDescription: string;
  longDescription: string;
  accentKey: AccentKey;
}

export interface User {
  id: string;
  nickname: string;
}

export interface QuestionSelection {
  userId: string;
  questionId: number;
  selectedAt: string;
}

