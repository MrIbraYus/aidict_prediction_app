import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for p in ("data-engine", "prediction-engine", "api"):
    sys.path.insert(0, str(ROOT / p))
