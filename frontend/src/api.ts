import type { CountsByStatus, QuestionStatus, TownHallQuestion, TownHallSettings } from './types';

export interface QuestionListResponse {
  questions: TownHallQuestion[];
  total: number;
  countsByStatus: CountsByStatus[];
}

export interface QuestionFilters {
  search?: string;
  status?: string;
  category?: string;
  isAnswered?: string;
  selected?: string;
  duplicates?: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function submitQuestion(questionText: string): Promise<{ ok: true }> {
  return request('/api/questions', {
    method: 'POST',
    body: JSON.stringify({ questionText })
  });
}

export function getSettings(): Promise<TownHallSettings> {
  return request('/api/public/settings');
}

export function listQuestions(filters: QuestionFilters): Promise<QuestionListResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  return request(`/api/admin/questions?${params.toString()}`);
}

export function updateQuestion(id: string, changes: Partial<TownHallQuestion>): Promise<TownHallQuestion> {
  return request(`/api/admin/questions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes)
  });
}

export function getPresenterQuestions(): Promise<{ questions: TownHallQuestion[] }> {
  return request('/api/presenter/questions');
}

export function markPresentedAnswered(id: string): Promise<TownHallQuestion> {
  return request(`/api/presenter/questions/${encodeURIComponent(id)}/answered`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function updateSettings(settings: Partial<TownHallSettings>): Promise<TownHallSettings> {
  return request('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings)
  });
}

export const statusOptions: QuestionStatus[] = ['New', 'Reviewed', 'Selected', 'Answered', 'Duplicate', 'Archived'];
