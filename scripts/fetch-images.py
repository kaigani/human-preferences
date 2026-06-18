"""Fetch a curated, redistributable image collection for the Visual taste region.

Pulls modern CC0 / public-domain photography from the Openverse API across a
spread of aesthetic categories, downloads web-sized thumbnails (~600px) into
app/public/images/, and MERGES into the manifest (keeping any existing entries
whose files still exist). Reproducible — re-run to refresh/expand.

Only cc0 + pdm (public domain mark) are pulled — both are safe to redistribute
in this repo (Unsplash/Pexels/Pixabay licenses restrict bundling, so they're
deliberately excluded). Stdlib only.

Usage:  python3 scripts/fetch-images.py [--per-category 8]
"""
from __future__ import annotations

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "public" / "images"
API = "https://api.openverse.org/v1/images/"
UA = {"User-Agent": "human-preferences/0.1 (open-source taste tool)"}

# category -> search query. Spread across moods/subjects to probe visual taste.
CATEGORIES: dict[str, str] = {
    "architecture": "modern architecture building",
    "landscape": "landscape nature scenery",
    "street": "street photography city",
    "portrait": "portrait face person",
    "minimal": "minimalism minimalist",
    "abstract": "abstract pattern",
    "interior": "interior design room",
    "food": "food dish",
    "wildlife": "wildlife animal",
    "still-life": "still life flowers",
}

PER_CATEGORY = 8
for i, a in enumerate(sys.argv):
    if a == "--per-category" and i + 1 < len(sys.argv):
        PER_CATEGORY = int(sys.argv[i + 1])


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            dest.write_bytes(r.read())
        return dest.stat().st_size > 2000
    except Exception as e:  # noqa: BLE001
        print(f"    [skip] {dest.name}: {e}")
        return False


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # keep existing manifest entries whose files still exist
    manifest: list[dict] = []
    seen_files: set[str] = set()
    mpath = OUT / "manifest.json"
    if mpath.exists():
        for m in json.loads(mpath.read_text(encoding="utf-8")):
            if (OUT / m["file"]).exists():
                manifest.append(m)
                seen_files.add(m["file"])

    for cat, query in CATEGORIES.items():
        params = urllib.parse.urlencode({
            "q": query, "license": "cc0,pdm", "category": "photograph",
            "page_size": PER_CATEGORY + 4, "mature": "false",
        })
        try:
            data = get(f"{API}?{params}")
        except Exception as e:  # noqa: BLE001
            print(f"  [{cat}] search failed: {e}")
            continue
        added = 0
        for r in data.get("results", []):
            if added >= PER_CATEGORY:
                break
            thumb = r.get("thumbnail") or r.get("url")
            if not thumb:
                continue
            fn = f"ov-{r['id']}.jpg"
            if fn in seen_files:
                continue
            if not download(thumb, OUT / fn):
                continue
            seen_files.add(fn)
            manifest.append({
                "file": fn,
                "id": r["id"],
                "title": (r.get("title") or "Untitled").strip()[:120],
                "artist": (r.get("creator") or "Unknown").strip()[:80],
                "date": "",
                "category": cat,
                "source": f"Openverse · {r.get('source', '')} ({r.get('license', 'cc0')})",
                "url": r.get("foreign_landing_url") or r.get("url") or "",
            })
            added += 1
            time.sleep(0.1)
        print(f"  {cat}: +{added}")

    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    cats = sorted({m["category"] for m in manifest})
    print(f"\n✓ Pool now {len(manifest)} images across {len(cats)} categories:")
    print("  " + ", ".join(f"{c}:{sum(1 for m in manifest if m['category']==c)}" for c in cats))


if __name__ == "__main__":
    main()
