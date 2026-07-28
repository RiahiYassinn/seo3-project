import api from "@/lib/api";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  gap_key: string;
  skill: string | null;
}

export interface QuizAttemptSummary {
  attempted_at: string;
  score_percent: number;
  correct_count: number;
  total: number;
  passed: boolean;
}

export interface QuizState {
  recommendation_id: string;
  status: string;
  pass_percent: number;
  passed: boolean;
  passed_at: string | null;
  attempt_count: number;
  last_attempt: QuizAttemptSummary | null;
  quiz: {
    generated_at: string;
    provider: string;
    model: string;
    question_count: number;
    questions: QuizQuestion[];
  } | null;
}

export interface QuizQuestionResult {
  question_id: string;
  prompt: string;
  options: string[];
  selected_index: number;
  correct_index: number;
  correct: boolean;
  explanation: string;
  gap_key: string;
}

export interface QuizSubmission {
  passed: boolean;
  score_percent: number;
  correct_count: number;
  total: number;
  pass_percent: number;
  attempt_count: number;
  recommendation_status: string;
  results: QuizQuestionResult[];
}

export const quizAPI = {
  async get(recommendationId: string) {
    const response = await api.get<QuizState>(
      `/recommendations/${recommendationId}/quiz`,
    );
    return response.data;
  },

  async generate(recommendationId: string, regenerate = false) {
    const response = await api.post<QuizState>(
      `/recommendations/${recommendationId}/quiz/generate`,
      { regenerate },
    );
    return response.data;
  },

  async submit(
    recommendationId: string,
    answers: Array<{ questionId: string; selectedIndex: number }>,
  ) {
    const response = await api.post<QuizSubmission>(
      `/recommendations/${recommendationId}/quiz/submit`,
      { answers },
    );
    return response.data;
  },
};
