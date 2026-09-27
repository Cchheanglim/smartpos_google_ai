"""
Minimal, dependency-free Excel (.xlsx) writer.

An .xlsx file is a zip of XML parts (Office Open XML). This class writes
just enough of the format — inline strings, numbers, a bold header row and
frozen header — for sales ledgers and inventory summaries to open cleanly
in Excel, LibreOffice and Google Sheets.
"""
import io
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable
from xml.sax.saxutils import escape


def _column_letter(index: int) -> str:
    """0 → A, 25 → Z, 26 → AA."""
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


@dataclass
class _Sheet:
    name: str
    headers: list[str]
    rows: list[list[Any]] = field(default_factory=list)


class XlsxWorkbook:
    """Collect one or more sheets, then call ``to_bytes()``."""

    MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    def __init__(self) -> None:
        self._sheets: list[_Sheet] = []

    def add_sheet(self, name: str, headers: list[str], rows: Iterable[Iterable[Any]]) -> "XlsxWorkbook":
        safe = "".join(ch for ch in name if ch not in "[]:*?/\\")[:31] or f"Sheet{len(self._sheets) + 1}"
        self._sheets.append(_Sheet(safe, list(headers), [list(r) for r in rows]))
        return self

    def __len__(self) -> int:
        return len(self._sheets)

    # ---- XML parts ----
    @staticmethod
    def _cell(ref: str, value: Any, style: int = 0) -> str:
        s = f' s="{style}"' if style else ""
        if value is None or value == "":
            return f'<c r="{ref}"{s}/>'
        if isinstance(value, bool):
            return f'<c r="{ref}" t="b"{s}><v>{int(value)}</v></c>'
        if isinstance(value, (int, float, Decimal)):
            return f'<c r="{ref}"{s}><v>{value}</v></c>'
        if isinstance(value, datetime):
            value = value.strftime("%Y-%m-%d %H:%M")
        elif isinstance(value, date):
            value = value.isoformat()
        return f'<c r="{ref}" t="inlineStr"{s}><is><t xml:space="preserve">{escape(str(value))}</t></is></c>'

    def _sheet_xml(self, sheet: _Sheet) -> str:
        rows = ['<row r="1">' + "".join(self._cell(f"{_column_letter(i)}1", h, 1)
                                        for i, h in enumerate(sheet.headers)) + "</row>"]
        for r, values in enumerate(sheet.rows, start=2):
            rows.append(f'<row r="{r}">' + "".join(self._cell(f"{_column_letter(i)}{r}", v)
                                                     for i, v in enumerate(values)) + "</row>")
        widths = "".join(f'<col min="{i + 1}" max="{i + 1}" width="{max(10, min(40, len(str(h)) + 6))}" '
                         f'customWidth="1"/>' for i, h in enumerate(sheet.headers))
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
                'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
                f'<cols>{widths}</cols><sheetData>{"".join(rows)}</sheetData></worksheet>')

    def to_bytes(self) -> bytes:
        if not self._sheets:
            raise ValueError("The workbook has no sheets.")
        n = len(self._sheets)
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/styles.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            + "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/'
                      f'vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, n + 1))
            + "</Types>")
        root_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                     '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                     '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
                     'relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        workbook = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                    + "".join(f'<sheet name="{escape(s.name)}" sheetId="{i}" r:id="rId{i}"/>'
                              for i, s in enumerate(self._sheets, start=1))
                    + "</sheets></workbook>")
        wb_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/'
                             f'2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
                             for i in range(1, n + 1))
                   + f'<Relationship Id="rId{n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
                     'relationships/styles" Target="styles.xml"/></Relationships>')
        styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
                  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>'
                  '<fills count="3"><fill><patternFill patternType="none"/></fill>'
                  '<fill><patternFill patternType="gray125"/></fill>'
                  '<fill><patternFill patternType="solid"><fgColor rgb="FF6D28D9"/></patternFill></fill></fills>'
                  '<borders count="1"><border/></borders>'
                  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
                  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
                  '</cellXfs></styleSheet>')
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", content_types)
            z.writestr("_rels/.rels", root_rels)
            z.writestr("xl/workbook.xml", workbook)
            z.writestr("xl/_rels/workbook.xml.rels", wb_rels)
            z.writestr("xl/styles.xml", styles)
            for i, sheet in enumerate(self._sheets, start=1):
                z.writestr(f"xl/worksheets/sheet{i}.xml", self._sheet_xml(sheet))
        return buffer.getvalue()
