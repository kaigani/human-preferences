import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ABSurface } from '../components/ABSurface';
import { useJudgeQueue } from '../useJudgeQueue';

export function Judge() {
  const [params] = useSearchParams();
  const theme = params.get('theme') ?? undefined;
  const { current, submit, loading, judgedCount, upcoming } = useJudgeQueue(theme);

  const title = useMemo(() => (theme ? theme[0].toUpperCase() + theme.slice(1) : 'All themes'), [theme]);

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
          <div className="journey-sub">{upcoming} QUEUED</div>
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
