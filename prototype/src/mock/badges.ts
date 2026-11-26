/**
 * Team badge registry (authentic crests, not generated).
 *
 * Source: crest URLs exactly as published by football-data.org in its v4 `team.crest` field
 * (https://crests.football-data.org/{teamId}.svg|png). Each entry was checked on 2026-11-26:
 * HTTP 200, correct image type, and visually confirmed to be the right club.
 *
 * Club crests are trademarks of their clubs. AIDICT shows them only to identify teams in a
 * personal, non-commercial app, unmodified, at their original aspect ratio. Any commercial or public release
 * needs a licensing review (see documentation/TEAM_BADGES.md).
 *
 * Production stores the same fields in `team_badges` and mirrors files to Supabase Storage.
 * The resolver fills new teams automatically on import (provider crest → secondary provider → neutral fallback).
 */

export type BadgeSource = 'football-data.org' | 'api-football' | 'openligadb' | 'manual-override'

export type Badge = {
  teamId: string
  url: string
  format: 'svg' | 'png'
  kind: 'club-crest' | 'national-flag'
  source: BadgeSource
  providerTeamId: string
  /** 'dark' = crest is dark/low-contrast on the dark theme → rendered with a thin light outline (badge unchanged). */
  contrast?: 'dark'
  verifiedAt: string
}

const FDO = (teamId: string, providerTeamId: number, format: 'svg' | 'png' = 'svg', extra: Partial<Badge> = {}): Badge => ({
  teamId,
  url: `https://crests.football-data.org/${providerTeamId}.${format}`,
  format,
  kind: 'club-crest',
  source: 'football-data.org',
  providerTeamId: String(providerTeamId),
  verifiedAt: '2026-11-26',
  ...extra,
})

const NAT = (teamId: string, providerTeamId: number) => FDO(teamId, providerTeamId, 'svg', { kind: 'national-flag' })

export const BADGES: Record<string, Badge> = Object.fromEntries(
  [
    // Premier League
    FDO('ars', 57), FDO('che', 61), FDO('liv', 64), FDO('mci', 65), FDO('mun', 66),
    FDO('tot', 73, 'svg', { contrast: 'dark' }), FDO('new', 67), FDO('avl', 58), FDO('bha', 397), FDO('ful', 63),
    FDO('bre', 402), FDO('eve', 62), FDO('wol', 76), FDO('nfo', 351),
    // LaLiga
    FDO('rma', 86), FDO('fcb', 81), FDO('atm', 78), FDO('ath', 77), FDO('sev', 559), FDO('vil', 94), FDO('get', 82), FDO('val', 95),
    // Bundesliga
    FDO('bay', 5), FDO('sge', 19), FDO('b04', 3), FDO('scf', 17), FDO('vfb', 10), FDO('bvb', 4), FDO('m05', 15), FDO('rbl', 721),
    // Serie A (Napoli & Roma: provider publishes PNG only)
    FDO('int', 108), FDO('nap', 113, 'png'), FDO('juv', 109, 'svg', { contrast: 'dark' }), FDO('rom', 100, 'png'),
    FDO('ata', 102, 'svg', { contrast: 'dark' }), FDO('bol', 103),
    // Ligue 1 (Monaco: PNG only)
    FDO('psg', 524), FDO('asm', 548, 'png'), FDO('ol', 523), FDO('om', 516),
    // Eredivisie
    FDO('psv', 674), FDO('fey', 675),
    // National teams — football-data.org supplies national flags as the team image
    NAT('eng', 770), NAT('fra', 773), NAT('esp', 760), NAT('ger', 759), NAT('ita', 784),
    NAT('por', 765), NAT('ned', 8601), NAT('bel', 805), NAT('bra', 764), NAT('arg', 762),
  ].map((b) => [b.teamId, b]),
)

export const badgeFor = (teamId: string): Badge | undefined => BADGES[teamId]

/** Resolver order used by the data engine when a new team is imported. */
export const BADGE_RESOLUTION_ORDER: { source: BadgeSource; field: string; note: string }[] = [
  { source: 'manual-override', field: 'team_badges.override_url', note: 'Admin-supplied, licensed URL. Always wins.' },
  { source: 'football-data.org', field: 'GET /v4/teams/{id} → crest', note: 'Primary. SVG where published, otherwise PNG.' },
  { source: 'api-football', field: 'GET /teams → team.logo', note: 'Secondary, for teams outside the football-data.org free tier.' },
  { source: 'openligadb', field: 'teamIconUrl', note: 'Lowest priority. Third-party URLs, excluded from the ODbL licence; used only after review.' },
]
