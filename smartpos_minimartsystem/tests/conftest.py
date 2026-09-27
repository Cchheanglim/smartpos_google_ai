"""Shared pytest fixtures. No MySQL server is needed for this suite."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from app.config import TestConfig  # noqa: E402


@pytest.fixture
def app():
    return create_app(TestConfig)


@pytest.fixture
def client(app):
    return app.test_client()
