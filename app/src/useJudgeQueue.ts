import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { getSessionId } from './session';
import type { Choice, PairForJudging } from '@shared/types';

const PREFETCH = 12;
const REFILL_AT = 4;

export function useJudgeQueue(theme?: string) {
  const [queue, setQueue] = useState<PairForJudging[]>([]);
  const [loading, setLoading] = useState(true);
  const [judgedCount, setJudgedCount] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const shownAt = useRef<number>(Date.now());
  const fetching = useRef(false);

  const refill = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const pairs = await api.nextPairs(PREFETCH, theme);
      setQueue((q) => {
        const seen = new Set(q.map((p) => p.id));
        return [...q, ...pairs.filter((p) => !seen.has(p.id))];
      });
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  }, [theme]);

  // reset when theme changes
  useEffect(() => {
    setQueue([]);
    setLoading(true);
    fetching.current = false;
    refill();
    api.queueCount(theme).then(setRemaining).catch(() => {});
  }, [refill, theme]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [queue[0]?.id]);

  const submit = useCallback(
    async (choice: Choice, note?: string) => {
      const current = queue[0];
      if (!current) return;
      const latency_ms = Date.now() - shownAt.current;
      const session_id = await getSessionId();
      // optimistic advance — every judgment (incl. skip) leaves the queue
      setQueue((q) => q.slice(1));
      setRemaining((n) => Math.max(0, n - 1));
      if (choice !== 'skip') setJudgedCount((n) => n + 1);
      try {
        await api.judge({ pair_id: current.id, session_id, choice, note: note || null, latency_ms });
      } catch (err) {
        // re-queue on failure
        setQueue((q) => [current, ...q]);
        setRemaining((n) => n + 1);
        if (choice !== 'skip') setJudgedCount((n) => Math.max(0, n - 1));
        throw err;
      }
    },
    [queue],
  );

  useEffect(() => {
    if (!loading && queue.length <= REFILL_AT) refill();
  }, [queue.length, loading, refill]);

  return { current: queue[0] ?? null, remaining, loading, submit, judgedCount };
}
