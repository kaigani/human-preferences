import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { artFor } from '../themeArt';
import { api } from '../api';
import type { StatsSummary, Theme } from '@shared/types';

export function Themes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.themes().then(setThemes).catch(() => {});
    api.stats().then(setStats).catch(() => {});
  }, []);

  const countFor = (id: string) => stats?.by_theme.find((t) => t.theme_id === id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="eyebrow">Themes</div>
      <h1 className="welcome serif" style={{ fontSize: 44, fontWeight: 300, margin: '10px 0 6px' }}>
        Where taste<br />takes <span className="italic">shape.</span>
      </h1>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, maxWidth: '34em', lineHeight: 1.6 }}>
        Each theme is a corner of judgment. Pick one to enter a focused stream of A/B pairings,
        or generate fresh ones from the worker.
      </p>

      <div className="tiles" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 36 }}>
        {themes.map((t) => {
          const c = countFor(t.id);
          return (
            <div
              key={t.id}
              className="tile"
              style={{ cursor: 'pointer', minHeight: '200px', '--tile-dot': artFor(t.id) } as Record<string, string>}
              onClick={() => navigate(`/judge?theme=${t.id}`)}
            >
              <div className="swatch" style={{ background: artFor(t.id) }} />
              <div>
                <div className="t-name">{t.label}</div>
                {t.description && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.45 }}>
                    {t.description}
                  </div>
                )}
                <div className="t-count" style={{ marginTop: 8 }}>
                  {c ? `${c.judged} judged · ${c.queued} queued` : 'no pairs yet'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
