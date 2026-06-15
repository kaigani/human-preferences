# Human Preferences — project guide

Local-first tool to capture personal A/B preferences and export them for
LLM-judging and fine-tuning. Schema-first and generalizable (open-source).

## Run it
```bash
npm install --cache ./.npm-cache     # global npm cache has root-owned files; use local
npm run db:migrate                   # apply schema/migrations to data/preferences.db
npm run dev                          # server (8787) + app (5173) via concurrently
npm run seed:demo                    # 46 curated demo pairs to judge immediately
```
Wrap long-running commands in `caffeinate -i` so the Mac doesn't sleep mid-batch.

## Architecture
- **server/** Fastify API + `better-sqlite3` (WAL, migrate-on-boot). `repo.ts` = data access.
- **app/** Vite + React SPA (editorial UI: Fraunces serif, gold accent). Proxies `/api` → 8787.
- **shared/types.ts** single source of truth for domain + protocol types.
- **schema/** SQL migrations + portable `preference-record.v1.json` export schema.
- **worker/** the generation exchange CLI (no model calls live in the app).

A **pair** is the SHP/DPO triple (context + option_a + option_b); a **judgment**
is the labeling event. Dedup is `content_hash` (sha256 of normalized, A/B-sorted
context|A|B). Every record carries `schema_version`.

## Generation = file exchange (no API keys in the app)
Three sources feed the judge queue, all landing through one ingest path:

### 1. Local Gemma — remote batch runner
Lives in `PC_SHARED/260615-gemma-runner/` (synced to the PC with Ollama).
```bash
npm run cli -- export-job --source theme --theme design --seeds 20 --pairs-per-seed 5
npm run cli -- export-job --source shp --seeds 200 --pairs-per-seed 2   # needs import:shp first
# → on the PC:  python3 -m pairgen.cli run --all-pending
npm run cli -- ingest-batch --job <job_id>
npm run cli -- list-jobs
```

### 2. SHP as a seed/topic corpus (NOT pre-made pairs)
```bash
npm run import:shp -- --spread --limit 2000   # streams from HF datasets-server
```
Each Reddit post's `history` → a seed context; its `domain` → an `shp:` theme.
The runner expands each into opinionated A/B stances (`opinion_stance_v1`).

### 3. Claude-Code driven generation (you, here)
**This is how Claude generates pairs** — no SDK/key, just author JSONL and ingest:
1. Write a `pairs.jsonl` where each line matches `GeneratedPairLine` (see shared/types.ts):
   `{seed_id, source_type, source_ref, theme_id, context, content_type, option_a,
     option_b, axis, strength, provider:"claude_code", model:"claude-opus-4-8",
     prompt_id, seed_context?}`. For current events set `source_type:"current_event"`,
   `theme_id:"current-events"`, and `seed_context` to the headline (the feed shows it).
2. `npm run cli -- ingest-file --file <path> --job <label>`

Good pairs: both options genuinely preferable (no strawman), one crisp sentence
each, a named `axis`. Current-events pairs should frame **values**, not partisanship.

## Conventions
- Keep the judge queue clean: only ingest real, high-quality pairs (delete test/mock).
- Personal data is gitignored (`data/`, `*.db`, `exports/`, `.env`). Code is public.
- `data/preferences.db` is the whole dataset — back up by copying the file.
