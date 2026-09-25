#!/usr/bin/env python3
"""One-time port of KBO-Draft-Room 1.0.1 `src/core/*.js` into ES modules under `src/draftroom/`.

Draft Room modules are IIFEs that register `window.DraftXxx` and fall back to `require()` in Node.
This rewrites only that wrapper; the code inside is copied unchanged, so the simulation stays
identical (checked by tests/draftroom-parity.test.ts against Draft Room's golden hashes).

Usage: python3 scripts/port-draftroom.py /path/to/KBO-Draft-Room
The source checkout must be at the commit recorded in docs/UPSTREAM.md.
"""
import pathlib
import re
import sys

UPSTREAM_COMMIT = 'df4faaddb057b1da92d8762976fdb5a545bb4460'
DEST = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'draftroom'

DEP = re.compile(
    r"root\.(Draft\w+)\s*\|\|\s*\(typeof require !== 'undefined' \? require\('\./([\w-]+)\.js'\) : null\)"
)
NEED = re.compile(r"need\('(Draft\w+)',\s*'\./([\w-]+)\.js'\)")
EXPORT = re.compile(r"root\.Draft\w+\s*=\s*")
CJS = re.compile(r"\s*if\s*\(typeof module\s*!==\s*'undefined'\s*&&\s*module\.exports\)\s*module\.exports\s*=\s*[\w.]+;")
OPEN = re.compile(r"^\(function\s*\(root\)\s*\{\s*$")
CLOSE = re.compile(r"^\}\)\(typeof window\s*!==\s*'undefined'\s*\?\s*window\s*:\s*globalThis\);\s*$")


def port(src: pathlib.Path) -> str:
    lines = src.read_text(encoding='utf-8').split('\n')
    start = next(i for i, l in enumerate(lines) if OPEN.match(l))
    end = max(i for i, l in enumerate(lines) if CLOSE.match(l))
    header, body = lines[:start], lines[start + 1:end]

    imports: dict[str, str] = {}

    def dep(m: re.Match) -> str:
        imports[m.group(1)] = m.group(2)
        return m.group(1)

    out = []
    for line in body:
        if line.strip() in ("'use strict';", '"use strict";'):
            continue
        if re.match(r"\s*const need = \(name, file\) =>", line):
            continue
        line = DEP.sub(dep, line)
        line = NEED.sub(dep, line)
        line = CJS.sub('', line)
        # Every module assigns its public API to `root.DraftXxx` exactly once, as a statement.
        line = EXPORT.sub('export default ', line)
        if line.strip() == '':
            out.append('')
            continue
        out.append(line[2:] if line.startswith('  ') else line)

    text = '\n'.join(out).strip('\n')
    if re.search(r'\broot\b|\brequire\(|module\.exports', text):
        raise SystemExit(f'{src.name}: wrapper references left after conversion')
    if text.count('export default') != 1:
        raise SystemExit(f'{src.name}: expected exactly one export')
    head = '\n'.join(header).rstrip()
    note = f'// Ported from KBO-Draft-Room {UPSTREAM_COMMIT[:7]} src/core/{src.name}. See docs/UPSTREAM.md.'
    imp = ''.join(f"import {name} from './{file}.js';\n" for name, file in imports.items())
    return f'{head}\n{note}\n{imp}\n{text}\n'


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    core = pathlib.Path(sys.argv[1]) / 'src' / 'core'
    DEST.mkdir(parents=True, exist_ok=True)
    for src in sorted(core.glob('*.js')):
        (DEST / src.name).write_text(port(src), encoding='utf-8')
        print(f'ported {src.name}')


if __name__ == '__main__':
    main()
