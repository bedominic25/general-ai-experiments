"""Independent test oracle: expected results computed straight from the source CSVs.

This deliberately doesn't import etl_dq. Reconciliation tests compare the loaded
target tables with these numbers, so a bug in the pipeline can't hide by also being
in the code that's supposed to check it.
"""
from __future__ import annotations

import csv
import datetime as dt
from collections import defaultdict
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Dict, List, Tuple

D1 = dt.date(2026, 9, 24)
D2 = dt.date(2026, 9, 25)


def rows(path: Path) -> List[Dict[str, str]]:
    with Path(path).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _day_dirs(data_dir: Path, through: dt.date) -> List[Path]:
    return sorted(
        d for d in Path(data_dir).iterdir()
        if d.is_dir() and d.name != "reference" and d.name <= through.isoformat()
    )


def expected_quantities(data_dir: Path, as_of: dt.date) -> Dict[Tuple[str, str], Decimal]:
    known = {r["security_id"] for r in rows(Path(data_dir) / "reference" / "securities.csv")}
    totals: Dict[Tuple[str, str], Decimal] = defaultdict(Decimal)
    for day in _day_dirs(data_dir, as_of):
        seen = set()
        for t in rows(day / "trades.csv"):
            if t["status"] == "CANCELLED" or t["security_id"] not in known or t["trade_id"] in seen:
                continue
            seen.add(t["trade_id"])
            qty = Decimal(t["quantity"])
            totals[(t["portfolio_id"], t["security_id"])] += qty if t["side"] == "BUY" else -qty
    return {k: v for k, v in totals.items() if v != 0}


def expected_market_value_by_portfolio(data_dir: Path, as_of: dt.date) -> Dict[str, Decimal]:
    day = Path(data_dir) / as_of.isoformat()
    currency = {r["security_id"]: r["currency"] for r in rows(Path(data_dir) / "reference" / "securities.csv")}
    price = {r["security_id"]: Decimal(r["close_price"]) for r in rows(day / "prices.csv")}
    fx = {r["currency"]: Decimal(r["usd_rate"]) for r in rows(day / "fx_rates.csv")}
    fx["USD"] = Decimal(1)
    totals: Dict[str, Decimal] = defaultdict(Decimal)
    for (portfolio, security), qty in expected_quantities(data_dir, as_of).items():
        mv = qty * price[security] * fx[currency[security]]
        totals[portfolio] += mv.quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
    return dict(totals)


def source_trade_count(data_dir: Path, as_of: dt.date) -> int:
    return len(rows(Path(data_dir) / as_of.isoformat() / "trades.csv"))
