import type { RobustnessSummary } from '@shared/types';

interface Props {
  judged: number;
  startR: RobustnessSummary | null;
  endR: RobustnessSummary | null;
  onNext: () => void;
}

export function SessionSummary({ judged, startR, endR, onNext }: Props) {
  const from = startR?.robustness ?? 0;
  const to = endR?.robustness ?? from;
  const delta = to - from;

  return (
    <div className="session-summary">
      <div className="eyebrow">Set complete</div>
      <h2 className="serif">
        That’s <em className="italic">{judged}</em> more.
      </h2>

      <div className="summary-stats">
        <div>
          <span className="ss-label">Robustness</span>
          <span className="ss-value mono">
            {from}
            <span className="ss-arrow"> → </span>
            <span className="ss-now">{to}</span>
            {delta > 0 && <span className="ss-delta"> +{delta}</span>}
          </span>
        </div>
        <div>
          <span className="ss-label">Tier</span>
          <span className="ss-value mono">{endR?.tier.current ?? startR?.tier.current ?? '—'}</span>
        </div>
        <div>
          <span className="ss-label">To {endR?.tier.next ?? '—'}</span>
          <span className="ss-value mono">{(endR?.tier.to_next ?? 0).toLocaleString()}</span>
        </div>
      </div>

      <button className="btn-gold" onClick={onNext} style={{ marginTop: 28 }}>
        Next set →
      </button>
    </div>
  );
}
