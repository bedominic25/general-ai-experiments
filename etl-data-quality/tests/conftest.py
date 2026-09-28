"""Shared fixtures.

Integration tests get a throwaway database created for the test session (and dropped
afterwards), plus a clean schema for every test, so tests never depend on each other
or on whatever is already in the database DATABASE_URL points at.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo

from etl_dq import db as etl_db
from etl_dq import load, pipeline

SAMPLE_DIR = Path(__file__).resolve().parents[1] / "data" / "sample"


def pytest_collection_modifyitems(items):
    for item in items:
        marker = "integration" if "integration" in item.path.parts else "unit"
        item.add_marker(getattr(pytest.mark, marker))


@pytest.fixture(scope="session")
def database_url():
    admin_url = etl_db.database_url()
    name = f"etl_dq_test_{uuid.uuid4().hex[:8]}"
    try:
        admin = psycopg.connect(admin_url, autocommit=True)
    except psycopg.OperationalError as e:
        pytest.fail(f"Cannot reach PostgreSQL via DATABASE_URL ({admin_url}): {e}", pytrace=False)
    with admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    yield make_conninfo(admin_url, dbname=name)
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))


@pytest.fixture
def db(database_url):
    with etl_db.connect(database_url) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
        load.create_schema(conn)
        yield conn


@pytest.fixture
def data_dir(tmp_path):
    """A private copy of the sample data that a test can corrupt without affecting others."""
    return Path(shutil.copytree(SAMPLE_DIR, tmp_path / "data"))


@pytest.fixture
def run_day(db):
    def _run(as_of, data_dir=SAMPLE_DIR):
        return pipeline.run(db, data_dir, as_of)

    return _run


@pytest.fixture
def write_csv(tmp_path):
    """Write a CSV to tmp_path. `bom`/`newline` reproduce files exported by Excel on Windows."""

    def _write(name, header, rows, *, bom=False, newline="\n"):
        path = tmp_path / name
        lines = [",".join(header)] + [",".join(str(v) for v in row) for row in rows]
        text = ("﻿" if bom else "") + newline.join(lines) + newline
        path.write_bytes(text.encode("utf-8"))
        return path

    return _write
