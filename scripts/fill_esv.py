"""Fill {{ESV <reference>}} placeholders in a script with text from the ESV API.

    set ESV_API_KEY=<your key from api.esv.org>
    python scripts/fill_esv.py scripts/ten-commandments-1-no-other-gods.md

Writes <name>.esv.md next to the input. Use --list to print the references
without calling the API. The filled files are git-ignored: they hold ESV text,
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("script", type=Path)
    parser.add_argument("--list", action="store_true", help="Print the references and stop.")
    args = parser.parse_args()

    source = args.script.read_text(encoding="utf-8")
    refs = list(dict.fromkeys(m.strip() for m in PLACEHOLDER.findall(source)))
    if args.list:
        print("\n".join(refs))
        print(f"{len(refs)} references", file=sys.stderr)
        return 0

    key = os.environ.get("ESV_API_KEY") or read_env_file().get("ESV_API_KEY")
    if not key:
        print("Set ESV_API_KEY, or add ESV_API_KEY=<key> to .env at the repo root.", file=sys.stderr)
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
