import type {
  JudgmentInput,
  PairForJudging,
  RobustnessSummary,
  Session,
  StatsSummary,
  Theme,
} from '@shared/types';

export interface QueueSelector {
  theme?: string;
  region?: string;
}

function selQs(sel: QueueSelector | undefined, lead: '?' | '&'): string {
  const p = new URLSearchParams();
  if (sel?.theme) p.set('theme', sel.theme);
  if (sel?.region) p.set('region', sel.region);
  const s = p.toString();
  return s ? `${lead}${s}` : '';
}

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
  setMe: (display_name: string) =>
    http<{ display_name: string }>('/api/me', { method: 'POST', body: JSON.stringify({ display_name }) }).then((r) => r.display_name),
  stats: () => http<StatsSummary>('/api/stats'),
  robustness: () => http<RobustnessSummary>('/api/profile/robustness'),
  nextSet: (size = 20) => http<{ pairs: PairForJudging[] }>(`/api/sets/next?size=${size}`).then((r) => r.pairs),
  themes: () => http<{ themes: Theme[] }>('/api/themes').then((r) => r.themes),
  nextPairs: (count = 12, sel?: QueueSelector) =>
    http<{ pairs: PairForJudging[] }>(`/api/queue/next?count=${count}${selQs(sel, '&')}`).then((r) => r.pairs),
  queueCount: (sel?: QueueSelector) =>
    http<{ count: number }>(`/api/queue/count${selQs(sel, '?')}`).then((r) => r.count),
  createSession: () =>
    http<Session>('/api/sessions', { method: 'POST', body: JSON.stringify({ device_label: navigator.platform }) }),
  judge: (input: JudgmentInput) =>
    http<{ id: string }>('/api/judgments', { method: 'POST', body: JSON.stringify(input) }),
};
