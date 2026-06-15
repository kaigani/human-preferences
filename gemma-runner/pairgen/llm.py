"""Ollama client (stdlib only) + robust JSON extraction + failure capture."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from .config import AppConfig


class LLMError(Exception):
    pass


def _post(url: str, payload: dict, timeout: int) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def chat(cfg: AppConfig, model: str, prompt: str, *, as_json: bool, label: str) -> str:
    """Single non-streaming chat call. Retries on transient errors."""
    url = f"{cfg.provider.base_url}/api/chat"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "keep_alive": "5m",
        "options": {
            "temperature": cfg.provider.temperature,
            "num_ctx": cfg.provider.num_ctx,
            "num_predict": cfg.provider.num_predict,
        },
    }
    if as_json:
        payload["format"] = "json"

    last_err: Exception | None = None
    for attempt in range(cfg.run.max_retries + 1):
        try:
            out = _post(url, payload, cfg.provider.timeout_seconds)
            return out.get("message", {}).get("content", "")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if attempt < cfg.run.max_retries:
                wait = cfg.run.retry_backoff_seconds * (attempt + 1)
                print(f"    [retry] {label}: {e} — waiting {wait}s")
                time.sleep(wait)
    raise LLMError(f"{label}: {last_err}")


# ── JSON extraction / repair ────────────────────────────────────────
_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def extract_json(text: str) -> dict:
    """Parse a JSON object from possibly-noisy model output."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = _JSON_BLOCK.search(text)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            # last resort: strip trailing commas
            cleaned = re.sub(r",\s*([}\]])", r"\1", m.group(0))
            return json.loads(cleaned)
    raise json.JSONDecodeError("no JSON object found", text, 0)


def capture_failure(cfg: AppConfig, label: str, prompt: str, raw: str, err: Exception) -> None:
    fdir = cfg.root / cfg.run.failures_dir
    fdir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    safe = re.sub(r"[^a-zA-Z0-9_-]", "-", label)[:60]
    path = fdir / f"{ts}_{safe}.txt"
    path.write_text(
        f"=== ERROR ===\n{err!r}\n\n=== LABEL ===\n{label}\n\n"
        f"=== PROMPT ===\n{prompt}\n\n=== RAW CONTENT ===\n{raw}\n",
        encoding="utf-8",
    )
    print(f"    [failure] captured → {path.name}")
