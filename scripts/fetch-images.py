"""Fetch a curated, public-domain (CC0) image collection from the Art Institute
of Chicago for the Visual taste region. Downloads web-sized JPEGs (600px) into
app/public/images/ and writes a manifest. Reproducible — re-run to refresh.

Stdlib only.  Usage:  python3 scripts/fetch-images.py [--per-category 12]
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "public" / "images"
API = "https://api.artic.edu/api/v1/artworks"
IIIF = "https://www.artic.edu/iiif/2"
WIDTH = 600
UA = {"User-Agent": "human-preferences/0.1 (open-source taste tool)"}

# classification_title (lowercased, substring) -> our category
CATEGORY = [
    ("painting", "painting"),
    ("photograph", "photograph"),
    ("etching", "print"), ("engraving", "print"), ("lithograph", "print"),
    ("woodcut", "print"), ("print", "print"),
    ("drawing", "drawing"), ("watercolor", "drawing"), ("pastel", "drawing"),
]

PER_CATEGORY = 12
for i, a in enumerate(sys.argv):
    if a == "--per-category" and i + 1 < len(sys.argv):
        PER_CATEGORY = int(sys.argv[i + 1])


def categorize(cls: str | None) -> str | None:
    if not cls:
        return None
    c = cls.lower()
    for key, cat in CATEGORY:
        if key in c:
            return cat
    return None


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    buckets: dict[str, list[dict]] = {}
    fields = "id,title,artist_title,image_id,is_public_domain,classification_title,date_display"
    page = 1
    needed = PER_CATEGORY * 4
    while sum(len(v) for v in buckets.values()) < needed and page <= 20:
        data = get(f"{API}?fields={fields}&limit=100&page={page}")
        for a in data.get("data", []):
            if not a.get("is_public_domain") or not a.get("image_id"):
                continue
            cat = categorize(a.get("classification_title"))
            if not cat:
                continue
            b = buckets.setdefault(cat, [])
            if len(b) >= PER_CATEGORY:
                continue
            b.append(a)
        page += 1
        print(f"  page {page - 1}: " + ", ".join(f"{k}={len(v)}" for k, v in sorted(buckets.items())))

    manifest = []
    for cat, items in sorted(buckets.items()):
        for a in items:
            fn = f"aic-{a['id']}.jpg"
            url = f"{IIIF}/{a['image_id']}/full/{WIDTH},/0/default.jpg"
            try:
                req = urllib.request.Request(url, headers=UA)
                with urllib.request.urlopen(req, timeout=60) as r:
                    (OUT / fn).write_bytes(r.read())
            except Exception as e:  # noqa: BLE001
                print(f"  [skip] {fn}: {e}")
                continue
            manifest.append({
                "file": fn,
                "id": a["id"],
                "title": a.get("title") or "Untitled",
                "artist": a.get("artist_title") or "Unknown",
                "date": a.get("date_display") or "",
                "category": cat,
                "source": "Art Institute of Chicago (CC0)",
                "url": f"https://www.artic.edu/artworks/{a['id']}",
            })
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\n✓ Downloaded {len(manifest)} images → {OUT}")
    print("  " + ", ".join(f"{c}: {sum(1 for m in manifest if m['category']==c)}" for c in sorted(buckets)))


if __name__ == "__main__":
    main()
