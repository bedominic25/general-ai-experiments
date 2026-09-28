import datetime as dt
from decimal import Decimal

import pytest

from conftest import SAMPLE_DIR
from etl_dq.extract import ExtractError, read_fx_rates, read_prices, read_securities, read_trades

TRADE_HEADER = ["trade_id", "trade_date", "portfolio_id", "security_id", "side", "quantity", "status"]
GOOD_TRADE = ["T1", "2026-09-24", "GROWTH", "AAPL", "BUY", "100", "NEW"]


def test_reads_sample_files_into_typed_records():
    trades = read_trades(SAMPLE_DIR / "2026-09-24" / "trades.csv")
    assert len(trades) == 8
    first = trades[0]
    assert first.trade_date == dt.date(2026, 9, 24)
    assert first.quantity == Decimal("1500")
    assert len(read_securities(SAMPLE_DIR / "reference" / "securities.csv")) == 6
    assert read_prices(SAMPLE_DIR / "2026-09-24" / "prices.csv")[0].close_price == Decimal("231.45")
    assert {r.currency for r in read_fx_rates(SAMPLE_DIR / "2026-09-24" / "fx_rates.csv")} == {"CHF", "EUR", "GBP"}


def test_windows_excel_export_with_bom_and_crlf(write_csv):
    path = write_csv("trades.csv", TRADE_HEADER, [GOOD_TRADE], bom=True, newline="\r\n")
    [trade] = read_trades(path)
    # Without utf-8-sig the first column would be read as "﻿trade_id" and fail the header check.
    assert trade.trade_id == "T1"
    assert trade.status == "NEW"  # not "NEW\r"


def test_normalizes_case_and_whitespace(write_csv):
    path = write_csv("trades.csv", TRADE_HEADER, [["T1", "2026-09-24", " GROWTH ", "AAPL", " buy ", " 100 ", "new"]])
    [trade] = read_trades(path)
    assert (trade.portfolio_id, trade.side, trade.quantity, trade.status) == ("GROWTH", "BUY", Decimal("100"), "NEW")


def test_skips_blank_lines(write_csv):
    path = write_csv("trades.csv", TRADE_HEADER, [GOOD_TRADE, [""] * 7, ["T2"] + GOOD_TRADE[1:]])
    assert [t.trade_id for t in read_trades(path)] == ["T1", "T2"]


def test_missing_required_column_is_named(write_csv):
    header = [c for c in TRADE_HEADER if c != "status"]
    path = write_csv("trades.csv", header, [GOOD_TRADE[:-1]])
    with pytest.raises(ExtractError, match=r"missing required column\(s\) \['status'\]"):
        read_trades(path)


@pytest.mark.parametrize(
    "column, value, message",
    [
        ("quantity", "abc", "is not a number"),
        ("quantity", "", "is empty"),
        ("quantity", "-5", "must be greater than zero"),
        ("quantity", "0", "must be greater than zero"),
        ("quantity", "NaN", "is not a finite number"),
        ("trade_date", "09/24/2026", "is not an ISO date"),
        ("side", "HOLD", "is not one of"),
        ("status", "PENDING", "is not one of"),
    ],
)
def test_bad_values_report_file_and_line(write_csv, column, value, message):
    bad = list(GOOD_TRADE)
    bad[TRADE_HEADER.index(column)] = value
    path = write_csv("trades.csv", TRADE_HEADER, [GOOD_TRADE, bad])
    with pytest.raises(ExtractError, match=rf"trades\.csv line 3: {column}.*{message}"):
        read_trades(path)
