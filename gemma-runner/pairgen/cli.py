"""gemma-runner CLI.

Usage (from this folder, on the PC with Ollama running):
  python3 -m pairgen.cli run --all-pending
  python3 -m pairgen.cli run --job <job_id>
  python3 -m pairgen.cli run --all-pending --mock      # no model, smoke test
  python3 -m pairgen.cli list
"""
from __future__ import annotations

import argparse
from pathlib import Path

from .config import load_config
from . import runner

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = ROOT / "config" / "default.json"


def main() -> None:
    ap = argparse.ArgumentParser(prog="pairgen")
    ap.add_argument("command", choices=["run", "list"])
    ap.add_argument("--job", help="process a single job id")
    ap.add_argument("--all-pending", action="store_true", help="process every job lacking COMPLETE.json")
    ap.add_argument("--mock", action="store_true", help="generate placeholder pairs without calling a model")
    ap.add_argument("--force", action="store_true", help="reprocess even if COMPLETE.json exists")
    ap.add_argument("--quiet", action="store_true", help="hide the live thinking/content traces")
    ap.add_argument("--config", default=str(DEFAULT_CONFIG))
    args = ap.parse_args()

    cfg = load_config(args.config, ROOT)

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
        runner.process_job(cfg, job_dir, mock=args.mock, force=args.force, show_traces=not args.quiet)
    print("All done. Now ingest on the app machine:  npm run cli -- ingest-batch --job <job_id>")


if __name__ == "__main__":
    main()
