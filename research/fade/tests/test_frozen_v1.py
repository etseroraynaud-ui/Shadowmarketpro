"""Shock Engine V1 n'est pas modifié par ce projet (protocole § 0)."""
import hashlib
import re

from shockfade.paths import ROOT

EXTRA = ['research/lib/frozen-shock.ts', 'research/lib/e2.ts', 'research/lib/calm-only.ts']


def _sha(rel: str) -> str:
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def test_v1_fingerprints_unchanged():
    text = (ROOT / 'research/preregistration/e2-forward.md').read_text()
    rows = re.findall(r'\| `([^`]+)` \| `([0-9a-f]{64})` \|', text)
    assert len(rows) >= 9
    for rel, sha in rows:
        assert _sha(rel) == sha, rel


def test_shockfade_does_not_read_v1():
    """Aucun littéral de code (docstrings exclues) ne désigne un fichier de V1, du bot ou du site."""
    import ast
    for p in (ROOT / 'research/fade/shockfade').glob('*.py'):
        tree = ast.parse(p.read_text())
        docs = {id(n.body[0].value) for n in ast.walk(tree)
                if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)) and n.body
                and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant)}
        for n in ast.walk(tree):
            if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in docs:
                for bad in ('lib/strategies', 'frozen-shock', 'bot/', 'app/'):
                    assert bad not in n.value, (p.name, n.value)
