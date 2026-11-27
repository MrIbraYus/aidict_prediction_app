// Generated from the prediction engine's market specs (aidict_engine.market_eval.SPECS + corners.SPECS). Do not edit by hand.
// "Home" / "Away" are replaced with the team names when shown.
export const OUTCOME_LABELS: Record<string, string> = {
  "1x2|home": "Home win",
  "1x2|draw": "Draw",
  "1x2|away": "Away win",
  "ou|over1.5": "Over 1.5 goals",
  "ou|over2.5": "Over 2.5 goals",
  "ou|over3.5": "Over 3.5 goals",
  "btts|yes": "Both teams to score",
  "dc|1X": "Home or draw",
  "dc|X2": "Draw or away",
  "dc|12": "Home or away",
  "handicap|home-1": "Home −1 (wins by 2+)",
  "handicap|away+1": "Away +1 (away wins or draws)",
  "asian-handicap|home0": "Home AH 0 (draw no bet; pushes excluded)",
  "asian-handicap|home-0.25": "Home AH −0.25 (full win)",
  "home-or-over25|yes": "Home or Over 2.5",
  "home-or-under25|yes": "Home or Under 2.5",
  "draw-or-over25|yes": "Draw or Over 2.5",
  "draw-or-under25|yes": "Draw or Under 2.5",
  "away-or-over25|yes": "Away or Over 2.5",
  "away-or-under25|yes": "Away or Under 2.5",
  "first-goal|home": "Home scores first",
  "first-goal|away": "Away scores first",
  "any-2-row|yes": "Any team 2+ goals in a row",
  "any-3-row|yes": "Any team 3+ goals in a row",
  "home-2-row|yes": "Home 2+ goals in a row",
  "home-3-row|yes": "Home 3+ goals in a row",
  "away-2-row|yes": "Away 2+ goals in a row",
  "1x2-1up|home": "Home 1UP (ever leads by 1)",
  "1x2-2up|home": "Home 2UP (leads by 2 or wins)",
  "1x2-never-down|home": "Home never behind",
  "corners-ou|over8.5": "Over 8.5 corners",
  "corners-ou|over9.5": "Over 9.5 corners",
  "corners-ou|over10.5": "Over 10.5 corners",
  "corners-ou|over11.5": "Over 11.5 corners",
  "corners-1x2|home": "Home more corners",
  "corners-1x2|draw": "Equal corners",
  "corners-1x2|away": "Away more corners"
}

export function outcomeLabel(market: string, outcome: string, home: string, away: string): string {
  const t = OUTCOME_LABELS[market + '|' + outcome] ?? market + ' · ' + outcome
  return t.replace(/Home/g, home).replace(/Away/g, away)
}
