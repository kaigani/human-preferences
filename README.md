<div align="center">

# Human Preferences

**A local-first tool for capturing your personal taste as a dataset.**

Judge thousands of A/B pairs → export a profile that teaches any model to
judge *the way you would*, or to fine-tune a proxy of you.

</div>

---

## Why

Two goals, one schema:

1. **A taste profile / LLM-judge rubric** — attach your revealed preferences to an
   existing model so it can rank subjective work (screenplays, designs, copy…) the
   way *you* would.
2. **A mindfile** — accumulate enough personal preference data to one day fine-tune
   a proxy of your judgment.

The data shape mirrors [Stanford Human Preferences (SHP)](https://huggingface.co/datasets/stanfordnlp/SHP)
and maps cleanly to DPO/RLHF — but the *content* is yours, not the crowd's.

## Quickstart

```bash
npm install --cache ./.npm-cache    # see note on the npm cache below
cp .env.example .env                 # edit USER_DISPLAY_NAME etc.
npm run db:migrate                   # create data/preferences.db
npm run seed:demo                    # 46 curated pairs to start judging now
npm run dev                          # → app on http://localhost:5173, API on :8787
```

Open the app and start judging. Keyboard: **A** / **B** to choose, **N** for no
preference, **S** to skip. Add an optional note on *why* — it's gold for the rubric.

> **npm cache:** if `npm install` fails with `EACCES` on `~/.npm`, this repo already
> points npm at a project-local cache via `.npmrc`. Run commands under
> `caffeinate -i` on macOS so long batches don't get interrupted by sleep.

## How it works

```
 React SPA (Vite, :5173) ──/api──▶ Fastify (:8787) ──▶ SQLite (WAL)
        the judging UI                  REST              one file = your dataset
```

- A **pair** is the SHP/DPO triple: `context + option_a + option_b`.
- A **judgment** is your choice (`a`/`b`/`skip`/`no_preference`) + optional note + latency.
- Everything carries `schema_version`; dedup is a content hash of the normalized,
  order-independent `context|A|B`. Schema lives in [`schema/`](schema/) — the SQL
  migration and a portable [`preference-record.v1.json`](schema/preference-record.v1.json).

## Filling the queue (generation)

Generation never calls a model from inside the app — pairs arrive via a simple
file/ingest protocol, from three sources:

| Source | How |
|---|---|
| **Local Gemma** (bulk) | `export-job` writes a job to a synced folder; a Python runner ([`gemma-runner/`](gemma-runner/)) on a second machine produces pairs with Ollama; `ingest-batch` reads them back. |
| **SHP corpus** | `npm run import:shp -- --spread --limit 2000` streams Reddit posts as *seed topics* (not pre-made pairs); generation turns each into opinionated A/B stances. |
| **Claude Code** | Drive [Claude Code](https://claude.com/claude-code) in this repo to author high-quality or current-events pairs directly, then `ingest-file`. |

See [`CLAUDE.md`](CLAUDE.md) for the exact commands and the `GeneratedPairLine` shape.

## Exporting your taste

From the **Profile** page, or the CLI:

```bash
npm run export:dpo      # exports/dpo.jsonl  → {prompt, chosen, rejected, meta}
npm run export:rubric   # exports/taste-rubric.md → an LLM-judge system prompt
```

- **DPO/RLHF JSONL** — drop into a `DPOTrainer`-style pipeline. Skip / no-preference
  are excluded; provenance is preserved in `meta`.
- **Taste rubric** — a system prompt synthesized from your real choices (with your
  notes), grouped by theme and weighted by sample size. Paste it into any model so it
  judges like you.

## Privacy

Your preferences are **yours**. The code is open-source; your data is not. `.gitignore`
keeps `data/` (the SQLite DB), `exports/`, and `.env` out of git from the first commit.
Back up your dataset by copying `data/preferences.db`.

## Project layout

```
schema/      SQL migrations + portable export JSON Schema
shared/      domain + protocol types (one source of truth)
server/      Fastify API + better-sqlite3
app/         Vite + React SPA (editorial UI)
worker/      generation exchange CLI (export-job / ingest-batch / import:shp)
export/      DPO + rubric builders
gemma-runner/  Python batch runner for local Ollama/Gemma (runs on a 2nd machine)
```

## License

MIT — see [LICENSE](LICENSE).
