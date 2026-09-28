"""Transform: roll the day's trades into end-of-day positions and value them in USD.

A position for date D is the prior loaded day's quantity plus D's trades. Positions
that net to zero are closed out and dropped. A position that can't be valued (no
price or FX rate for D) is still carried with its quantity, so tomorrow's roll-forward
stays correct, but it gets NULL valuation and an exception row. The data-quality
checks then report it as unpriced instead of the ETL silently dropping holdings.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from decimal import ROUND_HALF_EVEN, Decimal
from typing import Dict, Iterable, List, Mapping, Optional, Tuple

from etl_dq.extract import FxRate, Price, Security, Trade

TRADES_FILE = "trades.csv"
CENT = Decimal("0.01")

PositionKey = Tuple[str, str]  # (portfolio_id, security_id)


@dataclass(frozen=True)
class Position:
    as_of_date: dt.date
    portfolio_id: str
    security_id: str
    quantity: Decimal
    currency: str
    price_local: Optional[Decimal]
    fx_rate_usd: Optional[Decimal]
    market_value_usd: Optional[Decimal]


@dataclass(frozen=True)
class Reject:
    source_file: str
    record_ref: str
    reason: str


@dataclass
class TransformResult:
    positions: List[Position] = field(default_factory=list)
    rejects: List[Reject] = field(default_factory=list)
    applied_trades: int = 0
    cancelled_trades: int = 0

    @property
    def rejected_trades(self) -> int:
        return sum(1 for r in self.rejects if r.source_file == TRADES_FILE)


def market_value_usd(quantity: Decimal, price_local: Decimal, fx_rate_usd: Decimal) -> Decimal:
    """Banker's rounding (half-even) to the cent, the usual convention for accounting totals."""
    return (quantity * price_local * fx_rate_usd).quantize(CENT, rounding=ROUND_HALF_EVEN)


def build_positions(
    as_of: dt.date,
    prior_quantities: Mapping[PositionKey, Decimal],
    trades: Iterable[Trade],
    securities: Iterable[Security],
    prices: Iterable[Price],
    fx_rates: Iterable[FxRate],
) -> TransformResult:
    securities_by_id = {s.security_id: s for s in securities}
    prices_by_id = {p.security_id: p for p in prices if p.price_date == as_of}
    usd_rates = {r.currency: r.usd_rate for r in fx_rates if r.rate_date == as_of}
    usd_rates.setdefault("USD", Decimal(1))

    result = TransformResult()
    quantities: Dict[PositionKey, Decimal] = dict(prior_quantities)
    seen_trade_ids = set()

    for trade in trades:
        if trade.status == "CANCELLED":
            result.cancelled_trades += 1
            continue
        reason = None
        if trade.trade_id in seen_trade_ids:
            reason = f"duplicate trade_id {trade.trade_id}"
        elif trade.trade_date != as_of:
            reason = f"trade_date {trade.trade_date} does not match load date {as_of}"
        elif trade.security_id not in securities_by_id:
            reason = f"unknown security {trade.security_id}"
        if reason:
            result.rejects.append(Reject(TRADES_FILE, trade.trade_id, reason))
            continue
        seen_trade_ids.add(trade.trade_id)
        signed = trade.quantity if trade.side == "BUY" else -trade.quantity
        key = (trade.portfolio_id, trade.security_id)
        quantities[key] = quantities.get(key, Decimal(0)) + signed
        result.applied_trades += 1

    for (portfolio_id, security_id), quantity in sorted(quantities.items()):
        if quantity == 0:
            continue
        ref = f"{portfolio_id}/{security_id}"
        security = securities_by_id.get(security_id)
        if security is None:
            result.rejects.append(Reject("positions", ref, f"{security_id} missing from security master"))
            continue

        price = prices_by_id.get(security_id)
        if price is None:
            result.rejects.append(Reject("prices.csv", ref, f"no {as_of} price for {security_id}"))
        elif price.currency != security.currency:
            result.rejects.append(
                Reject("prices.csv", ref, f"price currency {price.currency} != security currency {security.currency}")
            )
            price = None
        fx_rate = usd_rates.get(security.currency)
        if fx_rate is None:
            result.rejects.append(Reject("fx_rates.csv", ref, f"no {as_of} USD rate for {security.currency}"))

        valued = price is not None and fx_rate is not None
        result.positions.append(
            Position(
                as_of_date=as_of,
                portfolio_id=portfolio_id,
                security_id=security_id,
                quantity=quantity,
                currency=security.currency,
                price_local=price.close_price if price else None,
                fx_rate_usd=fx_rate,
                market_value_usd=market_value_usd(quantity, price.close_price, fx_rate) if valued else None,
            )
        )
    return result
