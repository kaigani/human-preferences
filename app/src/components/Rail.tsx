import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface FeedItem {
  id: string;
  title: string;
  source: string;
  when: string;
  thumb?: string;
}

/**
 * "Currently in the world" — current-events feed. The feed endpoint arrives in
 * Phase 3 (Claude Code injects timely items); until then this shows an
 * elegant empty state so the layout reads true to the concept.
 */
export function Rail() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/events/feed')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <aside className="rail">
      <div className="eyebrow">Currently in the world</div>
      <h3 className="serif">A feed to<br />shape the <em className="italic">now.</em></h3>

      {items && items.length > 0 ? (
        <div className="feed">
          {items.map((it) => (
            <div
              className="feed-item is-clickable"
              key={it.id}
              onClick={() => navigate('/judge?region=now')}
              role="button"
              tabIndex={0}
            >
              <div className="feed-thumb" style={it.thumb ? { backgroundImage: `url(${it.thumb})` } : undefined} />
              <div>
                <div className="f-title">{it.title}</div>
                <div className="f-meta">{it.source} · {it.when}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="feed-empty">
          No current events gathered yet. Run the worker’s <span style={{ fontStyle: 'normal' }}>inject-current-events</span> step
          to fold today’s headlines into opinion pairings.
        </p>
      )}
    </aside>
  );
}
