"""Team-name matching across OpenFootball, football-data.co.uk and football-data.org. A wrong alias either merges two
clubs (Paris FC into PSG) or splits one club into two (history lost), so both directions are pinned here."""
import pytest

from aidict_data.normalise import _ALIASES, canonical, clean

SAME = [
    ("Club Atlético de Madrid", "Ath Madrid"), ("Rayo Vallecano de Madrid", "Vallecano"), ("RC Celta de Vigo", "Celta"),
    ("RCD Espanyol de Barcelona", "Espanol"), ("Real Betis Balompié", "Betis"), ("Sporting Gijón", "Sp Gijon"),
    ("FC Internazionale Milano", "Inter"), ("Hellas Verona FC", "Verona"), ("US Salernitana 1919", "Salernitana"), ("SPAL 2013 Ferrara", "Spal"),
    ("AS Saint-Étienne", "St Etienne"), ("Stade Rennais FC 1901", "Rennes"), ("Racing Club de Lens", "Lens"), ("RC Lens", "Lens"),
    ("ES Troyes AC", "ESTAC Troyes"), ("Olympique Marseille", "Marseille"),
    ("FC Twente '65", "Twente"), ("NEC", "Nijmegen"), ("AZ", "AZ Alkmaar"), ("Fortuna Sittard", "For Sittard"),
    ("Sheffield Wednesday FC", "Sheffield Weds"), ("Peterborough United FC", "Peterboro"),
    ("Sport Lisboa e Benfica", "Benfica"), ("Sporting Clube de Portugal", "Sp Lisbon"), ("Sporting Clube de Braga", "Sp Braga"),
    ("Vitória SC", "Guimaraes"), ("GD Estoril Praia", "Estoril"),
]
DIFFERENT = [("Paris FC", "Paris Saint-Germain FC"), ("Chievo Verona", "Hellas Verona"), ("Vitória Setúbal", "Vitória Guimarães"),
             ("Sporting Gijón", "Sporting CP"), ("Sheffield United", "Sheffield Wednesday"), ("Real Madrid CF", "Club Atlético de Madrid")]


@pytest.mark.parametrize("a,b", SAME)
def test_same_club_matches(a, b):
    assert canonical(a) == canonical(b)


@pytest.mark.parametrize("a,b", DIFFERENT)
def test_different_clubs_stay_apart(a, b):
    assert canonical(a) != canonical(b)


def test_no_variant_points_at_two_clubs():
    owner: dict[str, str] = {}
    for key, variants in _ALIASES.items():
        for v in [key, *variants]:
            c = clean(v)
            assert owner.setdefault(c, clean(key)) == clean(key), f"{v!r} maps to both {owner[c]!r} and {key!r}"
