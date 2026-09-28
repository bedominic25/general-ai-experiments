from __future__ import annotations

import os
from typing import Optional

import psycopg

DEFAULT_URL = "postgresql://localhost/postgres"


def database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_URL)


def connect(url: Optional[str] = None) -> psycopg.Connection:
    # Autocommit, so transactions are only the explicit `conn.transaction()` blocks.
    return psycopg.connect(url or database_url(), autocommit=True)
