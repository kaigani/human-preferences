"""gemma-runner CLI.

Usage (from this folder, on the PC with Ollama running):
  python3 -m pairgen.cli run --all-pending
  python3 -m pairgen.cli run --job <job_id>
  python3 -m pairgen.cli run --all-pending --mock      # no model, smoke test
  python3 -m pairgen.cli list
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import load_config
from . import llm, runner

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config" / "default.json"


def main() -> None:
    ap = argparse.ArgumentParser(prog="pairgen")
    ap.add_argument("command", choices=["run", "list", "embed"])
    ap.add_argument("--job", help="process a single job id")
    ap.add_argument("--all-pending", action="store_true", help="process every job lacking COMPLETE.json")
    ap.add_argument("--mock", action="store_true", help="generate placeholder pairs without calling a model")
    ap.add_argument("--force", action="store_true", help="reprocess even if COMPLETE.json exists")
    ap.add_argument("--quiet", action="store_true", help="hide the live thinking/content traces")
    think_grp = ap.add_mutually_exclusive_group()
    think_grp.add_argument("--think", dest="think", action="store_true", default=None, help="force thinking on (overrides config)")
    think_grp.add_argument("--no-think", dest="think", action="store_false", help="force thinking off (overrides config)")
    ap.add_argument("--in", dest="embed_in", help="embed: input requests.jsonl (pair_id + text)")
    ap.add_argument("--out", dest="embed_out", help="embed: output results.jsonl (pair_id + embedding)")
    ap.add_argument("--config", default=str(DEFAULT_CONFIG))
    args = ap.parse_args()

    cfg = load_config(args.config, ROOT)

    if args.command == "embed":
        in_path = Path(args.embed_in) if args.embed_in else cfg.root / "embed" / "requests.jsonl"
        out_path = Path(args.embed_out) if args.embed_out else cfg.root / "embed" / "results.jsonl"
        model = cfg.provider.embedding_model
        if not model:
            ap.error("no embedding_model set in config")
        if not in_path.exists():
            ap.error(f"no requests file at {in_path} — run `npm run cli -- export-embed` on the app machine first")
        reqs = [json.loads(l) for l in in_path.read_text(encoding="utf-8").splitlines() if l.strip()]
        out_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Embedding {len(reqs)} item(s) with {model}…")
        ok = 0
        with out_path.open("w", encoding="utf-8") as f:
            for i, r in enumerate(reqs, 1):
                try:
                    vec = llm.embed(cfg, model, r["text"])
                    ok += 1
                except Exception as e:  # noqa: BLE001
                    vec = None
                    print(f"  [{i}] {r.get('pair_id')}: FAILED {e}")
                f.write(json.dumps({"pair_id": r["pair_id"], "embedding": vec}) + "\n")
                if i % 25 == 0:
                    print(f"  {i}/{len(reqs)}")
        print(f"✓ Embedded {ok}/{len(reqs)} → {out_path}")
        print("Now on the app machine:  npm run cli -- ingest-embeddings")
        return

    if args.command == "list":
        pending = runner.find_pending(cfg)
        print(f"Root: {cfg.root}")
        if not pending:
            print("  (no pending jobs)")
        for d in pending:
            print(f"  • {d.name}")
        return

    # run
    if args.job:
        process = [cfg.root / cfg.run.jobs_dir / args.job]
    elif args.all_pending:
        process = runner.find_pending(cfg)
    else:
        ap.error("run requires --job <id> or --all-pending")

    if not process:
        print("Nothing to do.")
        return

    print(f"Processing {len(process)} job(s)…")
    for job_dir in process:
        if not (job_dir / "job.json").exists():
            print(f"  [warn] {job_dir.name}: no job.json, skipping")
            continue
        runner.process_job(cfg, job_dir, mock=args.mock, force=args.force, show_traces=not args.quiet, think=args.think)
    print("All done. Now ingest on the app machine:  npm run cli -- ingest-batch --job <job_id>")


if __name__ == "__main__":
    main()
