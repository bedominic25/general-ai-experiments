import datetime as dt
from decimal import Decimal

import pytest

from etl_dq.extract import FxRate, Price, Security, Trade
from etl_dq.transform import build_positions, market_value_usd

AS_OF = dt.date(2026, 9, 24)
SECURITIES = [
    Security("AAPL", "Apple Inc", "USD", "EQUITY"),
    Security("SAP", "SAP SE", "EUR", "EQUITY"),
]
PRICES = [
    Price("AAPL", AS_OF, Decimal("200.00"), "USD"),
    Price("SAP", AS_OF, Decimal("100.00"), "EUR"),
]
FX = [FxRate("EUR", AS_OF, Decimal("1.10"))]

_ids = iter(range(1, 10_000))


def trade(security="AAPL", side="BUY", qty="100", *, portfolio="GROWTH", status="NEW", trade_id=None, trade_date=AS_OF):
    return Trade(trade_id or f"T{next(_ids)}", trade_date, portfolio, security, side, Decimal(qty), status)


def build(trades, prior=None, *, prices=PRICES, fx=FX, securities=SECURITIES):
    return build_positions(AS_OF, prior or {}, trades, securities, prices, fx)


def quantities(result):
    return {(p.portfolio_id, p.security_id): p.quantity for p in result.positions}


def test_buys_and_sells_net_per_portfolio_and_security():
    result = build([trade(qty="100"), trade(qty="50"), trade(side="SELL", qty="30"), trade(portfolio="INCOME", qty="10")])
    assert quantities(result) == {("GROWTH", "AAPL"): Decimal("120"), ("INCOME", "AAPL"): Decimal("10")}
    assert result.applied_trades == 4


def test_cancelled_trades_are_counted_but_not_applied():
    result = build([trade(qty="100"), trade(qty="999", status="CANCELLED")])
    assert quantities(result) == {("GROWTH", "AAPL"): Decimal("100")}
    assert (result.applied_trades, result.cancelled_trades, result.rejected_trades) == (1, 1, 0)


def test_prior_positions_roll_forward_and_are_revalued_at_todays_price():
    result = build([], prior={("GROWTH", "SAP"): Decimal("10")})
    [position] = result.positions
    assert position.quantity == Decimal("10")
    assert position.market_value_usd == Decimal("1100.00")  # 10 * 100.00 EUR * 1.10


def test_fully_closed_position_is_dropped():
    result = build([trade(side="SELL", qty="100")], prior={("GROWTH", "AAPL"): Decimal("100")})
    assert result.positions == []


@pytest.mark.parametrize(
    "bad_trade, reason",
    [
        (trade(security="TSLA", trade_id="TX"), "unknown security TSLA"),
        (trade(trade_id="TX", trade_date=dt.date(2026, 9, 23)), "does not match load date"),
    ],
)
def test_invalid_trades_are_rejected_with_a_reason(bad_trade, reason):
    result = build([trade(qty="100"), bad_trade])
    assert quantities(result) == {("GROWTH", "AAPL"): Decimal("100")}
    [reject] = result.rejects
    assert (reject.source_file, reject.record_ref) == ("trades.csv", "TX")
    assert reason in reject.reason


def test_duplicate_trade_id_is_applied_once():
    result = build([trade(trade_id="T1", qty="100"), trade(trade_id="T1", qty="100")])
    assert quantities(result) == {("GROWTH", "AAPL"): Decimal("100")}
    assert result.rejects[0].reason == "duplicate trade_id T1"


def test_usd_needs_no_fx_row():
    [position] = build([trade(qty="3")], fx=[]).positions
    assert position.fx_rate_usd == Decimal(1)
    assert position.market_value_usd == Decimal("600.00")


@pytest.mark.parametrize(
    "prices, fx, source_file, reason",
    [
        ([], FX, "prices.csv", "no 2026-09-24 price for SAP"),
        (PRICES, [], "fx_rates.csv", "no 2026-09-24 USD rate for EUR"),
        ([Price("SAP", AS_OF, Decimal("100"), "USD")], FX, "prices.csv", "price currency USD != security currency EUR"),
        ([Price("SAP", dt.date(2026, 9, 23), Decimal("100"), "EUR")], FX, "prices.csv", "no 2026-09-24 price"),
    ],
)
def test_unvalued_position_keeps_quantity_and_raises_an_exception(prices, fx, source_file, reason):
    result = build([trade(security="SAP", qty="10")], prices=prices, fx=fx)
    [position] = result.positions
    assert position.quantity == Decimal("10")  # still carried, so tomorrow's roll-forward is right
    assert position.market_value_usd is None
    [reject] = result.rejects
    assert (reject.source_file, reject.record_ref) == (source_file, "GROWTH/SAP")
    assert reason in reject.reason
    assert result.rejected_trades == 0  # a valuation exception isn't a rejected trade


@pytest.mark.parametrize(
    "qty, price, fx, expected",
    [
        ("1", "0.125", "1", "0.12"),  # exact half-cent rounds to even
        ("1", "0.135", "1", "0.14"),
        ("1", "0.1251", "1", "0.13"),
        ("20000", "0.7415", "1.3321", "19755.04"),  # 19755.043
        ("1200", "212.80", "1.1095", "283321.92"),  # exact, no rounding needed
        ("1", "0.25", "0.1", "0.02"),  # 0.025 after FX conversion: half rounds to even
        ("-10", "0.125", "1", "-1.25"),
    ],
)
def test_market_value_uses_bankers_rounding(qty, price, fx, expected):
    assert market_value_usd(Decimal(qty), Decimal(price), Decimal(fx)) == Decimal(expected)
