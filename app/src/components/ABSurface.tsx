import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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

interface Props {
  pair: PairForJudging | null;
  onSubmit: (choice: Choice, note?: string) => Promise<void>;
  loading: boolean;
}

export function ABSurface({ pair, onSubmit, loading }: Props) {
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function choose(choice: Choice) {
    if (busy.current || !pair) return;
    busy.current = true;
    try {
      await onSubmit(choice, note.trim() || undefined);
      setNote('');
    } finally {
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
        <AnimatePresence mode="wait">
          <motion.div
            key={pair.id}
            className="ab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <div className="ab-card" onClick={() => choose('a')} role="button" tabIndex={0}>
              <div className="ab-top">
                <span className="pick-label">Option A</span>
                <span className="pick-kbd">A</span>
              </div>
              <Statement text={pair.options.a.content} />
            </div>

            <div className="ab-divider">
              <span className="line" />
              <span className="or">or</span>
              <span className="line" />
            </div>

            <div className="ab-card" onClick={() => choose('b')} role="button" tabIndex={0}>
              <div className="ab-top">
                <span className="pick-label">Option B</span>
                <span className="pick-kbd">B</span>
              </div>
              <Statement text={pair.options.b.content} />
            </div>
          </motion.div>
        </AnimatePresence>
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
