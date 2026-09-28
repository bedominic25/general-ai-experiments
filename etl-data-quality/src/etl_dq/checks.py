"""Data-quality rules that run against the loaded target tables.

Each check is a SQL query that returns the rows that break the rule, so a check with
zero rows passes. These cover what the schema can't enforce by itself. Primary and
foreign keys already guarantee uniqueness and referential integrity, so those aren't
repeated here.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any, Dict, List

import psycopg
from psycopg.rows import dict_row

PRIOR_DATE = "(SELECT max(as_of_date) FROM positions WHERE as_of_date < %(as_of)s)"


@dataclass(frozen=True)
class Check:
    name: str
    description: str
    sql: str


@dataclass(frozen=True)
class CheckResult:
    name: str
    description: str
    failing_rows: List[Dict[str, Any]]

    @property
    def passed(self) -> bool:
        return not self.failing_rows


CHECKS = (
    Check(
        "no_negative_positions",
        "Long-only portfolios: no position may be short (quantity < 0)",
        """
        SELECT portfolio_id, security_id, quantity
          FROM positions
         WHERE as_of_date = %(as_of)s AND quantity < 0
        """,
    ),
    Check(
        "positions_priced",
        "Every position has a price, an FX rate and a market value",
        """
        SELECT portfolio_id, security_id, price_local, fx_rate_usd, market_value_usd
          FROM positions
         WHERE as_of_date = %(as_of)s
           AND (price_local IS NULL OR fx_rate_usd IS NULL OR market_value_usd IS NULL)
        """,
    ),
    Check(
        "market_value_recalculates",
        "market_value_usd is within half a cent of quantity * price * FX",
        # A value correctly rounded to the cent is never more than 0.005 from the exact product,
        # whichever rounding mode produced it. So this doesn't depend on Postgres's round()
        # (half away from zero) matching the ETL's banker's rounding.
        """
        SELECT portfolio_id, security_id, market_value_usd,
               quantity * price_local * fx_rate_usd AS recalculated
          FROM positions
         WHERE as_of_date = %(as_of)s
           AND abs(market_value_usd - quantity * price_local * fx_rate_usd) > 0.005
        """,
    ),
    Check(
        "currency_matches_master",
        "Position currency agrees with the security master",
        """
        SELECT p.portfolio_id, p.security_id, p.currency, s.currency AS master_currency
          FROM positions p
          JOIN security_master s USING (security_id)
         WHERE p.as_of_date = %(as_of)s AND p.currency <> s.currency
        """,
    ),
    Check(
        "price_move_within_tolerance",
        "No held security's price moved more than 25% since the prior load (stale or bad price)",
        f"""
        WITH today AS (
            SELECT DISTINCT security_id, price_local FROM positions
             WHERE as_of_date = %(as_of)s AND price_local IS NOT NULL
        ), prior AS (
            SELECT DISTINCT security_id, price_local FROM positions
             WHERE as_of_date = {PRIOR_DATE} AND price_local IS NOT NULL
        )
        SELECT t.security_id, p.price_local AS prior_price, t.price_local AS price
          FROM today t JOIN prior p USING (security_id)
         WHERE p.price_local <> 0 AND abs(t.price_local / p.price_local - 1) > 0.25
        """,
    ),
    Check(
        "portfolio_completeness",
        "Every portfolio holding positions on the prior date also has positions today",
        f"""
        SELECT DISTINCT p.portfolio_id
          FROM positions p
         WHERE p.as_of_date = {PRIOR_DATE}
           AND NOT EXISTS (SELECT 1 FROM positions t
                            WHERE t.as_of_date = %(as_of)s AND t.portfolio_id = p.portfolio_id)
        """,
    ),
    Check(
        "run_reconciles",
        "Latest ETL run exists, source rows = applied + cancelled + rejected, "
        "and the positions table holds what the run says it loaded",
        """
        WITH latest AS (
            SELECT * FROM etl_runs WHERE as_of_date = %(as_of)s ORDER BY run_id DESC LIMIT 1
        )
        SELECT 'no ETL run recorded' AS problem
         WHERE NOT EXISTS (SELECT 1 FROM latest)
        UNION ALL
        SELECT 'trade counts do not reconcile'
          FROM latest
         WHERE source_trade_rows <> applied_trades + cancelled_trades + rejected_trades
        UNION ALL
        SELECT 'loaded_positions does not match positions table'
          FROM latest
         WHERE loaded_positions <> (SELECT count(*) FROM positions WHERE as_of_date = %(as_of)s)
        """,
    ),
)

CHECKS_BY_NAME = {c.name: c for c in CHECKS}


def run_checks(conn: psycopg.Connection, as_of: dt.date) -> List[CheckResult]:
    results = []
    for check in CHECKS:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(check.sql, {"as_of": as_of})
            results.append(CheckResult(check.name, check.description, cur.fetchall()))
    return results
