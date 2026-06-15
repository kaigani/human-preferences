import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import type { StatsSummary } from '@shared/types';

export function Profile() {
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  const themesWithPairs = (stats?.by_theme ?? []).filter((t) => t.judged + t.queued > 0);
  const maxJudged = Math.max(1, ...themesWithPairs.map((t) => t.judged), 1);

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
        {themesWithPairs.map((t) => (
          <div className="bar-row" key={t.theme_id}>
            <span className="serif" style={{ fontSize: 16 }}>{t.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(t.judged / maxJudged) * 100}%` }} />
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{t.judged}</span>
          </div>
        ))}
      </div>

      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="eyebrow">Export your taste</span>
      </div>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, maxWidth: '40em', lineHeight: 1.6 }}>
        Your judgments, ready to use elsewhere. The DPO set fine-tunes a proxy; the
        rubric drops into any model as a system prompt so it judges the way you would.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
        <a className="btn-gold" href="/api/export/rubric" download>Taste rubric (.md) ↓</a>
        <a className="btn-gold" href="/api/export/dpo" download style={{ background: 'var(--ink)', color: 'var(--paper)', boxShadow: 'none' }}>DPO dataset (.jsonl) ↓</a>
        <a className="text-link" href="/api/export/records" download style={{ alignSelf: 'center' }}>Portable records (.json) ↓</a>
      </div>
      <p style={{ marginTop: 16, color: 'var(--ink-3)', fontSize: 12 }}>
        Skip / no-preference judgments are kept in the portable records but excluded from the DPO set.
      </p>
    </motion.div>
  );
}
