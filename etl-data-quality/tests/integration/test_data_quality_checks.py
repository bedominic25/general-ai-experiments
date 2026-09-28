"""Data-quality rules: every rule passes on clean data and is shown to catch the defect it targets."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import SAMPLE_DIR
from etl_dq.checks import CHECKS_BY_NAME, run_checks
from expected import D1, D2

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# (check that must fail, SQL that corrupts an otherwise clean D2 load). Each corruption is
# scoped to D2: the day-over-day checks compare against D1, so changing both days would hide the defect.
ON_D2 = f"as_of_date = '{D2.isoformat()}'"
CORRUPTIONS = {
    "no_negative_positions": f"UPDATE positions SET quantity = -quantity WHERE {ON_D2} AND security_id = 'MSFT' AND portfolio_id = 'GROWTH'",
    "positions_priced": f"UPDATE positions SET price_local = NULL, market_value_usd = NULL WHERE {ON_D2} AND security_id = 'SAP'",
    "market_value_recalculates": f"UPDATE positions SET market_value_usd = market_value_usd + 0.01 WHERE {ON_D2} AND security_id = 'VOD'",
    "currency_matches_master": f"UPDATE positions SET currency = 'USD' WHERE {ON_D2} AND security_id = 'VOD'",
    "price_move_within_tolerance": f"UPDATE positions SET price_local = price_local * 1.3 WHERE {ON_D2} AND security_id = 'AAPL'",
    "portfolio_completeness": f"DELETE FROM positions WHERE {ON_D2} AND portfolio_id = 'INCOME'",
    "run_reconciles": f"UPDATE etl_runs SET applied_trades = applied_trades - 1 WHERE {ON_D2}",
}


def failed(db, as_of):
    return {r.name: r.failing_rows for r in run_checks(db, as_of) if not r.passed}


@pytest.fixture
def loaded(db, run_day):
    run_day(D1)
    run_day(D2)
    return db


@pytest.mark.parametrize("as_of", [D1, D2])
def test_all_checks_pass_on_clean_sample_data(loaded, as_of):
    assert failed(loaded, as_of) == {}


def test_every_check_has_a_negative_test():
    assert set(CORRUPTIONS) == set(CHECKS_BY_NAME)


@pytest.mark.parametrize("check", sorted(CORRUPTIONS))
def test_check_catches_its_defect(loaded, check):
    loaded.execute(CORRUPTIONS[check])
    assert check in failed(loaded, D2)


def test_run_reconciles_fails_when_no_run_was_recorded(db):
    assert failed(db, D1)["run_reconciles"] == [{"problem": "no ETL run recorded"}]


def test_oversell_in_source_is_caught_end_to_end(db, run_day, data_dir):
    trades = data_dir / D2.isoformat() / "trades.csv"
    with trades.open("a") as f:
        f.write("T1016,2026-09-25,INCOME,MSFT,SELL,500,NEW\n")  # holds 300
    run_day(D1, data_dir)
    run_day(D2, data_dir)
    assert failed(db, D2) == {
        "no_negative_positions": [{"portfolio_id": "INCOME", "security_id": "MSFT", "quantity": -200}]
    }


def test_missing_price_in_source_is_caught_end_to_end(db, run_day, data_dir):
    prices = data_dir / D2.isoformat() / "prices.csv"
    prices.write_text("".join(line for line in prices.open() if not line.startswith("SAP,")))
    run_day(D1, data_dir)
    run_day(D2, data_dir)
    problems = failed(db, D2)
    assert list(problems) == ["positions_priced"]
    assert [row["security_id"] for row in problems["positions_priced"]] == ["SAP"]


@pytest.mark.parametrize(
    "corrupt, expected_exit",
    [(False, 0), (True, 1)],
    ids=["clean-data-exits-0", "failed-check-exits-1"],
)
def test_cli_exit_code_gates_on_data_quality(database_url, data_dir, db, corrupt, expected_exit):
    if corrupt:
        prices = data_dir / D1.isoformat() / "prices.csv"
        prices.write_text("".join(line for line in prices.open() if not line.startswith("MSFT,")))
    env = {**os.environ, "DATABASE_URL": database_url, "PYTHONPATH": str(PROJECT_ROOT / "src")}
    proc = subprocess.run(
        [sys.executable, "-m", "etl_dq.pipeline", "--data-dir", str(data_dir), "--as-of", D1.isoformat()],
        env=env, capture_output=True, text=True,
    )
    assert proc.returncode == expected_exit, proc.stdout + proc.stderr
    assert "8 trade rows -> 7 applied, 1 cancelled, 0 rejected" in proc.stdout
