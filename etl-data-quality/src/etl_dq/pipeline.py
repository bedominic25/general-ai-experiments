"""Run one business date end to end: extract -> transform -> load -> data-quality checks.

    python -m etl_dq.pipeline --data-dir data/sample --as-of 2026-09-24

Exits 1 if any data-quality check fails, so a scheduler or CI job can gate on it.
"""
from __future__ import annotations

import argparse
import datetime as dt
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import psycopg

from etl_dq import checks, db, extract, load, transform


@dataclass(frozen=True)
class RunSummary:
    run_id: int
    as_of: dt.date
    source_trade_rows: int
    applied_trades: int
    cancelled_trades: int
    rejected_trades: int
    loaded_positions: int
    rejects: int


def run(conn: psycopg.Connection, data_dir: Path, as_of: dt.date) -> RunSummary:
    day_dir = Path(data_dir) / as_of.isoformat()
    securities = extract.read_securities(Path(data_dir) / "reference" / "securities.csv")
    trades = extract.read_trades(day_dir / "trades.csv")
    prices = extract.read_prices(day_dir / "prices.csv")
    fx_rates = extract.read_fx_rates(day_dir / "fx_rates.csv")

    with conn.transaction():
        load.upsert_securities(conn, securities)
        prior = load.prior_quantities(conn, as_of)
        result = transform.build_positions(as_of, prior, trades, securities, prices, fx_rates)
        load.replace_day(conn, as_of, result)
        run_id = load.record_run(conn, as_of, len(trades), result)

    return RunSummary(
        run_id=run_id,
        as_of=as_of,
        source_trade_rows=len(trades),
        applied_trades=result.applied_trades,
        cancelled_trades=result.cancelled_trades,
        rejected_trades=result.rejected_trades,
        loaded_positions=len(result.positions),
        rejects=len(result.rejects),
    )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--as-of", type=dt.date.fromisoformat, required=True)
    args = parser.parse_args(argv)

    with db.connect() as conn:
        load.create_schema(conn)
        summary = run(conn, args.data_dir, args.as_of)
        results = checks.run_checks(conn, args.as_of)

    print(
        f"{summary.as_of}: {summary.source_trade_rows} trade rows -> {summary.applied_trades} applied, "
        f"{summary.cancelled_trades} cancelled, {summary.rejected_trades} rejected; "
        f"{summary.loaded_positions} positions loaded, {summary.rejects} exception(s)"
    )
    for r in results:
        print(f"  [{'PASS' if r.passed else 'FAIL'}] {r.name}: {r.description}")
        for row in r.failing_rows[:5]:
            print(f"         {row}")
    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
