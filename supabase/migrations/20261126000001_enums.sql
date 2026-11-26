-- AIDICT · 0001 · Enumerated types
-- Every timestamp in AIDICT is timestamptz (UTC). Display time zone is a user preference.

create type public.sport_status    as enum ('active', 'validating', 'planned');
create type public.fixture_status  as enum ('SCHEDULED', 'TIMED', 'LIVE', 'HT', 'FT', 'AET', 'PEN', 'POSTPONED', 'SUSPENDED', 'CANCELLED', 'AWARDED');
create type public.market_status   as enum ('active', 'validating', 'disabled', 'unavailable');
create type public.market_category as enum ('result', 'goals', 'handicap', 'double', 'first', 'sequence', 'player', 'corners', 'combined', 'other');
create type public.outcome_result  as enum ('won', 'lost', 'void', 'push', 'half_won', 'half_lost');
create type public.recommendation  as enum ('pick', 'lean', 'skip');
create type public.notif_category  as enum ('prediction', 'kickoff', 'live', 'goal', 'finished', 'settled', 'system');
create type public.notif_channel   as enum ('in_app', 'web_push', 'android');
create type public.data_type       as enum ('results', 'goal_times', 'corners', 'lineups', 'player_stats', 'penalties');
create type public.conflict_status as enum ('open', 'resolved', 'ignored');
create type public.badge_kind      as enum ('club-crest', 'national-flag');
create type public.badge_status    as enum ('active', 'fallback', 'needs_review');
create type public.app_role        as enum ('user', 'admin');
