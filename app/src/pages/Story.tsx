import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import { LIFE_CATEGORIES, PRIVACY_LEVELS } from '@shared/life';
import type { LifeEvent, LifeEventInput, Privacy } from '@shared/life';

const CAT_LABEL = Object.fromEntries(LIFE_CATEGORIES.map((c) => [c.id, c.label]));

const EMPTY: LifeEventInput = {
  category: 'family', subcategory: '', title: '', detail: '',
  date_start: '', people: '', place: '', significance: 3, privacy: 'private', status: 'past',
};

export function Story() {
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [draft, setDraft] = useState<LifeEventInput>(EMPTY);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.life().then((d) => setEvents(d.events)).catch(() => {});
  useEffect(() => { load(); }, []);

  const cat = LIFE_CATEGORIES.find((c) => c.id === draft.category) ?? LIFE_CATEGORIES[0];

  async function save() {
    if (!draft.title.trim() || busy) return;
    setBusy(true);
    try {
      await api.addLife(draft);
      setDraft(EMPTY);
      setAdding(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.deleteLife(id);
    await load();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">Your story</div>
          <h1 className="welcome serif" style={{ fontSize: 44, fontWeight: 300, margin: '10px 0 6px' }}>
            The chapters<br />that <span className="italic">made you.</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, maxWidth: '36em', lineHeight: 1.6 }}>
            Dated facts, roles, and turning points — the biographical backbone of your mindfile.
            This is <strong>private</strong> and lives only on your machine; it is never part of the
            shareable preference dataset.
          </p>
        </div>
        <div className="journey">
          <div className="eyebrow">Events</div>
          <div className="journey-count mono">{events.length}</div>
          <div className="journey-sub">
            <a href="/api/life/export" download style={{ textDecoration: 'underline' }}>EXPORT (PRIVATE)</a>
          </div>
        </div>
      </div>

      <div className="section-head">
        <span className="eyebrow">Timeline</span>
        <button className="text-link" onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : '+ Add event'}</button>
      </div>

      {adding && (
        <div className="life-form">
          <div className="life-form-grid">
            <label className="lf">
              <span className="lf-label">Category</span>
              <select className="lf-input" value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value, subcategory: '' })}>
                {LIFE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="lf">
              <span className="lf-label">Subcategory</span>
              <select className="lf-input" value={draft.subcategory ?? ''}
                onChange={(e) => setDraft({ ...draft, subcategory: e.target.value })}>
                <option value="">—</option>
                {cat.subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <p className="lf-question serif italic">{cat.question}</p>
          <input className="lf-input lf-title" placeholder="What happened? (one line)" value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
          <textarea className="lf-input lf-detail" placeholder="What changed afterward — why it matters now (optional)"
            value={draft.detail ?? ''} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} rows={2} />
          <div className="life-form-grid">
            <label className="lf">
              <span className="lf-label">When (YYYY, YYYY-MM, or full date)</span>
              <input className="lf-input" placeholder="2021-03" value={draft.date_start ?? ''}
                onChange={(e) => setDraft({ ...draft, date_start: e.target.value })} />
            </label>
            <label className="lf">
              <span className="lf-label">Who / where</span>
              <input className="lf-input" placeholder="people, place" value={draft.people ?? ''}
                onChange={(e) => setDraft({ ...draft, people: e.target.value })} />
            </label>
          </div>
          <div className="life-form-grid">
            <label className="lf">
              <span className="lf-label">Significance (1–5)</span>
              <input className="lf-input" type="number" min={1} max={5} value={draft.significance ?? 3}
                onChange={(e) => setDraft({ ...draft, significance: Number(e.target.value) })} />
            </label>
            <label className="lf">
              <span className="lf-label">Privacy</span>
              <select className="lf-input" value={draft.privacy}
                onChange={(e) => setDraft({ ...draft, privacy: e.target.value as Privacy })}>
                {PRIVACY_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 14 }}>
            <button className="btn-gold" onClick={save} disabled={!draft.title.trim() || busy}>Save to story</button>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
              <input type="checkbox" checked={draft.status === 'current'}
                onChange={(e) => setDraft({ ...draft, status: e.target.checked ? 'current' : 'past' })} /> ongoing / current
            </label>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="serif italic">Your story is unwritten.</div>
          <p>Add the events that shaped you — births, moves, losses, reinventions.</p>
        </div>
      ) : (
        <div className="timeline">
          {events.map((e) => (
            <div className="tl-row" key={e.id}>
              <span className="tl-date mono">{e.date_start || '—'}{e.ongoing ? '→' : ''}</span>
              <span className="tl-spine" />
              <div className="tl-body">
                <div className="tl-head">
                  <span className="tl-title serif">{e.title}</span>
                  {e.status === 'current' && <span className="tl-current">current</span>}
                </div>
                <div className="tl-meta">
                  <span className="tl-cat">{CAT_LABEL[e.category] ?? e.category}{e.subcategory ? ` · ${e.subcategory}` : ''}</span>
                  {e.significance ? <span className="tl-sig" title="significance">{'•'.repeat(e.significance)}</span> : null}
                  {e.privacy !== 'private' && <span className={`tl-priv pr-${e.privacy}`}>{e.privacy}</span>}
                </div>
                {e.detail && <p className="tl-detail">{e.detail}</p>}
                {(e.people || e.place) && <p className="tl-who">{[e.people, e.place].filter(Boolean).join(' · ')}</p>}
              </div>
              <button className="tl-del" onClick={() => remove(e.id)} title="remove">×</button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
