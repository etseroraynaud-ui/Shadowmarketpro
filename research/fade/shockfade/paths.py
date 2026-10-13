"""Chemins du projet. Les données brutes et dérivées restent hors git (research/data/binance/ est ignoré)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
FADE = ROOT / 'research' / 'fade'
DATA = ROOT / 'research' / 'data' / 'binance' / 'fade'
RAW = DATA / 'raw'
DERIVED = DATA / 'derived'
REPORTS = ROOT / 'research' / 'reports' / 'shock-fade'
FUNDING = ROOT / 'research' / 'data' / 'funding'
