"""Build CSV text from rows without touching the database."""
import csv
import io
from typing import Iterable, Sequence


def to_csv(headers: Sequence[str], rows: Iterable[Sequence]) -> str:
    """Return CSV text with a header row followed by ``rows``."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()
