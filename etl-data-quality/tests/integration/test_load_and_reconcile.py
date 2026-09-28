"""End-to-end loads into PostgreSQL, reconciled against the independent oracle in expected.py."""
from decimal import Decimal

import psycopg
import pytest

from conftest import SAMPLE_DIR
from etl_dq import load
from expected import D1, D2, expected_market_value_by_portfolio, expected_quantities, source_trade_count


def loaded_quantities(db, as_of):
    rows = db.execute(
        "SELECT portfolio_id, security_id, quantity FROM positions WHERE as_of_date = %s", (as_of,)
    ).fetchall()
    return {(p, s): q for p, s, q in rows}


def loaded_market_value_by_portfolio(db, as_of):
    rows = db.execute(
        "SELECT portfolio_id, sum(market_value_usd) FROM positions WHERE as_of_date = %s GROUP BY 1", (as_of,)
    ).fetchall()
    return dict(rows)


def rejects(db, as_of):
    return db.execute(
        "SELECT source_file, record_ref, reason FROM etl_rejects WHERE as_of_date = %s ORDER BY reject_id", (as_of,)
    ).fetchall()


@pytest.mark.parametrize("as_of", [D1, D2])
def test_positions_reconcile_to_source_trades(db, run_day, as_of):
    for day in [D1, D2]:
        if day <= as_of:
            run_day(day)
    assert loaded_quantities(db, as_of) == expected_quantities(SAMPLE_DIR, as_of)


@pytest.mark.parametrize("as_of", [D1, D2])
def test_market_value_totals_reconcile_to_source(db, run_day, as_of):
    for day in [D1, D2]:
        if day <= as_of:
            run_day(day)
    assert loaded_market_value_by_portfolio(db, as_of) == expected_market_value_by_portfolio(SAMPLE_DIR, as_of)


def test_incremental_load_rolls_forward_without_touching_prior_day(db, run_day):
    run_day(D1)
    day_one = loaded_quantities(db, D1)
    run_day(D2)
    assert loaded_quantities(db, D1) == day_one
    d2 = loaded_quantities(db, D2)
    assert d2[("GROWTH", "AAPL")] == Decimal("1000")  # 1500 bought on D1, 500 sold on D2
    assert ("GROWTH", "NESN") not in d2  # fully sold on D2


def test_trade_counts_reconcile(db, run_day):
    run_day(D1)
    summary = run_day(D2)
    assert summary.source_trade_rows == source_trade_count(SAMPLE_DIR, D2)
    assert summary.source_trade_rows == summary.applied_trades + summary.cancelled_trades + summary.rejected_trades
    assert (summary.applied_trades, summary.cancelled_trades, summary.rejected_trades) == (5, 1, 1)


def test_rejected_trade_lands_in_rejects_table(db, run_day):
    run_day(D1)
    run_day(D2)
    assert rejects(db, D2) == [("trades.csv", "T1013", "unknown security TSLA")]


def test_rerun_is_idempotent(db, run_day):
    run_day(D1)
    run_day(D2)
    first = (loaded_quantities(db, D2), loaded_market_value_by_portfolio(db, D2), rejects(db, D2))
    run_day(D2)
    assert (loaded_quantities(db, D2), loaded_market_value_by_portfolio(db, D2), rejects(db, D2)) == first
    assert db.execute("SELECT count(*) FROM etl_runs WHERE as_of_date = %s", (D2,)).fetchone()[0] == 2


def test_rerun_after_source_correction_replaces_the_day(db, run_day, data_dir):
    run_day(D1, data_dir)
    run_day(D2, data_dir)
    trades = data_dir / D2.isoformat() / "trades.csv"
    trades.write_text("".join(line for line in trades.open() if "TSLA" not in line))

    summary = run_day(D2, data_dir)

    assert rejects(db, D2) == []
    assert summary.rejected_trades == 0
    assert loaded_quantities(db, D2) == expected_quantities(data_dir, D2)


def test_failed_load_rolls_back_completely(db, run_day, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("simulated failure after positions were written")

    monkeypatch.setattr(load, "record_run", boom)
    with pytest.raises(RuntimeError):
        run_day(D1)
    for table in ["positions", "etl_rejects", "etl_runs", "security_master"]:
        assert db.execute(f"SELECT count(*) FROM {table}").fetchone()[0] == 0, table


def test_primary_key_blocks_duplicate_positions(db, run_day):
    run_day(D1)
    with pytest.raises(psycopg.errors.UniqueViolation):
        db.execute(
            "INSERT INTO positions (as_of_date, portfolio_id, security_id, quantity, currency) "
            "VALUES (%s, 'GROWTH', 'AAPL', 1, 'USD')",
            (D1,),
        )


def test_foreign_key_blocks_positions_in_unknown_securities(db, run_day):
    run_day(D1)
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        db.execute(
            "INSERT INTO positions (as_of_date, portfolio_id, security_id, quantity, currency) "
            "VALUES (%s, 'GROWTH', 'TSLA', 1, 'USD')",
            (D1,),
        )
