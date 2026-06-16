"""Ollama client (stdlib only) + live streaming traces + robust JSON + failure capture."""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from .config import AppConfig


class LLMError(Exception):
    pass


# ── ANSI helpers (terminal traces) ──────────────────────────────────
_DIM = "\033[2m"
_RESET = "\033[0m"
_CYAN = "\033[36m"
_YELLOW = "\033[33m"
_BOLD = "\033[1m"


def _w(s: str) -> None:
    sys.stdout.write(s)
    sys.stdout.flush()


def chat(
    cfg: AppConfig,
    model: str,
    prompt: str,
    *,
    as_json: bool,
    label: str,
    think: bool = False,
    show_traces: bool = True,
) -> str:
    """Streaming chat call. Prints thinking (dim) and content (bright) live.
    Returns the full message content (thinking is shown but not returned)."""
    url = f"{cfg.provider.base_url}/api/chat"
    payload: dict = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "keep_alive": "5m",
        "options": {
            "temperature": cfg.provider.temperature,
            "num_ctx": cfg.provider.num_ctx,
            "num_predict": cfg.provider.num_predict,
        },
    }
    if as_json:
        payload["format"] = "json"
    if think:
        payload["think"] = True

    last_err: Exception | None = None
    for attempt in range(cfg.run.max_retries + 1):
        try:
            return _stream(cfg, url, payload, label, show_traces)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = e
            if attempt < cfg.run.max_retries:
                wait = cfg.run.retry_backoff_seconds * (attempt + 1)
                _w(f"\n{_YELLOW}    [retry] {label}: {e} — waiting {wait}s{_RESET}\n")
                time.sleep(wait)
    raise LLMError(f"{label}: {last_err}")


def _stream(cfg: AppConfig, url: str, payload: dict, label: str, show_traces: bool) -> str:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})

    content_parts: list[str] = []
    in_think = False
    in_content = False

    if show_traces:
        _w(f"\n{_CYAN}{_BOLD}▶ {label}{_RESET}  {_DIM}[{payload['model']}]{_RESET}\n")

    with urllib.request.urlopen(req, timeout=cfg.provider.timeout_seconds) as resp:
        for raw in resp:
            line = raw.decode("utf-8").strip()
            if not line:
                continue
            chunk = json.loads(line)
            if chunk.get("error"):
                raise LLMError(str(chunk["error"]))
            msg = chunk.get("message", {})
            thinking = msg.get("thinking")
            content = msg.get("content")

            if thinking:
                if show_traces:
                    if not in_think:
                        _w(f"{_DIM}  ┄┄┄ thinking ┄┄┄\n  ")
                        in_think = True
                    _w(thinking.replace("\n", "\n  "))
            if content:
                if show_traces:
                    if not in_content:
                        if in_think:
                            _w(f"{_RESET}\n")
                        _w(f"{_CYAN}  ┄┄┄ content ┄┄┄{_RESET}\n  ")
                        in_content = True
                    _w(content.replace("\n", "\n  "))
                content_parts.append(content)

            if chunk.get("done"):
                break

    if show_traces:
        _w(f"{_RESET}\n")
    return "".join(content_parts)


# ── embeddings ──────────────────────────────────────────────────────
def embed(cfg: AppConfig, model: str, text: str) -> list[float]:
    """Embed a single string via Ollama. Returns the vector."""
    url = f"{cfg.provider.base_url}/api/embed"
    data = json.dumps({"model": model, "input": text}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=cfg.provider.timeout_seconds) as resp:
        out = json.loads(resp.read().decode("utf-8"))
    embs = out.get("embeddings")
    if embs and isinstance(embs, list):
        return embs[0]
    one = out.get("embedding")
    if one:
        return one
    raise LLMError(f"no embedding returned for model {model}")


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
    _w(f"{_YELLOW}    [failure] captured → {path.name}{_RESET}\n")
