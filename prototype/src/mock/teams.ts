/**
 * ⚠ DESIGN PROTOTYPE SAMPLE DATA — NOT REAL.
 * Ratings, colours and competition states below are illustrative values for UI design only.
 * Production data comes from the data engine (see documentation/TECHNICAL_ARCHITECTURE.md).
 */

export type FlagCode = 'eng' | 'esp' | 'ger' | 'ita' | 'fra' | 'ned' | 'eur' | 'por' | 'bra' | 'wld'

export type Competition = {
  id: string
  code: string
  name: string
  country: string
  flag: FlagCode
  type: 'league' | 'cup'
  tier: number
  round: string
  season: string
  modelStatus: 'active' | 'validating' | 'disabled'
  modelNote?: string
  sources: string[]
  coverage: { fixtures: boolean; results: boolean; standings: boolean; stats: 'full' | 'partial' | 'none'; odds: 'historical' | 'none'; live: 'delayed' | 'community' | 'none' }
  oosSample: number
}

export const COMPETITIONS: Competition[] = [
  { id: 'pl', code: 'PL', name: 'Premier League', country: 'England', flag: 'eng', type: 'league', tier: 1, round: 'Matchday 13', season: '2026-27', modelStatus: 'active', sources: ['football-data.org', 'OpenFootball', 'football-data.co.uk', 'API-Football'], coverage: { fixtures: true, results: true, standings: true, stats: 'full', odds: 'historical', live: 'delayed' }, oosSample: 3420 },
  { id: 'pd', code: 'PD', name: 'LaLiga', country: 'Spain', flag: 'esp', type: 'league', tier: 1, round: 'Jornada 14', season: '2026-27', modelStatus: 'active', sources: ['football-data.org', 'OpenFootball', 'football-data.co.uk'], coverage: { fixtures: true, results: true, standings: true, stats: 'full', odds: 'historical', live: 'delayed' }, oosSample: 3380 },
  { id: 'bl1', code: 'BL1', name: 'Bundesliga', country: 'Germany', flag: 'ger', type: 'league', tier: 1, round: 'Spieltag 12', season: '2026-27', modelStatus: 'active', sources: ['football-data.org', 'OpenLigaDB', 'OpenFootball', 'football-data.co.uk'], coverage: { fixtures: true, results: true, standings: true, stats: 'full', odds: 'historical', live: 'community' }, oosSample: 2754 },
  { id: 'sa', code: 'SA', name: 'Serie A', country: 'Italy', flag: 'ita', type: 'league', tier: 1, round: 'Giornata 13', season: '2026-27', modelStatus: 'active', sources: ['football-data.org', 'OpenFootball', 'football-data.co.uk'], coverage: { fixtures: true, results: true, standings: true, stats: 'full', odds: 'historical', live: 'delayed' }, oosSample: 3390 },
  { id: 'fl1', code: 'FL1', name: 'Ligue 1', country: 'France', flag: 'fra', type: 'league', tier: 1, round: 'Journée 14', season: '2026-27', modelStatus: 'active', sources: ['football-data.org', 'OpenFootball', 'football-data.co.uk'], coverage: { fixtures: true, results: true, standings: true, stats: 'full', odds: 'historical', live: 'delayed' }, oosSample: 2860 },
  { id: 'ded', code: 'DED', name: 'Eredivisie', country: 'Netherlands', flag: 'ned', type: 'league', tier: 1, round: 'Speelronde 13', season: '2026-27', modelStatus: 'validating', modelNote: '184 of 300 out-of-sample predictions collected', sources: ['football-data.org', 'OpenFootball'], coverage: { fixtures: true, results: true, standings: true, stats: 'partial', odds: 'historical', live: 'delayed' }, oosSample: 184 },
  { id: 'cl', code: 'CL', name: 'Champions League', country: 'Europe', flag: 'eur', type: 'cup', tier: 0, round: 'League phase · MD6', season: '2026-27', modelStatus: 'validating', modelNote: 'Cross-league strength calibration in progress', sources: ['football-data.org', 'OpenFootball'], coverage: { fixtures: true, results: true, standings: true, stats: 'none', odds: 'none', live: 'delayed' }, oosSample: 226 },
  { id: 'elc', code: 'ELC', name: 'Championship', country: 'England', flag: 'eng', type: 'league', tier: 2, round: 'Matchday 19', season: '2026-27', modelStatus: 'active', sources: ['football-data.org', 'OpenFootball', 'football-data.co.uk'], coverage: { fixtures: true, results: true, standings: true, stats: 'full', odds: 'historical', live: 'delayed' }, oosSample: 4410 },
  { id: 'ppl', code: 'PPL', name: 'Primeira Liga', country: 'Portugal', flag: 'por', type: 'league', tier: 1, round: 'Jornada 11', season: '2026-27', modelStatus: 'validating', modelNote: 'Shots data incomplete before 2017', sources: ['football-data.org', 'OpenFootball', 'football-data.co.uk'], coverage: { fixtures: true, results: true, standings: true, stats: 'partial', odds: 'historical', live: 'delayed' }, oosSample: 268 },
  { id: 'wc', code: 'WC', name: 'FIFA World Cup', country: 'International', flag: 'wld', type: 'cup', tier: 0, round: 'Next edition 2030', season: '2026', modelStatus: 'disabled', modelNote: 'National-team model not built — too few matches per team', sources: ['football-data.org', 'OpenFootball'], coverage: { fixtures: true, results: true, standings: true, stats: 'none', odds: 'none', live: 'delayed' }, oosSample: 0 },
  { id: 'bsa', code: 'BSA', name: 'Brasileirão Série A', country: 'Brazil', flag: 'bra', type: 'league', tier: 1, round: 'Rodada 36', season: '2026', modelStatus: 'disabled', modelNote: 'No historical stats source connected', sources: ['football-data.org'], coverage: { fixtures: true, results: true, standings: true, stats: 'none', odds: 'none', live: 'delayed' }, oosSample: 0 },
]

export type Team = { id: string; name: string; short: string; tla: string; compId: string; colors: [string, string]; elo: number; venue: string; city: string }

const t = (id: string, name: string, short: string, tla: string, compId: string, c1: string, c2: string, elo: number, venue: string, city: string): Team => ({ id, name, short, tla, compId, colors: [c1, c2], elo, venue, city })

export const TEAMS: Team[] = [
  t('ars', 'Arsenal', 'Arsenal', 'ARS', 'pl', '#EF0107', '#FFFFFF', 1986, 'Emirates Stadium', 'London'),
  t('che', 'Chelsea', 'Chelsea', 'CHE', 'pl', '#034694', '#FFFFFF', 1889, 'Stamford Bridge', 'London'),
  t('liv', 'Liverpool', 'Liverpool', 'LIV', 'pl', '#C8102E', '#F6EB61', 1992, 'Anfield', 'Liverpool'),
  t('mci', 'Manchester City', 'Man City', 'MCI', 'pl', '#6CABDD', '#1C2C5B', 1968, 'Etihad Stadium', 'Manchester'),
  t('mun', 'Manchester United', 'Man United', 'MUN', 'pl', '#DA291C', '#FBE122', 1838, 'Old Trafford', 'Manchester'),
  t('tot', 'Tottenham Hotspur', 'Tottenham', 'TOT', 'pl', '#132257', '#FFFFFF', 1832, 'Tottenham Hotspur Stadium', 'London'),
  t('new', 'Newcastle United', 'Newcastle', 'NEW', 'pl', '#241F20', '#FFFFFF', 1874, "St James' Park", 'Newcastle'),
  t('avl', 'Aston Villa', 'Aston Villa', 'AVL', 'pl', '#670E36', '#95BFE5', 1858, 'Villa Park', 'Birmingham'),
  t('bha', 'Brighton & Hove Albion', 'Brighton', 'BHA', 'pl', '#0057B8', '#FFFFFF', 1802, 'Amex Stadium', 'Brighton'),
  t('ful', 'Fulham', 'Fulham', 'FUL', 'pl', '#F5F5F5', '#000000', 1764, 'Craven Cottage', 'London'),
  t('bre', 'Brentford', 'Brentford', 'BRE', 'pl', '#E30613', '#FFFFFF', 1771, 'Gtech Community Stadium', 'London'),
  t('eve', 'Everton', 'Everton', 'EVE', 'pl', '#003399', '#FFFFFF', 1748, 'Hill Dickinson Stadium', 'Liverpool'),
  t('wol', 'Wolverhampton Wanderers', 'Wolves', 'WOL', 'pl', '#FDB913', '#231F20', 1716, 'Molineux', 'Wolverhampton'),
  t('nfo', 'Nottingham Forest', "Nott'm Forest", 'NFO', 'pl', '#DD0000', '#FFFFFF', 1793, 'City Ground', 'Nottingham'),
  t('rma', 'Real Madrid', 'Real Madrid', 'RMA', 'pd', '#F4F4F4', '#00529F', 2012, 'Santiago Bernabéu', 'Madrid'),
  t('fcb', 'FC Barcelona', 'Barcelona', 'BAR', 'pd', '#A50044', '#004D98', 1996, 'Spotify Camp Nou', 'Barcelona'),
  t('atm', 'Atlético Madrid', 'Atlético', 'ATM', 'pd', '#CB3524', '#262E61', 1904, 'Riyadh Air Metropolitano', 'Madrid'),
  t('ath', 'Athletic Club', 'Athletic', 'ATH', 'pd', '#EE2523', '#FFFFFF', 1842, 'San Mamés', 'Bilbao'),
  t('sev', 'Sevilla', 'Sevilla', 'SEV', 'pd', '#F43333', '#FFFFFF', 1758, 'Ramón Sánchez-Pizjuán', 'Seville'),
  t('vil', 'Villarreal', 'Villarreal', 'VIL', 'pd', '#FFE667', '#005187', 1816, 'Estadio de la Cerámica', 'Villarreal'),
  t('get', 'Getafe', 'Getafe', 'GET', 'pd', '#005999', '#FFFFFF', 1701, 'Coliseum', 'Getafe'),
  t('val', 'Valencia', 'Valencia', 'VAL', 'pd', '#F4F4F4', '#EE3524', 1722, 'Mestalla', 'Valencia'),
  t('bay', 'Bayern München', 'Bayern', 'FCB', 'bl1', '#DC052D', '#0066B2', 2006, 'Allianz Arena', 'Munich'),
  t('sge', 'Eintracht Frankfurt', 'Frankfurt', 'SGE', 'bl1', '#E1000F', '#000000', 1801, 'Deutsche Bank Park', 'Frankfurt'),
  t('b04', 'Bayer 04 Leverkusen', 'Leverkusen', 'B04', 'bl1', '#E32221', '#000000', 1912, 'BayArena', 'Leverkusen'),
  t('scf', 'SC Freiburg', 'Freiburg', 'SCF', 'bl1', '#1A1A1A', '#E2001A', 1752, 'Europa-Park Stadion', 'Freiburg'),
  t('vfb', 'VfB Stuttgart', 'Stuttgart', 'VFB', 'bl1', '#E32219', '#FFFFFF', 1821, 'MHPArena', 'Stuttgart'),
  t('bvb', 'Borussia Dortmund', 'Dortmund', 'BVB', 'bl1', '#FDE100', '#000000', 1879, 'Signal Iduna Park', 'Dortmund'),
  t('m05', 'Mainz 05', 'Mainz', 'M05', 'bl1', '#C3141E', '#FFFFFF', 1694, 'Mewa Arena', 'Mainz'),
  t('rbl', 'RB Leipzig', 'Leipzig', 'RBL', 'bl1', '#DD0741', '#001F47', 1836, 'Red Bull Arena', 'Leipzig'),
  t('int', 'Inter', 'Inter', 'INT', 'sa', '#0068A8', '#000000', 1952, 'San Siro', 'Milan'),
  t('nap', 'Napoli', 'Napoli', 'NAP', 'sa', '#12A0D7', '#FFFFFF', 1901, 'Stadio Diego Armando Maradona', 'Naples'),
  t('juv', 'Juventus', 'Juventus', 'JUV', 'sa', '#F2F2F2', '#111111', 1871, 'Allianz Stadium', 'Turin'),
  t('rom', 'AS Roma', 'Roma', 'ROM', 'sa', '#8E1F2F', '#F0BC42', 1803, 'Stadio Olimpico', 'Rome'),
  t('ata', 'Atalanta', 'Atalanta', 'ATA', 'sa', '#1E71B8', '#000000', 1884, 'Gewiss Stadium', 'Bergamo'),
  t('bol', 'Bologna', 'Bologna', 'BOL', 'sa', '#1A2F48', '#A21C26', 1792, "Stadio Renato Dall'Ara", 'Bologna'),
  t('psg', 'Paris Saint-Germain', 'Paris SG', 'PSG', 'fl1', '#004170', '#DA291C', 1964, 'Parc des Princes', 'Paris'),
  t('asm', 'AS Monaco', 'Monaco', 'ASM', 'fl1', '#E51B22', '#FFFFFF', 1818, 'Stade Louis II', 'Monaco'),
  t('ol', 'Olympique Lyonnais', 'Lyon', 'OL', 'fl1', '#F4F4F4', '#DA001A', 1772, 'Groupama Stadium', 'Lyon'),
  t('om', 'Olympique de Marseille', 'Marseille', 'OM', 'fl1', '#2FAEE0', '#FFFFFF', 1808, 'Orange Vélodrome', 'Marseille'),
  t('psv', 'PSV', 'PSV', 'PSV', 'ded', '#ED1C24', '#FFFFFF', 1833, 'Philips Stadion', 'Eindhoven'),
  t('fey', 'Feyenoord', 'Feyenoord', 'FEY', 'ded', '#E4002B', '#111111', 1798, 'De Kuip', 'Rotterdam'),
]

/** National teams (football-data.org supplies national flags as their team images). Ratings are sample values. */
export const NATIONAL_TEAMS: Team[] = [
  t('eng', 'England', 'England', 'ENG', 'wc', '#FFFFFF', '#CE1124', 1960, 'Wembley Stadium', 'London'),
  t('fra', 'France', 'France', 'FRA', 'wc', '#0055A4', '#EF4135', 2010, 'Stade de France', 'Saint-Denis'),
  t('esp', 'Spain', 'Spain', 'ESP', 'wc', '#AA151B', '#F1BF00', 2040, 'Various venues', 'Spain'),
  t('ger', 'Germany', 'Germany', 'GER', 'wc', '#000000', '#DD0000', 1950, 'Various venues', 'Germany'),
  t('ita', 'Italy', 'Italy', 'ITA', 'wc', '#009246', '#CE2B37', 1905, 'Various venues', 'Italy'),
  t('por', 'Portugal', 'Portugal', 'POR', 'wc', '#006600', '#FF0000', 1975, 'Estádio da Luz', 'Lisbon'),
  t('ned', 'Netherlands', 'Netherlands', 'NED', 'wc', '#AE1C28', '#21468B', 1955, 'Johan Cruijff ArenA', 'Amsterdam'),
  t('bel', 'Belgium', 'Belgium', 'BEL', 'wc', '#000000', '#FAE042', 1890, 'King Baudouin Stadium', 'Brussels'),
  t('bra', 'Brazil', 'Brazil', 'BRA', 'wc', '#009C3B', '#FFDF00', 2000, 'Maracanã', 'Rio de Janeiro'),
  t('arg', 'Argentina', 'Argentina', 'ARG', 'wc', '#74ACDF', '#FFFFFF', 2085, 'Estadio Monumental', 'Buenos Aires'),
]

export const ALL_TEAMS = [...TEAMS, ...NATIONAL_TEAMS]
export const teamById = (id: string) => ALL_TEAMS.find((x) => x.id === id)!
export const compById = (id: string) => COMPETITIONS.find((x) => x.id === id)!

export const SPORTS = [
  { id: 'football', name: 'Football', status: 'active' as const, note: 'Dixon–Coles v1.3 · 7 markets active', competitions: 10, sources: 5 },
  { id: 'basketball', name: 'Basketball', status: 'validating' as const, note: 'Collecting NBA history · model not published', competitions: 1, sources: 1 },
  { id: 'tennis', name: 'Tennis', status: 'planned' as const, note: 'Historical source under review', competitions: 0, sources: 0 },
  { id: 'cricket', name: 'Cricket', status: 'planned' as const, note: 'Cricsheet ball-by-ball candidate', competitions: 0, sources: 0 },
  { id: 'baseball', name: 'Baseball', status: 'planned' as const, note: 'Research pending', competitions: 0, sources: 0 },
  { id: 'hockey', name: 'Ice Hockey', status: 'planned' as const, note: 'Research pending', competitions: 0, sources: 0 },
]
