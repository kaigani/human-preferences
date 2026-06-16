import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ProgressRing } from '../components/ProgressRing';
import { ABSurface } from '../components/ABSurface';
import { TasteLedger } from '../components/TasteLedger';
import { SessionSummary } from '../components/SessionSummary';
import { useSession } from '../useSession';
import { api } from '../api';
import type { RobustnessSummary } from '@shared/types';

export function Dashboard({ name }: { name: string }) {
  const [rob, setRob] = useState<RobustnessSummary | null>(null);
  const session = useSession(20);

  useEffect(() => {
    api.robustness().then(setRob).catch(() => {});
  }, []);
  // keep the headline fresh as sets complete
  useEffect(() => {
    if (session.endR) setRob(session.endR);
  }, [session.endR]);

  const live = session.endR ?? rob;
  const robust = live?.robustness ?? 0;
  const tier = live?.tier;
  const regions = live?.regions ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      {/* ── header ── */}
      <div className="welcome-row">
        <div className="welcome">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
          >
            Welcome back,<br />
            <span className="italic">{name}.</span>
          </motion.h1>
          <p>
            Your preferences, one A/B choice at a time. The map below fills as you judge —
            and your profile grows more robust toward a proxy that judges the way you do.
          </p>
        </div>

        <div className="journey">
          <div className="eyebrow">Profile robustness</div>
          <div className="ring-wrap">
            <div>
              <div className="journey-count mono">{robust}%</div>
              <div className="journey-sub">
                {(tier?.current ?? '—').toUpperCase()}
                {tier?.next && <> · {tier.to_next.toLocaleString()} TO {tier.next.toUpperCase()}</>}
              </div>
            </div>
            <ProgressRing percent={robust} size={72} />
          </div>
        </div>
      </div>

      {/* ── today's set ── */}
      <div className="section-head">
        <span className="eyebrow">Today’s set</span>
        <span className="eyebrow" style={{ color: 'var(--color-text-muted)' }}>
          {session.complete ? 'complete' : `${session.done} / ${session.total}`} · A · B · N · S
        </span>
      </div>
      {session.complete ? (
        <SessionSummary
          judged={session.total}
          startR={session.startR}
          endR={session.endR}
          onNext={session.startNext}
        />
      ) : (
        <ABSurface pair={session.current} onSubmit={session.submit} loading={session.loading} />
      )}

      {/* ── taste map ── */}
      <div className="section-head">
        <span className="eyebrow">Your taste map</span>
        <span className="eyebrow" style={{ color: 'var(--color-text-muted)' }}>
          {tier?.next ? `unlocks ${tier.unlocks}` : tier?.unlocks}
        </span>
      </div>
      <TasteLedger regions={regions} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '40px 0 8px' }}>
        <span className="big-counter mono">{robust}%</span>
        <span className="serif italic" style={{ fontSize: 22, color: 'var(--color-text-secondary)' }}>
          {tier?.next ? `robust — ${(tier.to_next).toLocaleString()} to ${tier.next}.` : 'robust.'}
        </span>
      </div>
    </motion.div>
  );
}
