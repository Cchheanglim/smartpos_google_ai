"""
A minimal Code 39 barcode renderer (inline SVG, no external dependencies).

Code 39 encodes digits, uppercase letters and a few symbols as 9 bars per
character (5 narrow + wide combinations); each character is separated by a
narrow gap. Good enough for shelf labels and receipts printed from this app.
"""
from xml.sax.saxutils import escape

_PATTERNS = {
    "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
    "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
    "A": "wnnnnwnnw", "B": "nnwnnwnnw", "C": "wnwnnwnnn", "D": "nnnnwwnnw", "E": "wnnnwwnnn",
    "F": "nnwnwwnnn", "G": "nnnnnwwnw", "H": "wnnnnwwnn", "I": "nnwnnwwnn", "J": "nnnnwwwnn",
    "K": "wnnnnnnww", "L": "nnwnnnnww", "M": "wnwnnnnwn", "N": "nnnnwnnww", "O": "wnnnwnnwn",
    "P": "nnwnwnnwn", "Q": "nnnnnnwww", "R": "wnnnnnwwn", "S": "nnwnnnwwn", "T": "nnnnwnwwn",
    "U": "wwnnnnnnw", "V": "nwwnnnnnw", "W": "wwwnnnnnn", "X": "nwnnwnnnw", "Y": "wwnnwnnnn",
    "Z": "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
}
NARROW, WIDE, GAP = 2, 5, 2


def _char_width(pattern: str) -> int:
    return sum(WIDE if ch == "w" else NARROW for ch in pattern) + GAP


def code39_svg(value: str, height: int = 60, show_text: bool = True) -> str:
    """Render ``value`` (letters, digits, space, ``- . *``) as an SVG barcode."""
    text = value.strip().upper()
    chars = [ch for ch in text if ch in _PATTERNS] or ["0"]
    payload = ["*"] + chars + ["*"]
    total_width = sum(_char_width(_PATTERNS[c]) for c in payload)
    bars, x = [], 0
    for ch in payload:
        black = True
        for stroke in _PATTERNS[ch]:
            width = WIDE if stroke == "w" else NARROW
            if black:
                bars.append(f'<rect x="{x}" y="0" width="{width}" height="{height}" fill="currentColor"/>')
            x += width
            black = not black
        x += GAP
    label = (f'<text x="{total_width / 2}" y="{height + 16}" text-anchor="middle" '
             f'font-family="monospace" font-size="13" fill="currentColor">{escape(text)}</text>' if show_text else "")
    return (f'<svg viewBox="0 0 {total_width} {height + (20 if show_text else 0)}" '
            f'xmlns="http://www.w3.org/2000/svg" class="barcode">{"".join(bars)}{label}</svg>')
