"""Fill {{ESV <reference>}} placeholders in a script with text from the ESV API.

    set ESV_API_KEY=<your key from api.esv.org>
    python scripts/fill_esv.py scripts/ten-commandments-1-no-other-gods.md

Writes <name>.esv.md next to the input. Use --list to print the references
without calling the API. --kjv fills the same placeholders with the King James
Version (public domain, from bible-api.com) into <name>.kjv.md, for when there is
no working ESV key. --bg fills the ESV from Bible Gateway's ESV passage page
instead of the API (no key needed); check long verses word for word after. The filled files are git-ignored: they hold ESV text,
which is under copyright to Crossway, so check Crossway's and the API's terms
before publishing them anywhere.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

PLACEHOLDER = re.compile(r"\{\{ESV ([^}]+)\}\}")
API = "https://api.esv.org/v3/passage/text/"
PARAMS = {
    "include-passage-references": "false",
    "include-verse-numbers": "false",
    "include-first-verse-numbers": "false",
    "include-footnotes": "false",
    "include-footnote-body": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-selahs": "false",
    "indent-poetry": "false",
    "indent-paragraphs": "0",
}


def read_env_file() -> dict[str, str]:
    """KEY=value lines from .env at the repo root (git-ignored), so the key needs no app restart."""
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.exists():
        return {}
    pairs = (line.split("=", 1) for line in path.read_text(encoding="utf-8").splitlines() if "=" in line and not line.lstrip().startswith("#"))
    return {k.strip(): v.strip() for k, v in pairs}


def fetch(ref: str, key: str) -> str:
    url = API + "?" + urllib.parse.urlencode({"q": ref, **PARAMS})
    headers = {"Authorization": f"Token {key}"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.URLError as err:
        # Some Windows Python installs have a stale certificate store; curl uses the system one.
        if "CERTIFICATE" not in str(err).upper():
            raise
        body = subprocess.run(
            ["curl", "-sf", "-H", f"Authorization: Token {key}", url],
            check=True, capture_output=True, text=True, encoding="utf-8",
        ).stdout
    passages = json.loads(body).get("passages") or []
    if not passages:
        raise ValueError(f"ESV API returned no text for {ref!r}")
    return " ".join(passages[0].split())


def fetch_kjv(ref: str) -> str:
    """Public-domain KJV text for a reference, from bible-api.com."""
    url = "https://bible-api.com/" + urllib.parse.quote(ref) + "?translation=kjv"
    body = subprocess.run(["curl", "-sf", url], check=True, capture_output=True, text=True, encoding="utf-8").stdout
    text = json.loads(body).get("text", "")
    if not text.strip():
        raise ValueError(f"bible-api.com returned no text for {ref!r}")
    return " ".join(text.split())


def fetch_bg(ref: str) -> str:
    """ESV text for a reference from Bible Gateway's passage page (no key). Small caps (LORD) kept."""
    from html.parser import HTMLParser
    url = "https://www.biblegateway.com/passage/?" + urllib.parse.urlencode({"search": ref, "version": "ESV"})
    page = subprocess.run(["curl", "-sfL", "-A", "Mozilla/5.0", url], check=True, capture_output=True).stdout.decode("utf-8")
    start = page.find('class="passage-text"')
    end = page.find('class="footnotes"', start)
    page = page[start:end if end > 0 else None]

    class Parser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.stack, self.skip, self.caps, self.verse, self.parts = [], 0, 0, None, {}

        def handle_starttag(self, tag, attrs):
            cls = dict(attrs).get("class") or ""
            skip = (tag == "sup" and ("footnote" in cls or "crossreference" in cls or "versenum" in cls)) \
                or tag in ("h3", "h4") or "chapternum" in cls
            caps = "small-caps" in cls
            if tag in ("br", "img", "hr", "input", "meta", "link"):
                if tag == "br" and self.verse:
                    self.parts[self.verse].append(" ")  # poetry line break
                return
            m = re.search(r"(?:^| )text ([1-3]?[A-Za-z]+-\d+-\d+)", cls) if tag == "span" else None
            self.stack.append((tag, skip, caps, bool(m)))
            self.skip += skip
            self.caps += caps
            if m:
                self.verse = m.group(1)
                self.parts.setdefault(self.verse, []).append(" ")  # each poetry line is its own span

        def handle_endtag(self, tag):
            while self.stack:
                t, skip, caps, verse = self.stack.pop()
                self.skip -= skip
                self.caps -= caps
                if verse:
                    self.verse = None
                if t == tag:
                    break

        def handle_data(self, data):
            if self.verse and not self.skip:
                self.parts[self.verse].append(data.upper() if self.caps else data)

    parser = Parser()
    parser.feed(page)
    text = " ".join("".join(v) for v in parser.parts.values())
    text = " ".join(text.split())
    if not text:
        raise ValueError(f"Bible Gateway returned no text for {ref!r}")
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("script", type=Path)
    parser.add_argument("--list", action="store_true", help="Print the references and stop.")
    parser.add_argument("--bg", action="store_true", help="Fill the ESV from Bible Gateway's page (no key needed).")
    parser.add_argument("--kjv", action="store_true", help="Fill with the public-domain KJV instead (no key needed).")
    args = parser.parse_args()

    source = args.script.read_text(encoding="utf-8")
    refs = list(dict.fromkeys(m.strip() for m in PLACEHOLDER.findall(source)))
    if args.list:
        print("\n".join(refs))
        print(f"{len(refs)} references", file=sys.stderr)
        return 0

    if args.kjv:
        texts = {ref: fetch_kjv(ref) for ref in refs}
        filled = PLACEHOLDER.sub(lambda m: f"“{texts[m.group(1).strip()]}”", source)
        filled += "\n\n---\n\nScripture quotations are from the King James Version (public domain).\n"
        out = args.script.with_suffix(".kjv.md")
        out.write_text(filled, encoding="utf-8")
        print(f"Filled {len(refs)} references (KJV) into {out}")
        return 0

    if args.bg:
        texts = {ref: fetch_bg(ref) for ref in refs}
    else:
        key = read_env_file().get("ESV_API_KEY") or os.environ.get("ESV_API_KEY")  # .env wins over a stale system variable
        if not key:
            print("Set ESV_API_KEY, or add ESV_API_KEY=<key> to .env at the repo root (or use --bg).", file=sys.stderr)
            return 1
        key = key.strip().strip('"').strip("'")
        texts = {ref: fetch(ref, key) for ref in refs}
    filled = PLACEHOLDER.sub(lambda m: f"“{texts[m.group(1).strip()]}”", source)
    filled += (
        "\n\n---\n\nScripture quotations are from the ESV® Bible (The Holy Bible, English Standard "
        "Version®), © 2001 by Crossway. Check esv.org for the current required notice wording.\n"
    )
    out = args.script.with_suffix(".esv.md")
    out.write_text(filled, encoding="utf-8")
    print(f"Filled {len(refs)} references into {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
