import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ProgressRing } from '../components/ProgressRing';
import { ABSurface } from '../components/ABSurface';
import { useJudgeQueue } from '../useJudgeQueue';
import { artFor } from '../themeArt';
import { api } from '../api';
import type { StatsSummary } from '@shared/types';

export function Dashboard({ name }: { name: string }) {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const navigate = useNavigate();
  const { current, submit, loading, judgedCount } = useJudgeQueue();

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const judged = (stats?.total_judged ?? 0) + judgedCount;
  const percent = stats ? Math.min(100, (judged / stats.goal) * 100) : 0;

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
            Your database, built on the shape of Stanford Human Preferences, learns what you
            like — one A/B choice at a time. The more you judge, the truer your proxy becomes.
          </p>
        </div>

        <div className="journey">
          <div className="eyebrow">Your preference journey</div>
          <div className="ring-wrap">
            <div>
              <div className="journey-count serif">{judged.toLocaleString()}</div>
              <div className="journey-sub">PREFERENCES JUDGED</div>
            </div>
            <div style={{ position: 'relative' }}>
              <ProgressRing percent={percent} size={72} />
              <span
                style={{
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
                }}
              >
                {percent < 1 ? percent.toFixed(1) : Math.round(percent)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── today's question ── */}
      <div className="section-head">
        <span className="eyebrow">Today’s question</span>
        <span className="eyebrow" style={{ color: 'var(--ink-3)' }}>A · B · N (no pref) · S (skip)</span>
      </div>
      <ABSurface pair={current} onSubmit={submit} loading={loading} />

      {/* ── themes ── */}
      <div className="section-head">
        <span className="eyebrow">More topics</span>
        <span className="text-link" onClick={() => navigate('/themes')} style={{ cursor: 'pointer' }}>
          All themes →
        </span>
      </div>
      <div className="tiles">
        {(stats?.by_theme ?? [])
          .filter((t) => t.kind === 'abstract' || t.kind === 'current_events')
          .slice(0, 5)
          .map((t) => (
          <div className="tile" key={t.theme_id} onClick={() => navigate(`/judge?theme=${t.theme_id}`)} style={{ cursor: 'pointer' }}>
            <div className="swatch" style={{ background: artFor(t.theme_id) }} />
            <div>
              <div className="t-name">{t.label}</div>
              <div className="t-count">{t.judged} judged · {t.queued} queued</div>
            </div>
          </div>
        ))}
        <div className="tile explore" onClick={() => navigate('/themes')} style={{ cursor: 'pointer' }}>
          <div className="t-name italic">Explore<br />more →</div>
          <div className="t-count">Generate new pairings</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '46px 0 8px' }}>
        <span className="big-counter serif">{(stats?.total_pairs ?? 0).toLocaleString()}+</span>
        <span className="serif italic" style={{ fontSize: 22, color: 'var(--ink-2)' }}>questions. Infinite you.</span>
      </div>
    </motion.div>
  );
}
