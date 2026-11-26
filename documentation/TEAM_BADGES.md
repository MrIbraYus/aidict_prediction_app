# AIDICT — Team Badges (authentic crests)

**Date:** 2026-11-26 · **Status:** implemented in the prototype, production design below

## 1. What changed
The generated monogram shields have been **removed entirely**. Every team in the prototype now shows its authentic badge as published by the data provider. Nothing is generated, redrawn, recoloured or substituted.

| Team set | Count | Badge | Source |
|---|---|---|---|
| Clubs (PL, LaLiga, Bundesliga, Serie A, Ligue 1, Eredivisie) | 42 | Official club crest. **39 SVG**, plus **3 PNG** (Napoli, Roma, Monaco: the provider publishes PNG only) | football-data.org `team.crest` |
| National teams (ENG, FRA, ESP, GER, ITA, POR, NED, BEL, BRA, ARG) | 10 | National flag (see §4) | football-data.org `team.crest` |
| Neutral fallback in use | 0 | Plain grey shield, no initials, no colours | — |

The registry is in `prototype/src/mock/badges.ts`. Each entry stores `teamId`, `url`, `format`, `kind`, `source`, `providerTeamId`, `contrast` and `verifiedAt`.

## 2. How each badge was verified (2026-11-26)
1. A request to `https://crests.football-data.org/{id}.svg` (then `.png` if the SVG was missing) returned **HTTP 200** with an image content type.
2. All 52 images were rendered on a contact sheet on dark and white backgrounds and **visually confirmed** to be the right club or country.
3. Contrast on the dark theme was assessed by eye. Three crests are dark on dark: **Tottenham** (navy), **Juventus** (black) and **Atalanta** (dark blue). They get `contrast: 'dark'`, which adds a thin light outline (CSS `drop-shadow`) in dark mode only. The badge artwork itself is unchanged.

## 3. Rendering rules (component `Crest`)
- Fixed square box at every size (16–68 px), `object-contain`. Aspect ratio and transparency are preserved and there is no layout shift.
- `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"`, and descriptive `alt` text.
- If an image fails to load, `onError` switches to the neutral fallback.
- Flags render at 3:2 inside the same square box with a hairline border.
- Used everywhere a team appears: dashboard hero and lists, fixtures, live, match header, line-ups, H2H, statistics, prediction cards, Smart Predictions, Multi-Match, history, standings, team pages, saved matches, notifications and toasts, search results, admin.

## 4. National teams: why flags
The football-data.org team resource returns the **national flag** as the image for national teams. The free providers researched (football-data.org, OpenLigaDB, OpenFootball; API-Football's media server returned a generic placeholder) do **not** supply federation crests such as The FA's Three Lions or the DFB eagle. Those crests are registered trademarks with no free, licensed source available to AIDICT.
- Flags are authentic national symbols, not fictional logos. That makes them the honest, available option.
- If you obtain a licensed federation crest, set `override_url` for that team (Admin → Team badges → Override). The override always wins and the previous source is kept in history.

## 5. Licensing and trademarks
- Club and federation crests are **trademarks of their owners**. They are displayed unmodified, at their original proportions, **solely to identify teams** in a **personal, non-commercial** app. This is the same use the data provider supplies them for.
- AIDICT claims no affiliation or endorsement. The About and Admin pages state this.
- **Before any public, multi-user or commercial release:** a licensing review is required. Leagues and clubs license crests commercially. Until then AIDICT stays personal use.
- OpenLigaDB's ODbL licence explicitly excludes team logos, so its `teamIconUrl` is used only after manual review.

## 6. Production design (Stage 3)
### Table `team_badges`
| Column | Notes |
|---|---|
| `team_id` (PK, FK teams) | |
| `source` | `football-data.org` · `api-football` · `openligadb` · `manual-override` |
| `provider_team_id` | The provider's own team ID |
| `source_url` | Exact URL from the provider payload |
| `override_url` | Admin-supplied licensed URL. Always wins |
| `storage_path` | Mirrored copy in Supabase Storage (`badges/{team_id}/{sha256}.svg/png`) |
| `thumb_64`, `thumb_128` | Optimised raster thumbnails for list sizes (WebP/PNG) |
| `format`, `width`, `height`, `sha256` | Measured at ingest |
| `kind` | `club-crest` · `national-flag` |
| `contrast_hint` | `dark` / `light` / `ok`, computed from the mean luminance of opaque pixels |
| `status` | `active` · `fallback` · `needs_review` |
| `verified_at`, `last_checked_at`, `history jsonb` | Replacements are kept, never silently overwritten |

### Automatic resolution when new teams are imported
`services/data-engine/badges/resolve.py` runs after every team upsert:
1. `override_url`, if set.
2. **football-data.org** `team.crest` from `/v4/teams/{id}` or a competition's teams list (already fetched during sync, so no extra quota).
3. **API-Football** `team.logo` (budget-capped). Used only for teams outside the free football-data.org competitions.
4. **OpenLigaDB** `teamIconUrl`: lowest priority, goes to `needs_review`.
5. **Neutral fallback**, flagged in Admin for review.

### Validation before a badge is used
- HTTP 200, `image/svg+xml` or `image/png`, under 2 MB. PNGs must be at least 128 px on the short side.
- SVG sanitising: remove `<script>`, event handlers, `foreignObject` and external references. Served from AIDICT Storage with `Content-Security-Policy: default-src 'none'`.
- The checksum is recorded, and a weekly re-check job flags URL changes or 404s.
- Mirroring means the app keeps working if a provider CDN is down and avoids hot-linking in production. Thumbnails cut payload: some provider SVGs are about 300 KB (Liverpool, PSG), which is too heavy for list views.

### Prototype note
The prototype loads the provider URLs directly (no download into the project) to show the real assets. Production serves the mirrored, optimised copies described above.
