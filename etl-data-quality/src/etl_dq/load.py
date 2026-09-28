"""Load: write one business date into PostgreSQL.

Loads replace the whole date (delete, then insert) rather than appending, so rerunning
a date after a source correction is idempotent. The caller wraps the load in a single
transaction, so a failure part-way through leaves the previous state untouched.
"""
from __future__ import annotations

import datetime as dt
from decimal import Decimal
from typing import Dict, Iterable

import psycopg

from etl_dq.extract import Security
from etl_dq.transform import PositionKey, TransformResult

SCHEMA = """
CREATE TABLE IF NOT EXISTS security_master (
    security_id  text PRIMARY KEY,
    name         text NOT NULL,
    currency     char(3) NOT NULL,
    asset_class  text NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
    as_of_date        date NOT NULL,
    portfolio_id      text NOT NULL,
    security_id       text NOT NULL REFERENCES security_master,
    quantity          numeric(20, 4) NOT NULL,
    currency          char(3) NOT NULL,
    price_local       numeric(20, 6),
    fx_rate_usd       numeric(20, 10),
    market_value_usd  numeric(20, 2),
    PRIMARY KEY (as_of_date, portfolio_id, security_id)
);

CREATE TABLE IF NOT EXISTS etl_rejects (
    reject_id    bigserial PRIMARY KEY,
    as_of_date   date NOT NULL,
    source_file  text NOT NULL,
    record_ref   text NOT NULL,
    reason       text NOT NULL
);

CREATE TABLE IF NOT EXISTS etl_runs (
    run_id             bigserial PRIMARY KEY,
    as_of_date         date NOT NULL,
    source_trade_rows  integer NOT NULL,
    applied_trades     integer NOT NULL,
    cancelled_trades   integer NOT NULL,
    rejected_trades    integer NOT NULL,
    loaded_positions   integer NOT NULL,
    loaded_at          timestamptz NOT NULL DEFAULT now()
);
"""


def create_schema(conn: psycopg.Connection) -> None:
    conn.execute(SCHEMA)


def upsert_securities(conn: psycopg.Connection, securities: Iterable[Security]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO security_master (security_id, name, currency, asset_class)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (security_id) DO UPDATE
               SET name = EXCLUDED.name, currency = EXCLUDED.currency, asset_class = EXCLUDED.asset_class
            """,
            [(s.security_id, s.name, s.currency, s.asset_class) for s in securities],
        )


def prior_quantities(conn: psycopg.Connection, as_of: dt.date) -> Dict[PositionKey, Decimal]:
    """Quantities from the most recent loaded date before `as_of`: the roll-forward starting point."""
    rows = conn.execute(
        """
        SELECT portfolio_id, security_id, quantity
          FROM positions
         WHERE as_of_date = (SELECT max(as_of_date) FROM positions WHERE as_of_date < %s)
        """,
        (as_of,),
    ).fetchall()
    return {(portfolio_id, security_id): quantity for portfolio_id, security_id, quantity in rows}


def replace_day(conn: psycopg.Connection, as_of: dt.date, result: TransformResult) -> None:
    conn.execute("DELETE FROM positions WHERE as_of_date = %s", (as_of,))
    conn.execute("DELETE FROM etl_rejects WHERE as_of_date = %s", (as_of,))
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO positions (as_of_date, portfolio_id, security_id, quantity, currency,
                                   price_local, fx_rate_usd, market_value_usd)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                (p.as_of_date, p.portfolio_id, p.security_id, p.quantity, p.currency,
                 p.price_local, p.fx_rate_usd, p.market_value_usd)
                for p in result.positions
            ],
        )
        cur.executemany(
            "INSERT INTO etl_rejects (as_of_date, source_file, record_ref, reason) VALUES (%s, %s, %s, %s)",
            [(as_of, r.source_file, r.record_ref, r.reason) for r in result.rejects],
        )


def record_run(conn: psycopg.Connection, as_of: dt.date, source_trade_rows: int, result: TransformResult) -> int:
    row = conn.execute(
        """
        INSERT INTO etl_runs (as_of_date, source_trade_rows, applied_trades, cancelled_trades,
                              rejected_trades, loaded_positions)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING run_id
        """,
        (as_of, source_trade_rows, result.applied_trades, result.cancelled_trades,
         result.rejected_trades, len(result.positions)),
    ).fetchone()
    return row[0]
