import type {
  JudgmentInput,
  PairForJudging,
  RobustnessSummary,
  Session,
  StatsSummary,
  Theme,
} from '@shared/types';

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => http<{ display_name: string }>('/api/me'),
  stats: () => http<StatsSummary>('/api/stats'),
  robustness: () => http<RobustnessSummary>('/api/profile/robustness'),
  nextSet: (size = 20) => http<{ pairs: PairForJudging[] }>(`/api/sets/next?size=${size}`).then((r) => r.pairs),
  themes: () => http<{ themes: Theme[] }>('/api/themes').then((r) => r.themes),
  nextPairs: (count = 12, theme?: string) =>
    http<{ pairs: PairForJudging[] }>(
      `/api/queue/next?count=${count}${theme ? `&theme=${encodeURIComponent(theme)}` : ''}`,
    ).then((r) => r.pairs),
  createSession: () =>
    http<Session>('/api/sessions', { method: 'POST', body: JSON.stringify({ device_label: navigator.platform }) }),
  judge: (input: JudgmentInput) =>
    http<{ id: string }>('/api/judgments', { method: 'POST', body: JSON.stringify(input) }),
};
