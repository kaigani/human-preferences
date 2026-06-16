import { useEffect, useRef, useState } from 'react';
import type { Choice, PairForJudging } from '@shared/types';

/** Italicize the final word of a statement for editorial flair. */
function Statement({ text }: { text: string }) {
  const words = text.trim().split(' ');
  const last = words.pop() ?? '';
  return (
    <div className="statement">
      {words.join(' ')} <em className="accent">{last}</em>
    </div>
  );
}

/** Render an option by content type — a statement, or an image with caption. */
function OptionContent({
  type,
  option,
}: {
  type: PairForJudging['content_type'];
  option: { content: string; meta?: Record<string, unknown> };
}) {
  if (type === 'image_ref') {
    const m = option.meta ?? {};
    const title = (m.title as string) ?? '';
    const artist = (m.artist as string) ?? '';
    return (
      <figure className="ab-figure">
        <img className="ab-img" src={option.content} alt={(m.alt as string) ?? title} loading="lazy" draggable={false} />
        {(title || artist) && (
          <figcaption className="ab-caption">
            {title}
            {artist && <span className="ab-caption-artist"> · {artist}</span>}
          </figcaption>
        )}
      </figure>
    );
  }
  return <Statement text={option.content} />;
}

interface Props {
  pair: PairForJudging | null;
  onSubmit: (choice: Choice, note?: string) => Promise<void>;
  loading: boolean;
}

export function ABSurface({ pair, onSubmit, loading }: Props) {
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<'a' | 'b' | null>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function choose(choice: Choice) {
    if (busy.current || !pair) return;
    busy.current = true;
    if (choice === 'a' || choice === 'b') {
      setSelected(choice);
      await new Promise((r) => setTimeout(r, 190)); // brief signal flash
    }
    try {
      await onSubmit(choice, note.trim() || undefined);
      setNote('');
    } finally {
      setSelected(null);
      busy.current = false;
    }
  }

  // keyboard: A / ← left, B / → right, N no-preference, S skip
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.activeElement === noteRef.current) {
        if (e.key === 'Enter') noteRef.current?.blur();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'a' || e.key === 'ArrowLeft') { e.preventDefault(); choose('a'); }
      else if (k === 'b' || e.key === 'ArrowRight') { e.preventDefault(); choose('b'); }
      else if (k === 'n') { e.preventDefault(); choose('no_preference'); }
      else if (k === 's') { e.preventDefault(); choose('skip'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!pair) {
    return (
      <div className="empty-state">
        <div className="serif italic">
          {loading ? 'Gathering questions…' : 'You’ve judged everything in the queue.'}
        </div>
        <p>{loading ? 'One moment.' : 'Generate more from the Themes page, or gather a current-events feed.'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="judge-context serif italic">{pair.context}</div>
      {pair.axis && <div className="judge-axis">{pair.axis}</div>}

      <div style={{ marginTop: 18 }}>
        <div key={pair.id} className="ab ab-enter">
          <div className={`ab-card${selected === 'a' ? ' selected' : ''}`} onClick={() => choose('a')} role="button" tabIndex={0}>
            <div className="ab-top">
              <span className="pick-label">Option A</span>
              <span className="pick-kbd">A</span>
            </div>
            <OptionContent type={pair.content_type} option={pair.options.a} />
          </div>

          <div className="ab-divider">
            <span className="line" />
            <span className="or">or</span>
            <span className="line" />
          </div>

          <div className={`ab-card${selected === 'b' ? ' selected' : ''}`} onClick={() => choose('b')} role="button" tabIndex={0}>
            <div className="ab-top">
              <span className="pick-label">Option B</span>
              <span className="pick-kbd">B</span>
            </div>
            <OptionContent type={pair.content_type} option={pair.options.b} />
          </div>
        </div>
      </div>

      <div className="judge-controls">
        <input
          ref={noteRef}
          className="note-input"
          placeholder="Add a note on why — optional, but gold for your mindfile"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="text-link" onClick={() => choose('no_preference')}>No preference</button>
        <button className="text-link" onClick={() => choose('skip')}>Skip →</button>
      </div>
    </div>
  );
}
