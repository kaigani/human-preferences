// Biography layer data access — life events. Kept apart from repo.ts (pairs/
// judgments) on purpose; these are private facts, never in preference exports.
import { nanoid } from 'nanoid';
import { getDb } from './db.js';
import type { LifeEvent, LifeEventInput } from '../shared/life.js';

const db = getDb();

const insertStmt = db.prepare(`
  INSERT INTO life_events
    (id, category, subcategory, title, detail, date_start, date_end, ongoing,
     people, place, significance, privacy, status)
  VALUES
    (@id, @category, @subcategory, @title, @detail, @date_start, @date_end, @ongoing,
     @people, @place, @significance, @privacy, @status)
`);

export function createLifeEvent(input: LifeEventInput): LifeEvent {
  const id = `life_${nanoid(12)}`;
  insertStmt.run({
    id,
    category: input.category,
    subcategory: input.subcategory ?? null,
    title: input.title,
    detail: input.detail ?? null,
    date_start: input.date_start ?? null,
    date_end: input.date_end ?? null,
    ongoing: input.ongoing ? 1 : 0,
    people: input.people ?? null,
    place: input.place ?? null,
    significance: input.significance ?? null,
    privacy: input.privacy ?? 'private',
    status: input.status ?? 'past',
  });
  return getLifeEvent(id)!;
}

const selectOne = db.prepare(`SELECT * FROM life_events WHERE id = ?`);
export function getLifeEvent(id: string): LifeEvent | null {
  return (selectOne.get(id) as LifeEvent) ?? null;
}

// Sort: dated events chronologically, undated last (by creation).
const selectAll = db.prepare(`
  SELECT * FROM life_events
  ORDER BY (date_start IS NULL), date_start, created_at
`);
export function listLifeEvents(): LifeEvent[] {
  return selectAll.all() as LifeEvent[];
}

const deleteStmt = db.prepare(`DELETE FROM life_events WHERE id = ?`);
export function deleteLifeEvent(id: string): boolean {
  return deleteStmt.run(id).changes > 0;
}

const countByCategory = db.prepare(`SELECT category, COUNT(*) AS n FROM life_events GROUP BY category`);
export function lifeCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of countByCategory.all() as { category: string; n: number }[]) out[r.category] = r.n;
  return out;
}
