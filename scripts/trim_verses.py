"""Trim partial verses in a filled script (the fill tools insert whole verses).

    python scripts/trim_verses.py scripts/02-the-first-commandment.kjv.md

Each rule keeps the part of a verse that starts at `start` and ends at `end`
(inclusive), then ends it with `close`. Rules are per translation, keyed by a
phrase that only that verse contains; a rule whose verse isn't found is skipped.
"""
import re
import sys
from pathlib import Path

RULES = [
    # (translation, start, end, close)
    ("kjv", "Thus the LORD saved Israel", "hand of the Egyptians", "."),
    ("kjv", "These be thy gods", "land of Egypt", "."),
    ("kjv", "Thou shalt love the Lord thy God", "with all thy mind", "."),
    ("esv", "Thus the LORD saved Israel", "hand of the Egyptians", "."),
    ("esv", "These are your gods", "land of Egypt", "!"),
    ("esv", "You shall love the Lord your God", "with all your mind", "."),
]


def main() -> int:
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")
    tr = "kjv" if ".kjv." in path.name else "esv"
    for rule_tr, start, end, close in RULES:
        if rule_tr != tr:
            continue
        # A filled verse is one “...” run; replace the whole quote with the kept part.
        pattern = re.compile(r"“[^”]*?" + re.escape(start) + r".*?" + re.escape(end) + r"[^”]*”")
        text, n = pattern.subn(lambda m: "“" + m.group(0)[m.group(0).index(start):m.group(0).index(end) + len(end)] + close + "”", text)
        print(f"{start!r}: {n} trimmed")
    path.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
