# SecureFlow DAST — fixes applied

## Already fixed in your codebase (confirmed by reading the code, not just the log)
These were the causes of the "only 1 finding" problem from the first log, and your
current backend already has all three fixes in place — nothing further needed:

1. **robots.txt was blocking the spider.** `zap.spider.set_option_parse_robots_txt(False)`
   is set before spidering, so a target's robots.txt can no longer starve the spider
   (and therefore the active scanner) of URLs to test.
2. **ZAP session cross-contamination.** `zap.core.new_session(..., overwrite=True)` runs
   at the start of every scan, so results/site-tree state from a previous scan can't
   bleed into (or get confused with) the current one.
3. **Alerts silently dropped by scheme/host mismatch.** The old `zap.core.alerts(baseurl=target_url)`
   exact-string filter is gone — `zap.core.alerts()` now pulls everything from the
   (now-isolated) session, so a target that redirects http→https no longer loses findings
   recorded under the https variant.

## Newly fixed in this pass (the scan #15 crash)
The actual failure in your log — `psycopg2.OperationalError: could not translate host
name "aws-0-ap-northeast-1.pooler.supabase.com"` — was a transient DNS/network hiccup
against the Supabase pooler, hit right at the end of an 8-minute scan. Two things made
it much worse than it needed to be:

- `get_db()` opened a **brand-new connection (and did a fresh DNS lookup) on every single
  call** — including the frequent progress writes during a long scan — so there were many
  chances over 8 minutes for a blip to land badly.
- When `insert_findings()` failed, the `except` block's own call to `finish_scan()` **also**
  called `get_db()` and failed the same way — a second, unhandled exception that killed the
  background thread before the scan could even be marked `"failed"`. Result: the scan's
  findings were lost *and* it was stuck showing `"running"` forever.

### `services/db_service.py`
- `get_db()` is now backed by a small persistent connection pool (`psycopg2.pool.ThreadedConnectionPool`)
  instead of connecting from scratch every call — far fewer DNS lookups over a long scan.
- Borrowing a connection now retries transient failures with backoff (4 attempts: immediate,
  then +1s, +2s, +5s) before giving up, and validates a pooled connection with `SELECT 1`
  before handing it back so a stale/dropped connection gets discarded and replaced instead
  of erroring.
- TCP keepalives are set on every connection so an idle connection (e.g. sitting unused for
  a while during a long active scan) gets its dead sockets detected and recycled rather than
  silently hanging.

### `routes/dast.py`
- Added `_safe_finish_scan()` — the call that marks a scan `"completed"`/`"failed"` can now
  never again crash the background thread. If it fails even after `get_db()`'s own retries
  are exhausted, it's logged at `CRITICAL` instead of taking the whole thread down silently.

### `scanners/zap_runner.py`
- Added Windows sleep prevention (`SetThreadExecutionState`) around the spider/AJAX-spider/
  active-scan phases — addresses the "Windows sleep mode kills ZAP mid-scan" cause noted
  earlier. No-op on non-Windows.

## What this does NOT change
- The async job pattern (`POST` returns immediately with a `scan_id`, frontend polls
  `GET /api/dast/scan/{id}`) was already implemented correctly in your code — nothing to fix there.
- Your teammate's code (`dast_working_sujal_code_.zip`) was not merged in — it's an earlier,
  pre-Postgres/pre-auth snapshot of the whole backend and doesn't include any of the three
  ZAP fixes above, so it wasn't a fix to bring in.

## Verified
- `pytest tests/` — all 27 tests still pass.
- `ruff check .` — no new lint issues (the handful of pre-existing "unused noqa" notices
  are a quirk that was already present in your original code, unrelated to these changes).
- Manually simulated the exact DNS failure from your log against the new retry logic —
  confirmed it now recovers after transient failures instead of losing the scan.
