"""Load the repository's .env.local into os.environ (existing environment variables always win). Values are never printed."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def load(path: Path | None = None) -> None:
    for p in [path] if path else [ROOT / ".env.local", ROOT / "services" / ".env"]:
        if not p or not p.exists():
            continue
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            v = v.split(" #", 1)[0].strip().strip('"').strip("'")
            if k and v and k not in os.environ:
                os.environ[k] = v


def require(*keys: str) -> dict[str, str]:
    load()
    missing = [k for k in keys if not os.environ.get(k) or "your-" in os.environ[k] or "password@db" in os.environ[k] or "[YOUR-" in os.environ[k].upper()]
    if missing:
        raise SystemExit(f"Missing or placeholder configuration: {', '.join(missing)} (set real values in .env.local)")
    return {k: os.environ[k] for k in keys}
