"""Journal des essais (protocole § 10) : une ligne par exécution sur données réelles."""
from __future__ import annotations

import subprocess
from datetime import datetime, timezone

from .paths import REPORTS, ROOT


def log(script: str, config: str, periods: str) -> None:
    try:
        commit = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', '--short', 'HEAD'], text=True).strip()
        dirty = bool(subprocess.check_output(['git', '-C', str(ROOT), 'status', '--porcelain', '--', 'research/fade'], text=True).strip())
        commit += '+modif' if dirty else ''
    except Exception:
        commit = '?'
    now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
    with open(REPORTS / 'trial-log.md', 'a') as f:
        f.write(f'| {now} | {commit} | `{script}` | {config} | {periods} |\n')
