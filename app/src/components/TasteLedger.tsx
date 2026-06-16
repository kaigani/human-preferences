import { RICH_AT } from '@shared/regions';
import type { RegionStat } from '@shared/types';

const FILL_DOTS = 10;

function Dots({ judged, state }: { judged: number; state: RegionStat['state'] }) {
  if (state === 'unmapped') return <span className="ledger-dash">—</span>;
  const on = Math.max(1, Math.round(Math.min(judged / RICH_AT, 1) * FILL_DOTS));
  return (
    <span className="dots" aria-hidden>
      {Array.from({ length: FILL_DOTS }, (_, i) => (
        <span key={i} className={`dot${i < on ? ' on' : ''}${state === 'rich' ? ' lit' : ''}`} />
      ))}
    </span>
  );
}

export function TasteLedger({ regions, onPick }: { regions: RegionStat[]; onPick?: (id: string) => void }) {
  return (
    <div className="ledger">
      {regions.map((r, i) => (
        <div
          key={r.id}
          className={`ledger-row${r.state === 'unmapped' ? ' is-unmapped' : ''}`}
          onClick={() => r.state !== 'unmapped' && onPick?.(r.id)}
          style={{ cursor: r.state !== 'unmapped' && onPick ? 'pointer' : 'default' }}
        >
          <span className="ledger-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="ledger-label">{r.label}</span>
          <Dots judged={r.judged} state={r.state} />
          <span className={`ledger-state st-${r.state}`}>{r.state === 'unmapped' ? 'unmapped' : r.state}</span>
        </div>
      ))}
    </div>
  );
}
