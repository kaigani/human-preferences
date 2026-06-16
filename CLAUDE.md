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

## Progression ("Taste Map")
The dashboard is a progression frame, not a flat queue (`shared/regions.ts` + `server/robustness.ts`):
- **Regions** group themes (ideas / living / power / culture / narrative / visual / now). `regionForTheme()` maps each theme to one.
- **Robustness** (0–100) = 0.4·breadth + 0.4·depth + 0.2·consistency. Breadth = % of *active* regions ≥ `CALIBRATED_AT`; depth = avg fill toward `RICH_AT`; consistency = decisiveness (v1). `GET /api/profile/robustness`.
- **Tiers** (`TIERS`): Sketch → Calibrated (1k, unlocks rubric) → Proxy-ready (5k, DPO) → Robust (10k). Gated by decisive (a/b) judgment count.
- **Sets**: `GET /api/sets/next?size=20` assembles a region-spanning sitting (thinnest regions first). The dashboard judges by set with an end-of-set summary; the Questions page stays continuous/per-theme.
- **Aesthetic rule:** progression UI is strictly typographic — ledger index, dotted fills, tier words, electric-yellow highlight only. No charts/graphs.
- **Streaks:** consecutive judging days (computed from `judgments.created_at`), shown on the dashboard + session summary.

### Region content sources
- **Narrative** (film/tv/books/music/games, kind `narrative`): Claude-authored "which would you rather" pairs (see /tmp pattern), or the `narrative_pick_v1` runner prompt for bulk. Themes: `film`/`television`/`books`/`music`/`games`.
- **Visual** (kind `visual`): `npm run fetch:images` downloads CC0 art from the Art Institute of Chicago into `app/public/images/` (web-sized, bundled in repo so the set is identical for everyone); `npm run import:images` pairs them within category as `content_type:image_ref`. The Judge view renders images in the same A/B card chrome.
- **Consistency (future):** currently decisiveness; the planned re-test calibration (re-ask a paraphrase, measure flip-rate) would make it a true reliability signal.

## Redundancy / semantic dedup
Two layers keep near-identical pairs out of the judge queue:
1. **Generation diversity** — abstract themes use distinct facets per seed (`worker/seeds/themes.ts`); SHP selection round-robins across domains.
2. **Embeddings** — the runner embeds each pair (Ollama `mxbai-embed-large`) and includes the vector in `pairs.jsonl`. At ingest, a pair whose cosine similarity to a kept pair in the same theme is ≥ `DEDUP_THRESHOLD` (default 0.9, env-tunable) is stored as `status='flagged'` (out of the queue, reversible).

Backfill + audit existing pairs:
```bash
npm run cli -- export-embed            # writes embed/requests.jsonl to the shared folder
# on the PC:  python3 -m pairgen.cli embed
npm run cli -- ingest-embeddings       # stores the vectors
npm run cli -- audit-dupes [--theme <id>] [--threshold 0.9] [--apply]
```
`audit-dupes` greedy-clusters per theme (earliest pair is the representative); `--apply` flags only `queued` near-dups, never `judged` ones.

## Conventions
- Keep the judge queue clean: only ingest real, high-quality pairs (delete test/mock).
- Personal data is gitignored (`data/`, `*.db`, `exports/`, `.env`). Code is public.
- `data/preferences.db` is the whole dataset — back up by copying the file.
