"""Correctifs Hummingbot pour le bot Shock Engine, chargés au démarrage de Python.

Monté dans le conteneur Hummingbot API (PYTHONPATH), il ne modifie aucun fichier de l'image.
Le connecteur Hyperliquid perpétuel est corrigé au moment où il est importé :

1. Marchés HIP-3 désactivés par défaut. Le bot trade BTC (marché principal) ; charger les
   marchés HIP-3 demande une requête par dex, soit plus de 250 sur le testnet, d'où des refus
   « 429 » de Hyperliquid. SHOCK_HB_HIP3=1 les réactive (actions xyz:NVDA, par exemple).
2. Noms de marché HIP-3 invalides ignorés. Le testnet contient des marchés de test nommés
   « tndex:A B:C » ; le connecteur découpe chaque nom en exactement deux morceaux sur « : » et
   s'arrête sur ceux-là (« too many values to unpack »), ce qui empêche d'enregistrer le compte.
"""

import importlib.abc
import importlib.machinery
import os
import sys

_TARGET = "hummingbot.connector.derivative.hyperliquid_perpetual.hyperliquid_perpetual_derivative"


def _patch(module):
    cls = module.HyperliquidPerpetualDerivative
    if getattr(cls, "_shock_patched", False):
        return
    init = cls.__init__

    def __init__(self, *args, **kwargs):
        if os.environ.get("SHOCK_HB_HIP3", "0") != "1":
            kwargs["enable_hip3_markets"] = False
        init(self, *args, **kwargs)

    symbols = cls._initialize_trading_pair_symbols_from_exchange_info

    def _initialize_trading_pair_symbols_from_exchange_info(self, exchange_info):
        def valid(meta):
            return not isinstance(meta, dict) or meta.get("name", "").count(":") <= 1
        self._dex_markets = [
            {**dex, "perpMeta": [m for m in dex.get("perpMeta", []) if valid(m)]} if isinstance(dex, dict) else dex
            for dex in (self._dex_markets or [])
        ]
        return symbols(self, exchange_info)

    cls.__init__ = __init__
    cls._initialize_trading_pair_symbols_from_exchange_info = _initialize_trading_pair_symbols_from_exchange_info
    cls._shock_patched = True


class _Finder(importlib.abc.MetaPathFinder):
    """Applique le correctif juste après l'import du module du connecteur."""

    def find_spec(self, name, path, target=None):
        if name != _TARGET:
            return None
        spec = importlib.machinery.PathFinder.find_spec(name, path)
        if spec is None or spec.loader is None:
            return spec
        exec_module = spec.loader.exec_module

        def exec_and_patch(module):
            exec_module(module)
            _patch(module)

        spec.loader.exec_module = exec_and_patch
        return spec


if _TARGET in sys.modules:
    _patch(sys.modules[_TARGET])
else:
    sys.meta_path.insert(0, _Finder())
