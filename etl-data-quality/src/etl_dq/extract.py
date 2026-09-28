"""Extract: read the daily CSV drops into typed records.

Every file is opened with ``utf-8-sig`` so a byte-order mark from an Excel export
on Windows doesn't get glued onto the first column name, and with ``newline=""``
so CRLF line endings are handled by the csv module instead of leaking into values.
"""
from __future__ import annotations

import csv
import datetime as dt
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Callable, Dict, List, Sequence, TypeVar

T = TypeVar("T")


class ExtractError(ValueError):
    """A source file is structurally unusable: missing columns or an unparseable value."""


@dataclass(frozen=True)
class Trade:
    trade_id: str
    trade_date: dt.date
    portfolio_id: str
    security_id: str
    side: str  # BUY or SELL
    quantity: Decimal
    status: str  # NEW or CANCELLED


@dataclass(frozen=True)
class Security:
    security_id: str
    name: str
    currency: str
    asset_class: str


@dataclass(frozen=True)
class Price:
    security_id: str
    price_date: dt.date
    close_price: Decimal
    currency: str


@dataclass(frozen=True)
class FxRate:
    currency: str
    rate_date: dt.date
    usd_rate: Decimal  # USD value of one unit of `currency`


def _decimal(row: Dict[str, str], field: str, *, positive: bool = False) -> Decimal:
    value = row[field]
    if value == "":
        raise ValueError(f"{field} is empty")
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise ValueError(f"{field}={value!r} is not a number") from None
    if not number.is_finite():
        raise ValueError(f"{field}={value!r} is not a finite number")
    if positive and number <= 0:
        raise ValueError(f"{field}={value!r} must be greater than zero")
    return number


def _date(row: Dict[str, str], field: str) -> dt.date:
    try:
        return dt.date.fromisoformat(row[field])
    except ValueError:
        raise ValueError(f"{field}={row[field]!r} is not an ISO date (YYYY-MM-DD)") from None


def _choice(row: Dict[str, str], field: str, allowed: Sequence[str]) -> str:
    value = row[field].upper()
    if value not in allowed:
        raise ValueError(f"{field}={row[field]!r} is not one of {list(allowed)}")
    return value


def _read(path: Path, required: Sequence[str], parse: Callable[[Dict[str, str]], T]) -> List[T]:
    path = Path(path)
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        header = [name.strip() for name in (reader.fieldnames or [])]
        missing = [name for name in required if name not in header]
        if missing:
            raise ExtractError(f"{path.name}: missing required column(s) {missing}")
        reader.fieldnames = header

        records = []
        # Line 1 is the header, so the first data row is line 2.
        for line_no, raw in enumerate(reader, start=2):
            row = {k: (v or "").strip() for k, v in raw.items() if k is not None}
            if not any(row.values()):
                continue
            try:
                records.append(parse(row))
            except ValueError as e:
                raise ExtractError(f"{path.name} line {line_no}: {e}") from e
    return records


def read_trades(path: Path) -> List[Trade]:
    return _read(
        path,
        ["trade_id", "trade_date", "portfolio_id", "security_id", "side", "quantity", "status"],
        lambda r: Trade(
            trade_id=r["trade_id"],
            trade_date=_date(r, "trade_date"),
            portfolio_id=r["portfolio_id"],
            security_id=r["security_id"],
            side=_choice(r, "side", ["BUY", "SELL"]),
            quantity=_decimal(r, "quantity", positive=True),
            status=_choice(r, "status", ["NEW", "CANCELLED"]),
        ),
    )


def read_securities(path: Path) -> List[Security]:
    return _read(
        path,
        ["security_id", "name", "currency", "asset_class"],
        lambda r: Security(
            security_id=r["security_id"],
            name=r["name"],
            currency=r["currency"].upper(),
            asset_class=r["asset_class"].upper(),
        ),
    )


def read_prices(path: Path) -> List[Price]:
    return _read(
        path,
        ["security_id", "price_date", "close_price", "currency"],
        lambda r: Price(
            security_id=r["security_id"],
            price_date=_date(r, "price_date"),
            close_price=_decimal(r, "close_price", positive=True),
            currency=r["currency"].upper(),
        ),
    )


def read_fx_rates(path: Path) -> List[FxRate]:
    return _read(
        path,
        ["currency", "rate_date", "usd_rate"],
        lambda r: FxRate(
            currency=r["currency"].upper(),
            rate_date=_date(r, "rate_date"),
            usd_rate=_decimal(r, "usd_rate", positive=True),
        ),
    )
