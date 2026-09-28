# ETL Data Quality

A Python + Pytest framework for testing an ETL pipeline and validating the data it
loads into PostgreSQL. The system under test is a small but realistic investment-data
job: each business day it takes trade, security-master, price and FX files, rolls
trades forward into end-of-day portfolio positions, values them in USD, and loads
them into Postgres. The tests check every stage and reconcile the target tables
against the source files.

## What the pipeline does

```
data/sample/
  reference/securities.csv          security master (id, currency, asset class)
  2026-09-24/ trades.csv prices.csv fx_rates.csv
  2026-09-25/ ...

extract    CSV -> typed records (Decimal, dates), header and value validation
transform  prior day's positions + today's trades -> positions valued in USD
load       replace the business date in one transaction (idempotent reruns)
checks     SQL data-quality rules against the loaded tables
```

PostgreSQL tables: `security_master`, `positions`, `etl_rejects` (every record that
couldn't be processed, with a reason) and `etl_runs` (an audit row per load with its
counts).

## What the tests cover

| Layer | Examples |
|---|---|
| **Extract** (unit) | missing columns, bad numbers/dates/enums reported with file + line number, blank lines, **UTF-8 BOM + CRLF files as exported by Excel on Windows** |
| **Transform** (unit) | buy/sell netting, cancelled trades, roll-forward of prior positions, close-outs, duplicate/unknown/wrong-date trades rejected, missing price/FX/currency mismatch, banker's rounding (parametrized) |
| **Load + reconciliation** (integration) | positions and portfolio market values reconciled to an **independent oracle** computed from the source CSVs, trade counts reconcile (source = applied + cancelled + rejected), incremental load, idempotent rerun, rerun after a source correction, rollback on mid-load failure, PK/FK constraints |
| **Data-quality rules** (integration) | 7 SQL checks (below). Each one passes on clean data and has a negative test proving it catches the defect it targets. A meta-test fails if a check is added without one |
| **CLI** (integration) | the job exits non-zero when a data-quality check fails, so a scheduler or CI can gate on it |

Data-quality checks (`src/etl_dq/checks.py`):

- `no_negative_positions`: long-only portfolios can't go short
- `positions_priced`: every position has a price, FX rate and market value
- `market_value_recalculates`: stored value is within half a cent of quantity × price × FX
- `currency_matches_master`: position currency agrees with the security master
- `price_move_within_tolerance`: flags a >25% day-over-day price move (stale or bad price)
- `portfolio_completeness`: a portfolio that had positions yesterday has positions today
- `run_reconciles`: a run was recorded, its counts add up, and the table holds what it says it loaded

## Design decisions

- **Independent oracle.** `tests/expected.py` recomputes expected positions and
  market values from the CSVs with plain `csv` + `Decimal` and never imports the
  pipeline. If the reconciliation tests reused pipeline code, a bug in that code would
  pass its own test.
- **Decimal, never float.** Money and quantities are `Decimal` end to end and
  `numeric` in Postgres. Rounding is half-even to the cent. The recalculation check
  uses a ±0.005 tolerance instead of Postgres `round()`, which rounds half away from
  zero and would falsely flag exact half-cent values.
- **Unvalued positions are loaded, not dropped.** A missing price keeps the position's
  quantity (so the next day's roll-forward stays right) with NULL valuation plus an
  exception row. Dropping it would silently understate the portfolio.
- **Isolated test database.** A session fixture creates a uniquely named database and
  drops it at the end. Each test gets a fresh schema, so tests are order-independent and
  never touch real data.
- **Negative tests corrupt a copy.** Tests that break source files work on a copy in
  `tmp_path`. Tests that corrupt loaded data scope the change to one business date,
  because the day-over-day checks compare against the previous date.
- **Cross-platform.** `pathlib` everywhere, no shell calls. CI runs the suite on both
  Ubuntu and Windows.

## Running it

Requires Python 3.9+ and a PostgreSQL server (13+). Tests create and drop their own
database, so `DATABASE_URL` only needs to point at a server where you can
`CREATE DATABASE`. It defaults to `postgresql://localhost/postgres`.

macOS / Linux:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://localhost/postgres
pytest                        # everything
pytest -m unit                # no database needed
pytest --html=reports/report.html --self-contained-html
python -m etl_dq.pipeline --data-dir data/sample --as-of 2026-09-24   # with PYTHONPATH=src
```

Windows (PowerShell):

```powershell
py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL = "postgresql://postgres:<password>@localhost:5432/postgres"
pytest
```

## Known limitations

- Rerunning an earlier date after later dates are loaded doesn't cascade: later
  dates keep the roll-forward they were built from and need to be rerun in order.
- Duplicate trade IDs are only caught within a single day's file, not across days.
- `portfolio_completeness` would also flag a portfolio that was intentionally
  liquidated. In a real system that would be a warning with an allow-list, not a hard fail.
- Prices and FX rates in the sample data are illustrative, not real market data.
