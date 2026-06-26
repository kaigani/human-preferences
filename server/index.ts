import Fastify from 'fastify';
import 'dotenv/config';
import { getDb, migrate } from './db.js';
import {
  createSession,
  endSession,
  getFeed,
  getMeta,
  getNextPairs,
  getSet,
  getStats,
  listThemes,
  queuedRemaining,
  recordJudgment,
  setMeta,
} from './repo.js';
import { getRobustness } from './robustness.js';
import { createLifeEvent, deleteLifeEvent, lifeCounts, listLifeEvents } from './life.js';
import { refreshMemoryPairs } from './memory.js';
import type { LifeEventInput } from '../shared/life.js';
import { buildDpoJsonl, buildRecords, buildRubric } from '../export/build.js';
import type { Choice, JudgmentInput } from '@shared/types.js';

// Migrate-on-boot so the DB is always current.
migrate(getDb());

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT ?? 8787);
const VALID_CHOICES: Choice[] = ['a', 'b', 'skip', 'no_preference'];

// display name: local meta override → env default → 'Friend'. Local-only, never exported.
const displayName = () => getMeta('display_name') ?? process.env.USER_DISPLAY_NAME ?? 'Friend';

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/me', async () => ({ display_name: displayName() }));

app.post('/api/me', async (req, reply) => {
  const body = (req.body ?? {}) as { display_name?: string };
  const name = (body.display_name ?? '').trim().slice(0, 40);
  if (!name) return reply.code(400).send({ error: 'display_name required' });
  setMeta('display_name', name);
  return { display_name: name };
});

// ── sessions ──
app.post('/api/sessions', async (req) => {
  const body = (req.body ?? {}) as { device_label?: string };
  return createSession(body.device_label);
});

app.post<{ Params: { id: string } }>('/api/sessions/:id/end', async (req) => {
  endSession(req.params.id);
  return { ok: true };
});

// ── judge queue ──
app.get<{ Querystring: { theme?: string; region?: string; count?: string } }>('/api/queue/next', async (req) => {
  const count = Math.min(50, Math.max(1, Number(req.query.count ?? 10) || 10));
  const pairs = getNextPairs(count, { theme: req.query.theme, region: req.query.region });
  return { pairs };
});

app.get<{ Querystring: { theme?: string; region?: string } }>('/api/queue/count', async (req) => ({
  count: queuedRemaining({ theme: req.query.theme, region: req.query.region }),
}));

// ── judgments ──
app.post('/api/judgments', async (req, reply) => {
  const body = req.body as Partial<JudgmentInput>;
  if (!body?.pair_id || !body?.session_id) {
    return reply.code(400).send({ error: 'pair_id and session_id are required' });
  }
  if (!VALID_CHOICES.includes(body.choice as Choice)) {
    return reply.code(400).send({ error: `choice must be one of ${VALID_CHOICES.join(', ')}` });
  }
  try {
    const id = recordJudgment({
      pair_id: body.pair_id,
      session_id: body.session_id,
      choice: body.choice as Choice,
      note: body.note ?? null,
      latency_ms: body.latency_ms ?? null,
    });
    return { id };
  } catch (err) {
    return reply.code(409).send({ error: (err as Error).message });
  }
});

// ── themes ──
app.get('/api/themes', async () => ({ themes: listThemes() }));

// ── current-events feed ──
app.get('/api/events/feed', async () => ({ items: getFeed() }));

// ── exports (download) ──
app.get('/api/export/dpo', async (_req, reply) => {
  const { jsonl } = buildDpoJsonl();
  return reply
    .header('content-type', 'application/x-ndjson')
    .header('content-disposition', 'attachment; filename="dpo.jsonl"')
    .send(jsonl);
});

app.get('/api/export/records', async (_req, reply) => {
  const records = buildRecords();
  return reply
    .header('content-type', 'application/json')
    .header('content-disposition', 'attachment; filename="preference-records.json"')
    .send(JSON.stringify({ schema_version: 1, records }, null, 2));
});

app.get('/api/export/rubric', async (_req, reply) => {
  const { markdown } = buildRubric(displayName());
  return reply
    .header('content-type', 'text/markdown')
    .header('content-disposition', 'attachment; filename="taste-rubric.md"')
    .send(markdown);
});

// ── progression ──
app.get('/api/profile/robustness', async () => getRobustness());

app.get<{ Querystring: { size?: string } }>('/api/sets/next', async (req) => {
  const size = Math.min(40, Math.max(5, Number(req.query.size ?? 20) || 20));
  return { pairs: getSet(size) };
});

// ── life events (biography layer — private, never in preference exports) ──
app.get('/api/life', async () => ({ events: listLifeEvents(), counts: lifeCounts() }));

app.post('/api/life', async (req, reply) => {
  const body = req.body as Partial<LifeEventInput>;
  if (!body?.category || !body?.title?.trim()) {
    return reply.code(400).send({ error: 'category and title are required' });
  }
  const event = createLifeEvent(body as LifeEventInput);
  refreshMemoryPairs(); // keep the "what shaped you" salience pairs in sync
  return event;
});

// Regenerate memory-salience pairs from current life events.
app.post('/api/memory/refresh', async () => refreshMemoryPairs());

app.delete<{ Params: { id: string } }>('/api/life/:id', async (req) => ({
  deleted: deleteLifeEvent(req.params.id),
}));

// Private biography export — for the mindfile. Explicitly separate from the
// anonymous preference exports; marked private so it's never confused with them.
app.get('/api/life/export', async (_req, reply) => {
  const events = listLifeEvents();
  const payload = {
    kind: 'mindfile-biography',
    privacy: 'PRIVATE — personal biography, not part of the shareable preference dataset',
    schema_version: 1,
    events,
  };
  return reply
    .header('content-type', 'application/json')
    .header('content-disposition', 'attachment; filename="biography.private.json"')
    .send(JSON.stringify(payload, null, 2));
});

// ── stats ──
app.get('/api/stats', async () => getStats());

app
  .listen({ port: PORT, host: '127.0.0.1' })
  .then((addr) => app.log.info(`Human Preferences API on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
