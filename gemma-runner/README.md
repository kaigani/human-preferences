# gemma-runner — preference pair generator

Batch generator for the **Human Preferences** app. Runs on the machine with a
local LLM (Ollama + Gemma) and exchanges files through a synced folder. No
network back to the app — the shared folder is a passive artifact store.

> **Deploying:** this directory is the canonical source. Copy or sync it to the
> folder pointed to by `SHARED_RUNNER_DIR` in the app's `.env` (a cloud-synced
> folder both machines see). The app writes `jobs/` there; this runner reads them.

```
app machine (TS)                 THIS shared folder                this PC (Python + Ollama)
────────────────                 ──────────────────                ─────────────────────────
export-job  ───────────────────▶ jobs/<id>/job.json
                                  jobs/<id>/seeds.jsonl  ─────────▶ python3 -m pairgen.cli run
                                                                     (Gemma: writer→formatter)
ingest-batch ◀─────────────────  jobs/<id>/pairs.jsonl  ◀─────────  writes pairs + COMPLETE.json
                                  jobs/<id>/COMPLETE.json
```

## Requirements
- Python 3.10+ (standard library only — no `pip install` needed)
- [Ollama](https://ollama.com) running locally with the models in `config/default.json`:
  - writer: `huihui_ai/gemma-4-abliterated:31b`
  - formatter: `qwen2.5-coder:32b` (coerces the writer's prose into strict JSON)
  - `ollama pull <model>` each if missing, or edit `config/default.json` to point at models you have.

## Run
From this folder:

```bash
# See what's waiting
python3 -m pairgen.cli list

# Generate for every job that lacks COMPLETE.json
python3 -m pairgen.cli run --all-pending

# Or a single job
python3 -m pairgen.cli run --job theme-design-XXXX

# Smoke test with no model (writes placeholder pairs)
python3 -m pairgen.cli run --all-pending --mock
```

Then back on the app machine:
```bash
npm run cli -- ingest-batch --job <job_id>
```

## Files per job
| File | Written by | Purpose |
|---|---|---|
| `job.json` | app | provider, model hint, prompt_id, counts |
| `seeds.jsonl` | app | one context per line to expand into pairs |
| `pairs.jsonl` | runner | generated A/B pairs (the deliverable) |
| `COMPLETE.json` | runner | manifest; presence means "done, safe to ingest" |
| `INGESTED.json` | app | written after ingest, for your records |

`llm_failures/` captures any seed whose model output couldn't be parsed (full
prompt + raw response), so nothing fails silently. A job with failures still
produces a `pairs.jsonl` for the seeds that succeeded and is marked `partial`.

## Config (`config/default.json`)
Tune `temperature`, `num_ctx`, `num_predict`, timeouts, retries. Set
`"use_formatter": false` to skip the second pass and ask Gemma for JSON directly
(faster, slightly less robust). Switch `writer_model`/`formatter_model` to match
what you have pulled.

## Overnight batches
`run --all-pending` processes jobs sequentially and is resume-safe: a job with a
`COMPLETE.json` is skipped (use `--force` to redo). Queue up many jobs from the
app, then leave this running.
