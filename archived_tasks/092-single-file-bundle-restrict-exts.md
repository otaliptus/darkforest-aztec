# Ticket 092 - Restrict single-file bundle extensions

## Goal
Regenerate `llm_bundle.txt` so it only includes specific file extensions requested for LLM review.

## Acceptance Criteria
- `llm_bundle.txt` contains only files with these extensions: `.nr`, `.ts`, `.js`, `.md`, `.html`, `.toml`, `.yaml`, `.sh`, `.txt`.
- Exclude `apps/client-og`, `reference`, and generated/build output directories (e.g., `node_modules`, `dist`, `target`, `build`, `out`, `coverage`).
- Include clear per-file delimiters with repo-relative paths.
- Document the generation command in this ticket.

## Out of Scope
- Changes to application code.
- Inclusion of binary assets or other extensions.

## Deliverables
- Updated `llm_bundle.txt` bundle file.

## Tests / Commands
- Generate bundle:
```sh
python3 - <<'PY'
from pathlib import Path
import os

root = Path('.').resolve()
output = root / 'llm_bundle.txt'

allowed_exts = {
    '.nr', '.ts', '.js', '.md', '.html', '.toml', '.yaml', '.sh', '.txt'
}

exclude_dir_names = {
    '.git', 'node_modules', 'dist', 'build', 'out', 'target', 'coverage',
    '.next', '.turbo', '.cache', 'cache', 'artifacts', 'tmp', 'temp', 'logs',
    'reference', 'client-og'
}

files = []
for dirpath, dirnames, filenames in os.walk(root):
    dirpath_p = Path(dirpath)
    rel_dir = dirpath_p.relative_to(root)
    if rel_dir.parts and any(part in exclude_dir_names for part in rel_dir.parts):
        dirnames[:] = []
        continue

    dirnames[:] = [d for d in dirnames if d not in exclude_dir_names]

    for name in filenames:
        path = dirpath_p / name
        if path == output:
            continue
        if path.suffix.lower() in allowed_exts:
            files.append(path)

files.sort(key=lambda p: p.as_posix())

header_lines = [
    'Repo bundle for LLM review',
    'Generated: 2026-01-09',
    'Excluded dirs: ' + ', '.join(sorted(exclude_dir_names)),
    'Included extensions: ' + ', '.join(sorted(allowed_exts)),
]

with output.open('w', encoding='utf-8') as out:
    out.write('\\n'.join(header_lines))
    out.write('\\n')
    for path in files:
        rel = path.relative_to(root).as_posix()
        out.write('\\n===== FILE: ' + rel + ' =====\\n')
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            text = path.read_text(encoding='utf-8', errors='replace')
        out.write(text)
        if not text.endswith('\\n'):
            out.write('\\n')

print(f\"Wrote {output} with {len(files)} files\")
PY
```

## Status
- Done (2026-01-09)
