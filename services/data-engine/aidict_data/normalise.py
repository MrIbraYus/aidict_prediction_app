"""Team-name normalisation: maps every provider spelling to one canonical key.

Deterministic rules first (accents, punctuation, legal suffixes), then a curated alias table.
Unknown names are returned normalised and flagged for the Admin review queue — never guessed.
"""
from __future__ import annotations

import re
import unicodedata

_SUFFIXES = r"\b(fc|cf|afc|sc|ac|as|ss|ssc|sv|vfl|vfb|tsg|fk|cd|ud|rcd|sd|ca|club|calcio|de futbol|football club|1\.)\b"

# Canonical key ← known variants (after deterministic cleaning).
_ALIASES: dict[str, list[str]] = {
    "manchester united": ["man united", "man utd", "manchester utd"],
    "manchester city": ["man city"],
    "tottenham hotspur": ["tottenham", "spurs"],
    "wolverhampton wanderers": ["wolves", "wolverhampton"],
    "nottingham forest": ["nottm forest", "nott m forest", "nottingham"],
    "newcastle united": ["newcastle"],
    "west ham united": ["west ham"],
    "brighton and hove albion": ["brighton", "brighton hove albion", "brighton and hove"],
    "leicester city": ["leicester"],
    "leeds united": ["leeds"],
    "sheffield united": ["sheffield utd", "sheffield united"],
    "west bromwich albion": ["west brom", "west bromwich"],
    "afc bournemouth": ["bournemouth"],
    "ipswich town": ["ipswich"],
    "luton town": ["luton"],
    "norwich city": ["norwich"],
    "cardiff city": ["cardiff"],
    "huddersfield town": ["huddersfield"],
    "swansea city": ["swansea"],
    "stoke city": ["stoke"],
    "hull city": ["hull"],
    "queens park rangers": ["qpr"],
    "bayern munchen": ["bayern munich", "bayern", "fc bayern munchen"],
    "borussia dortmund": ["dortmund", "bvb"],
    "borussia monchengladbach": ["m gladbach", "monchengladbach", "gladbach", "bor monchengladbach"],
    "bayer leverkusen": ["leverkusen", "bayer 04 leverkusen", "bayer 04"],
    "eintracht frankfurt": ["ein frankfurt", "frankfurt"],
    "rb leipzig": ["leipzig", "rasenballsport leipzig"],
    "1899 hoffenheim": ["hoffenheim", "tsg hoffenheim"],
    "fsv mainz 05": ["mainz", "mainz 05"],
    "koln": ["fc koln", "cologne"],
    "arminia bielefeld": ["bielefeld"],
    "ingolstadt 04": ["ingolstadt"],
    "hamburger sv": ["hamburg", "hamburger"],
    "hannover 96": ["hannover"],
    "hertha bsc": ["hertha", "hertha berlin"],
    "paderborn 07": ["paderborn"],
    "darmstadt 98": ["darmstadt"],
    "greuther furth": ["spvgg greuther furth", "furth"],
    "st pauli": ["fc st pauli"],
    "werder bremen": ["sv werder bremen", "bremen"],
    "schalke 04": ["fc schalke 04", "schalke"],
    "fortuna dusseldorf": ["dusseldorf"],
    "holstein kiel": ["kiel"],
    "athletic club": ["athletic bilbao", "ath bilbao"],
    "atletico madrid": ["ath madrid", "atletico"],
    "real sociedad": ["sociedad"],
    "real betis": ["betis"],
    "celta vigo": ["celta"],
    "espanyol": ["espanol"],
    "internazionale": ["inter", "inter milan"],
    "milan": ["ac milan"],
    "paris saint germain": ["paris sg", "psg", "paris"],
    "olympique lyonnais": ["lyon"],
    "olympique de marseille": ["marseille"],
    "psv eindhoven": ["psv"],
}
def _build_lookup() -> dict[str, str]:
    # Keys and variants go through the same cleaning as incoming names, so suffix words ("club", "afc") can't break matches.
    table: dict[str, str] = {}
    for key, variants in _ALIASES.items():
        canon = clean(key)
        for v in [key, *variants]:
            table[clean(v)] = canon
    return table



def clean(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"^\s*1\.\s*", "", s)               # German "1. FC …" prefix
    s = re.sub(r"\b(18|19|20)\d{2}\b", " ", s)  # founding years: "Heidenheim 1846", "Fürth 1903"
    s = s.replace("&", " and ").replace("'", " ")
    s = re.sub(_SUFFIXES, " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


_LOOKUP: dict[str, str] = {}


def canonical(name: str) -> str:
    """Canonical team key used to match fixtures across providers."""
    c = clean(name)
    return _LOOKUP.get(c, c)


def is_known(name: str) -> bool:
    return clean(name) in _LOOKUP


_LOOKUP.update(_build_lookup())
