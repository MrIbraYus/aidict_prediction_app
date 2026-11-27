-- AIDICT · reference seed. Contains NO sample predictions, results or performance data.

insert into public.sports (id, slug, name, status, note) values
  (1, 'football',   'Football',   'active',     'First fully implemented prediction engine'),
  (2, 'basketball', 'Basketball', 'validating', 'Data collection; no published model'),
  (3, 'tennis',     'Tennis',     'planned',    'Historical source under review'),
  (4, 'cricket',    'Cricket',    'planned',    'Cricsheet candidate'),
  (5, 'baseball',   'Baseball',   'planned',    null),
  (6, 'hockey',     'Ice Hockey', 'planned',    null);

insert into public.data_providers (id, name, sport_id, kind, licence, attribution_text, reliability_weight, daily_budget, minute_budget) values
  ('football-data-org',   'football-data.org',   1, 'api',  'Terms not published — personal use', null, 0.95, null, 10),
  ('openligadb',          'OpenLigaDB',          1, 'api',  'ODbL 1.0', 'Daten von OpenLigaDB (www.openligadb.de), lizenziert unter ODbL 1.0', 0.85, null, 60),
  ('api-football',        'API-Football',        1, 'api',  'Free plan — terms to confirm', null, 0.9, 90, null),
  ('openfootball',        'OpenFootball',        1, 'file', 'CC0-1.0 (public domain)', null, 0.8, null, null),
  ('football-data-co-uk', 'football-data.co.uk', 1, 'file', 'Private individuals only', null, 0.85, null, null);

insert into public.competitions (sport_id, slug, code, name, country, type, tier, is_active, coverage) values
  (1, 'premier-league',   'PL',  'Premier League',      'England',       'league', 1, true,  '{"goal_times": "partial", "corners": true}'),
  (1, 'laliga',           'PD',  'LaLiga',              'Spain',         'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'bundesliga',       'BL1', 'Bundesliga',          'Germany',       'league', 1, true,  '{"goal_times": true, "corners": true}'),
  (1, 'serie-a',          'SA',  'Serie A',             'Italy',         'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'ligue-1',          'FL1', 'Ligue 1',             'France',        'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'eredivisie',       'DED', 'Eredivisie',          'Netherlands',   'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'champions-league', 'CL',  'Champions League',    'Europe',        'cup',    0, true,  '{"goal_times": false, "corners": false}'),
  (1, 'championship',     'ELC', 'Championship',        'England',       'league', 2, true,  '{"goal_times": false, "corners": true}'),
  (1, 'primeira-liga',    'PPL', 'Primeira Liga',       'Portugal',      'league', 1, true,  '{"goal_times": false, "corners": true}'),
  (1, 'brasileirao',      'BSA', 'Brasileirão Série A', 'Brazil',        'league', 1, false, '{"goal_times": false, "corners": false}'),
  (1, 'world-cup',        'WC',  'FIFA World Cup',      'International', 'international', 0, false, '{"goal_times": false, "corners": false}');

insert into public.prediction_models (id, sport_id, family, description) values
  ('football-elo',    1, 'rating',     'Elo with home advantage, competition K-factor and season regression'),
  ('football-dc',     1, 'goals',      'Dixon–Coles with time decay and low-score correction; primary score matrix'),
  ('football-logreg', 1, 'classifier', 'Multinomial logistic regression on rating, form and shot features'),
  ('football-lgbm',   1, 'classifier', 'LightGBM challenger — promoted only on better log loss and calibration'),
  ('football-order',  1, 'sequence',   'Goal-order model (time-varying, score-state-dependent intensities)'),
  ('football-corners',1, 'counts',     'Negative-binomial corners model'),
  ('football-player', 1, 'player',     'Player scoring model (requires line-ups and minutes)');

-- Market registry: 24 Smart Markets + classic markets. All start "validating" per competition until backtests pass.
insert into public.market_definitions (id, sport_id, name, category, model_module, required_data, settlement_verified, result_dependent, gate_thresholds) values
  ('1x2-1up',          1, '1X2 – 1UP',                                   'result',   'markets.result_up',      '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('1x2-2up',          1, '1X2 – 2UP',                                   'result',   'markets.result_up',      '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('1x2-never-down',   1, '1X2 – Never Down',                            'result',   'markets.never_down',     '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('ou',               1, 'Over/Under',                                  'goals',    'markets.over_under',     '{results}',            true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('handicap',         1, 'Handicap',                                    'handicap', 'markets.handicap',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.04}'),
  ('asian-handicap',   1, 'Asian Handicap',                              'handicap', 'markets.asian_handicap', '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.04}'),
  ('dc',               1, 'Double Chance',                               'double',   'markets.double_chance',  '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('dc-1up',           1, 'Double Chance – 1UP',                         'double',   'markets.result_up',      '{results,goal_times}', false, true,  '{"min_n":1000,"max_ece":0.03}'),
  ('first-goal',       1, '1st Goal',                                    'first',    'markets.first_goal',     '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.04}'),
  ('any-2-row',        1, 'Any Team To Score 2 or More Goals in a Row',  'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('any-3-row',        1, 'Any Team To Score 3 or More Goals in a Row',  'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('home-2-row',       1, 'Home Team To Score 2 or More Goals in a Row', 'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('home-3-row',       1, 'Home Team To Score 3 or More Goals in a Row', 'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('away-2-row',       1, 'Away Team To Score 2 or More Goals in a Row', 'sequence', 'markets.goal_runs',      '{results,goal_times}', true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('goalscorer',       1, 'Goalscorer',                                  'player',   'markets.player',         '{results,lineups,player_stats,penalties}', true, false, '{"min_n":1000,"max_ece":0.03}'),
  ('player-not-score', 1, 'Player Not to Score',                         'player',   'markets.player',         '{results,lineups,player_stats,penalties}', true, false, '{"min_n":1000,"max_ece":0.03}'),
  ('corners-ou',       1, 'Corners – Over/Under',                        'corners',  'markets.corners',        '{corners}',            true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('corners-1x2',      1, 'Corners – 1X2',                               'corners',  'markets.corners',        '{corners}',            true,  false, '{"min_n":1000,"max_ece":0.04}'),
  ('home-or-over25',   1, 'Home Team or Over 2.5',                       'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('home-or-under25',  1, 'Home Team or Under 2.5',                      'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('draw-or-over25',   1, 'Draw or Over 2.5',                            'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('draw-or-under25',  1, 'Draw or Under 2.5',                           'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('away-or-over25',   1, 'Away or Over 2.5',                            'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('away-or-under25',  1, 'Away or Under 2.5',                           'combined', 'markets.combined',       '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('1x2',              1, 'Full-time result',                            'other',    'markets.one_x_two',      '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('btts',             1, 'Both teams to score',                         'other',    'markets.btts',           '{results}',            true,  false, '{"min_n":1000,"max_ece":0.03}'),
  ('dnb',              1, 'Draw no bet',                                 'other',    'markets.draw_no_bet',    '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('correct-score',    1, 'Correct score',                               'other',    'markets.correct_score',  '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.01}'),
  ('ht-result',        1, 'Half-time result',                            'other',    'markets.half_time',      '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}'),
  ('ht-ft',            1, 'Half-time / Full-time',                       'other',    'markets.half_time',      '{results}',            true,  true,  '{"min_n":1000,"max_ece":0.03}');

insert into public.feature_flags (key, enabled, description) values
  ('smart_predictions',       true,  'Smart Predictions ranking page'),
  ('smart_markets',           true,  'Smart Market Predictions (24 markets)'),
  ('value_indicators',        true,  'Show EV only when a real odds source is attached'),
  ('multi_match_mc',          true,  'Monte Carlo multi-match analysis'),
  ('api_football_enrichment', true,  'Use API-Football budget for featured matches'),
  ('in_play_model',           false, 'In-play probability updates (not built)'),
  ('basketball_module',       false, 'Basketball predictions (validating)');

insert into public.scheduled_sync_jobs (job, cron, runner) values
  ('sync_current',         '17 * * * *',        'github-actions'),
  ('predict_upcoming',     '17 * * * *',        'github-actions'),
  ('settle_results',       '30 5,23 * * *',     'github-actions'),
  ('retrain_and_backtest', '0 4 * * 1',         'github-actions'),
  ('sync_history',         '0 4 * * 1',         'github-actions'),
  ('backup_database',      '30 4 * * 0',        'github-actions');

insert into public.app_settings (key, value) values
  ('selection', '{"min_probability":0.6,"min_reliability":0.62,"min_lift":0.03,"max_base_rate":0.85,"max_correlation":0.5,"max_picks":5,"min_picks":4}'),
  ('reliability_weights', '{"calibration":0.4,"sample":0.25,"completeness":0.25,"coverage":0.1}'),
  ('signup', '{"open":false}');
