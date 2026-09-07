# Phase 3 automation configuration

## Content refresh schedule

`scripts/refresh-content-digest.sh` forces the existing local content service to
read the exact `iCloud → Newsletters` and `iCloud → Axis Research` mailboxes,
Calendar, Reminders, Notes, and Podcasts. It does not start services.

`scheduler/content-refresh.cron` contains hourly and daily examples. Replace the
repository placeholder before manually installing one line in a user crontab.
The repository does not install or mutate any OS scheduler.

Optional environment:

- `CONTENT_DIGEST_URL` (default `http://127.0.0.1:3003`)
- `CONTENT_REFRESH_TIMEOUT_SECONDS` (default `480`)

## Private podcast transcript summaries

The content service generates AI bullet summaries when a private local summarizer
is explicitly configured. It prefers the exact episode's locally cached Apple
Podcasts TTML transcript. When Apple Podcasts has not cached that transcript, it
may summarize the sanitized publisher description, which remains explicitly
labelled as description evidence and is never called a transcription.

The adapter is Ollama-compatible and defaults to the local-only endpoint
`http://127.0.0.1:11434/api/generate`. Set:

- `PODCAST_SUMMARIZER_MODEL` to an already-installed local model (required)
- `PODCAST_SUMMARIZER_URL` only when using a different compatible endpoint
- `PODCAST_SUMMARIZER_ALLOW_REMOTE=1` only after explicitly approving transcript upload

No model is pulled automatically. No remote host is contacted unless both a
remote URL and the explicit remote opt-in are configured. Long transcripts are
sanitized, summarized chunk-by-chunk, and synthesized into 3–6 final bullets.
Every generated bullet includes explicit Outcome (Positive / Mixed / Negative)
and Sentiment (Positive / Neutral / Negative) labels for the coloured insight
boxes in Market Intelligence.

## Canonical market calendar

The repository ships `config/market-calendar.json` with source-attributed NSE and
US full-day closures for the active calendar year. The content-digest process
loads that file by default (or `MARKET_CALENDAR_PATH` when overridden).

`config/market-calendar.example.json` remains the schema template. To refresh
from official calendars, replace the JSON atomically after verifying:

- `market`: `NSE` or `US`
- `date`: `YYYY-MM-DD`
- `name`: official holiday name
- a source HTTPS URL, either on the row or in `sources`

Set `coverageStart` and `coverageEnd` to the official dataset's complete date
range. The adapter rejects malformed, unattributed, non-HTTPS, out-of-window,
and incomplete-coverage data.
When no valid adapter document is available, the dashboard shows the
market-calendar source as unavailable and does not infer holiday dates. Crypto
is represented separately with 24/7 semantics; venue maintenance or outages
remain possible.

Authoritative references used for the committed 2026 document:
- NSE / Nifty Indices: https://www.niftyindices.com/resources/holiday-calendar
- NYSE: https://www.nyse.com/markets/hours-calendars
