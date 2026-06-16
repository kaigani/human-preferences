"""Process jobs: read seeds.jsonl, generate pairs with Gemma, write pairs.jsonl."""
from __future__ import annotations

import json
import random
import time
from datetime import datetime
from pathlib import Path

from .config import AppConfig
from . import llm, prompts


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")


def _mock_pairs(seed: dict, n: int) -> list[dict]:
    axis = seed.get("axis_hint") or "this vs that"
    a_word, b_word = (axis.split(" vs ") + ["this", "that"])[:2]
    out = []
    for i in range(n):
        out.append({
            "context": f"[mock] {seed.get('theme_label','')}: facet {i+1} of {seed.get('context','')[:40]}",
            "option_a": f"A stance favoring {a_word.strip()} (mock {i+1}).",
            "option_b": f"A stance favoring {b_word.strip()} (mock {i+1}).",
            "axis": axis,
            "strength": round(random.uniform(0.6, 0.9), 2),
        })
    return out


def _generate_for_seed(cfg: AppConfig, job: dict, seed: dict, *, mock: bool, show_traces: bool = True, think: bool = False) -> list[dict]:
    n = int(seed.get("pairs_per_seed") or job.get("pairs_per_seed") or 3)
    prompt_id = job.get("prompt_id", "stance_contrast_v1")
    label = f"{job['job_id']}:{seed['seed_id']}"

    if mock:
        raw_pairs = _mock_pairs(seed, n)
    else:
        wprompt = prompts.writer_prompt(
            prompt_id,
            theme_label=seed.get("theme_label") or "",
            context=seed.get("context") or "",
            axis_hint=seed.get("axis_hint") or "",
            n=n,
        )
        use_fmt = cfg.provider.use_formatter and cfg.provider.formatter_model
        raw = ""
        try:
            if use_fmt:
                # two-pass: writer free-form (with thinking) → formatter to strict JSON
                writer_out = llm.chat(
                    cfg, cfg.provider.writer_model, wprompt,
                    as_json=False, label=label + ":write",
                    think=think, show_traces=show_traces,
                )
                fmt = prompts.formatter_prompt(writer_out)
                raw = llm.chat(
                    cfg, cfg.provider.formatter_model, fmt,
                    as_json=True, label=label + ":format",
                    think=False, show_traces=show_traces,
                )
            else:
                raw = llm.chat(
                    cfg, cfg.provider.writer_model, wprompt,
                    as_json=True, label=label,
                    think=think, show_traces=show_traces,
                )
            parsed = llm.extract_json(raw)
            raw_pairs = parsed.get("pairs", [])
        except Exception as e:  # noqa: BLE001 — capture and skip this seed
            llm.capture_failure(cfg, label, wprompt, raw, e)
            return []

    # map to GeneratedPairLine shape the TS ingester expects
    lines = []
    for p in raw_pairs:
        if not p.get("option_a") or not p.get("option_b"):
            continue
        lines.append({
            "seed_id": seed["seed_id"],
            "source_type": seed.get("source_type", "theme"),
            "source_ref": seed.get("source_ref"),
            "theme_id": seed.get("theme_id"),
            "context": p.get("context") or seed.get("context") or "",
            "content_type": "text",
            "option_a": p["option_a"],
            "option_b": p["option_b"],
            "axis": p.get("axis"),
            "strength": p.get("strength"),
            "provider": "ollama",
            "model": cfg.provider.writer_model if not mock else "mock",
            "prompt_id": prompt_id,
        })

    # embed each pair for semantic dedup on the app side
    if not mock and cfg.provider.embed and cfg.provider.embedding_model and lines:
        for ln in lines:
            try:
                txt = f"{ln['context']} || {ln['option_a']} || {ln['option_b']}"
                ln["embedding"] = llm.embed(cfg, cfg.provider.embedding_model, txt)
            except Exception:  # noqa: BLE001 — embedding is best-effort
                ln["embedding"] = None
        if show_traces:
            n_ok = sum(1 for ln in lines if ln.get("embedding"))
            llm._w(f"{llm._DIM}  embedded {n_ok}/{len(lines)} pair(s) [{cfg.provider.embedding_model}]{llm._RESET}\n")

    return lines


def process_job(cfg: AppConfig, job_dir: Path, *, mock: bool = False, force: bool = False, show_traces: bool = True, think: bool | None = None) -> dict:
    eff_think = cfg.provider.think if think is None else think
    job = json.loads((job_dir / "job.json").read_text(encoding="utf-8"))
    complete_path = job_dir / "COMPLETE.json"
    if complete_path.exists() and not force:
        print(f"  [skip] {job['job_id']} already COMPLETE")
        return json.loads(complete_path.read_text(encoding="utf-8"))

    seeds = _read_jsonl(job_dir / "seeds.jsonl")
    print(f"  [job] {job['job_id']} — {len(seeds)} seed(s), model={'mock' if mock else cfg.provider.writer_model}")

    started_at = datetime.now()
    t0 = time.time()
    all_lines: list[dict] = []
    failures = 0
    for i, seed in enumerate(seeds, 1):
        ts0 = time.time()
        lines = _generate_for_seed(cfg, job, seed, mock=mock, show_traces=show_traces, think=eff_think)
        dur = time.time() - ts0
        if not lines:
            failures += 1
        all_lines.extend(lines)
        print(f"    [{i}/{len(seeds)}] {seed['seed_id']} → {len(lines)} pair(s)  ({dur:.0f}s)")

    elapsed = time.time() - t0
    _write_jsonl(job_dir / "pairs.jsonl", all_lines)
    manifest = {
        "job_id": job["job_id"],
        "status": "complete" if failures == 0 else "partial",
        "produced_count": len(all_lines),
        "seed_count": len(seeds),
        "failures": failures,
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now().isoformat(),
        "elapsed_seconds": round(elapsed, 1),
        "seconds_per_seed": round(elapsed / len(seeds), 1) if seeds else None,
        "model": "mock" if mock else cfg.provider.writer_model,
    }
    complete_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(
        f"  [done] {job['job_id']} → {len(all_lines)} pair(s), {failures} failure(s) "
        f"in {elapsed / 60:.1f} min ({manifest['seconds_per_seed']}s/seed)"
    )
    return manifest


def find_pending(cfg: AppConfig) -> list[Path]:
    jobs_root = cfg.root / cfg.run.jobs_dir
    if not jobs_root.exists():
        return []
    return sorted(
        d for d in jobs_root.iterdir()
        if (d / "job.json").exists() and not (d / "COMPLETE.json").exists()
    )
