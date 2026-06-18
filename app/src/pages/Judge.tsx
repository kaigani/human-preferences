import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ABSurface } from '../components/ABSurface';
import { useJudgeQueue } from '../useJudgeQueue';
import { REGIONS } from '@shared/regions';

export function Judge() {
  const [params] = useSearchParams();
  const theme = params.get('theme') ?? undefined;
  const region = params.get('region') ?? undefined;
  const { current, submit, loading, judgedCount, remaining } = useJudgeQueue({ theme, region });

  const title = useMemo(() => {
    if (region) return REGIONS.find((r) => r.id === region)?.label ?? region;
    if (theme) return theme[0].toUpperCase() + theme.slice(1);
    return 'All themes';
  }, [theme, region]);

  return (
    <div>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">Judging · {title}</div>
          <h1 className="welcome serif" style={{ fontSize: 40, fontWeight: 300, marginTop: 10 }}>
            One choice<br />at a <span className="italic">time.</span>
          </h1>
        </div>
        <div className="journey">
          <div className="eyebrow">This session</div>
          <div className="journey-count serif">{judgedCount}</div>
          <div className="journey-sub">{remaining.toLocaleString()} QUEUED</div>
        </div>
      </div>

      <div className="section-head">
        <span className="eyebrow">Which do you prefer?</span>
        <span className="eyebrow" style={{ color: 'var(--ink-3)' }}>A · B · N · S</span>
      </div>

      <ABSurface pair={current} onSubmit={submit} loading={loading} />
    </div>
  );
}
