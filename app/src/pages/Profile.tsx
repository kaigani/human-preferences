import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import type { StatsSummary } from '@shared/types';

export function Profile() {
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const maxJudged = Math.max(1, ...(stats?.by_theme.map((t) => t.judged) ?? [1]));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="eyebrow">Profile</div>
      <h1 className="welcome serif" style={{ fontSize: 44, fontWeight: 300, margin: '10px 0 28px' }}>
        Your taste,<br />in <span className="italic">numbers.</span>
      </h1>

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="label">Judged</div>
          <div className="value serif">{(stats?.total_judged ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-cell">
          <div className="label">In queue</div>
          <div className="value serif">{(stats?.queued ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-cell">
          <div className="label">Total pairs</div>
          <div className="value serif">{(stats?.total_pairs ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-cell">
          <div className="label">Toward goal</div>
          <div className="value serif">{(stats?.percent ?? 0).toFixed(1)}%</div>
        </div>
      </div>

      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="eyebrow">By theme</span>
      </div>
      <div>
        {(stats?.by_theme ?? []).map((t) => (
          <div className="bar-row" key={t.theme_id}>
            <span className="serif" style={{ fontSize: 16 }}>{t.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(t.judged / maxJudged) * 100}%` }} />
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{t.judged}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 40, color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic', fontFamily: 'var(--serif)' }}>
        Export your taste profile (DPO dataset & LLM-judge rubric) arrives in the next build.
      </p>
    </motion.div>
  );
}
