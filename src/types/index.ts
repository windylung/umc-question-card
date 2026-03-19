export type AccentKey =
  | "memory"
  | "confession"
  | "future"
  | "daily"
  | "deep"
  | "fun";

export type QuestionSection = "growth" | "connect";

export interface QuestionSet {
  id: string; // uuid
  teamNumber: number;
  section: QuestionSection;
  mainQuestion: string;
  capacity: number;
}

export interface SubQuestion {
  id: string; // uuid
  questionSetId: string; // uuid
  sortOrder: number;
  question: string;
}

export interface User {
  id: string;
  nickname: string;
  real_name?: string | null;
  role?: string | null;
}

export interface QuestionSelection {
  userId: string;
  questionSetId: string; // uuid
  selectedAt: string;
}

export interface DbQuestionSetRow {
  id: string;
  team_number: number;
  section: QuestionSection;
  main_question: string;
  capacity: number;
}

export interface DbSubQuestionRow {
  id: string;
  question_set_id: string;
  sort_order: number;
  question: string;
}

export interface DbQuestionSelectionRow {
  question_set_id: string;
  user_id: string;
}
