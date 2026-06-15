"""Config loading — JSON defaults with CLI overrides. Stdlib only."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ProviderConfig:
    mode: str
    base_url: str
    writer_model: str
    formatter_model: str | None
    use_formatter: bool
    timeout_seconds: int
    temperature: float
    num_ctx: int
    num_predict: int


@dataclass
class RunConfig:
    jobs_dir: str
    failures_dir: str
    max_retries: int
    retry_backoff_seconds: int


@dataclass
class AppConfig:
    project_name: str
    provider: ProviderConfig
    run: RunConfig
    root: Path


def load_config(path: str | Path, root: str | Path) -> AppConfig:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return AppConfig(
        project_name=raw["project_name"],
        provider=ProviderConfig(**raw["provider"]),
        run=RunConfig(**raw["run"]),
        root=Path(root).resolve(),
    )
