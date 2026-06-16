import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { getSessionId } from './session';
import type { Choice, PairForJudging, RobustnessSummary } from '@shared/types';

/** A "set" — a region-spanning batch of ~`size` pairs judged as one sitting,
 *  with a before/after robustness snapshot for the end-of-set summary. */
export function useSession(size = 20) {
  const [set, setSet] = useState<PairForJudging[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startR, setStartR] = useState<RobustnessSummary | null>(null);
  const [endR, setEndR] = useState<RobustnessSummary | null>(null);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    const [r, pairs] = await Promise.all([api.robustness(), api.nextSet(size)]);
    setStartR(r);
    setEndR(null);
    setSet(pairs);
    setIdx(0);
    setLoading(false);
  }, [size]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [idx, set]);

  const complete = set.length > 0 && idx >= set.length;

  // snapshot robustness once the set is finished
  useEffect(() => {
    if (complete && !endR) api.robustness().then(setEndR).catch(() => {});
  }, [complete, endR]);

  const submit = useCallback(
    async (choice: Choice, note?: string) => {
      const cur = set[idx];
      if (!cur) return;
      const latency_ms = Date.now() - shownAt.current;
      const session_id = await getSessionId();
      setIdx((i) => i + 1);
      try {
        await api.judge({ pair_id: cur.id, session_id, choice, note: note || null, latency_ms });
      } catch (err) {
        setIdx((i) => Math.max(0, i - 1));
        throw err;
      }
    },
    [set, idx],
  );

  return {
    current: complete ? null : set[idx] ?? null,
    done: idx,
    total: set.length,
    loading,
    complete,
    startR,
    endR,
    submit,
    startNext: load,
  };
}
