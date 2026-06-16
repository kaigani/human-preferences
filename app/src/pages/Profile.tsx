import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import { TIERS } from '@shared/regions';
import type { RobustnessSummary } from '@shared/types';

export function Profile() {
  const [rob, setRob] = useState<RobustnessSummary | null>(null);

  useEffect(() => {
    api.robustness().then(setRob).catch(() => {});
  }, []);

  const judged = rob?.total_judged ?? 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="eyebrow">Profile</div>
      <h1 className="welcome serif" style={{ fontSize: 44, fontWeight: 300, margin: '10px 0 28px' }}>
        How robust<br />is <span className="italic">you?</span>
      </h1>

      {/* robustness headline + breakdown */}
      <div className="stat-grid">
        <div className="stat-cell">
          <div className="label">Robustness</div>
          <div className="value serif">{rob?.robustness ?? 0}%</div>
        </div>
        <div className="stat-cell">
          <div className="label">Breadth</div>
          <div className="value serif">{rob?.breadth ?? 0}%</div>
        </div>
        <div className="stat-cell">
          <div className="label">Depth</div>
          <div className="value serif">{rob?.depth ?? 0}%</div>
        </div>
        <div className="stat-cell">
          <div className="label">Consistency</div>
          <div className="value serif">{rob?.consistency ?? 0}%</div>
        </div>
      </div>
      <p style={{ marginTop: 14, color: 'var(--color-text-muted)', fontSize: 13, fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
        {judged.toLocaleString()} DECISIVE JUDGMENTS · TIER: {(rob?.tier.current ?? '—').toUpperCase()}
      </p>

      {/* tier ladder */}
      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="eyebrow">The ladder</span>
      </div>
      <div className="ladder">
        {TIERS.map((t) => {
          const reached = judged >= t.min;
          const isCurrent = rob?.tier.current === t.label;
          return (
            <div key={t.id} className={`tier-row${isCurrent ? ' is-current' : ''}${reached ? '' : ' is-locked'}`}>
              <span className={`tier-marker${reached ? ' on' : ''}`} />
              <span className="tier-label serif">{t.label}</span>
              <span className="tier-min mono">{t.min.toLocaleString()}+</span>
              <span className="tier-unlocks">{t.unlocks}</span>
            </div>
          );
        })}
      </div>

      {/* exports */}
      <div className="section-head" style={{ marginTop: 44 }}>
        <span className="eyebrow">Export your taste</span>
      </div>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, maxWidth: '40em', lineHeight: 1.6 }}>
        The rubric drops into any model as a system prompt so it judges the way you would; the DPO
        set fine-tunes a proxy. Both export now — they sharpen as your robustness climbs.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20, alignItems: 'center' }}>
        <a className="btn-gold" href="/api/export/rubric" download>Taste rubric (.md) ↓</a>
        <a className="btn-gold" href="/api/export/dpo" download style={{ background: 'var(--color-action)', color: 'var(--color-text-inverse)', border: '1px solid var(--color-action)', boxShadow: 'none' }}>DPO dataset (.jsonl) ↓</a>
        <a className="text-link" href="/api/export/records" download style={{ alignSelf: 'center' }}>Portable records (.json) ↓</a>
      </div>
    </motion.div>
  );
}
