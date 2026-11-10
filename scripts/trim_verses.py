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
    ("esv", "The Sabbath was made for man", "not man for the Sabbath", "."),
    ("esv", "So when the woman saw", "of its fruit and ate", "."),  # 11 tenth
    ("esv", "For I would not have known what it is to covet", "You shall not covet", "."),  # 11 tenth
    ("esv", "I have learned, in whatever", "to be content", "."),  # 11 tenth
    ("esv", "You shall not bow down to them", "or serve them", "."),  # 03 second
    ("esv", "He prays to it and says", "you are my god", "!"),  # 03 second
    ("esv", "And if you do not do well, sin is crouching", "rule over it", "."),  # 07 sixth
    ("esv", "The voice of your brother", "from the ground", "."),  # 07 sixth
    ("esv", "God made man in", "his own image", "."),  # 07 sixth
    ("esv", "But I say to you that everyone who is angry", "liable to judgment", "."),  # 07 sixth
    ("esv", "I coveted them and took them", "with the silver underneath", "."),  # 09 eighth
    ("esv", "Only on the evidence of two witnesses", "shall a charge be established", "."),  # 10 ninth
    ("esv", "And the worthless men brought a charge", "cursed God and the king", "."),  # 10 ninth
    ("esv", "Rather, speaking the truth in love", "into Christ", "."),  # 10 ninth
    ("esv", "You shall leave them for the poor", "I am the LORD your God", "."),  # 09 eighth
    ("esv", "Behold, Lord, the half of my goods", "I restore it fourfold", "."),  # 09 eighth
    ("esv", "Therefore a man shall leave his father", "hold fast to his wife", "."),  # 08 seventh
    ("esv", "Know therefore that the LORD your God is God", "keeps covenant and steadfast love", "."),  # 08 seventh
    ("esv", "Neither do I condemn you", "sin no more", "."),  # 08 seventh
    ("esv", "I AM WHO", " I AM.", ""),  # 04 third: keeps "I AM WHO I AM."
    ("esv", "This is my name forever", "throughout all generations", "."),  # 04 third
    ("esv", "Our Father in heaven", "hallowed be your name", "."),  # 04 third
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
