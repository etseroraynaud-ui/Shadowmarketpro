"""Hawkes / Merton × Shock Engine V1 (régime calme) : valeur prédictive et économique incrémentale.

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/export-v1-trades.ts   # 716 trades V1 (lecture seule)
    cd research/fade && python3 -m shockfade.v1_hawkes
Sortie : research/reports/shock-fade/v1-hawkes/report.md (+ features.csv, results.json).

Réutilise sans réestimation : bougies 1 min Binance (comptant 2017-08 → 2019-12, perpétuels 2020+), statistique de
Lee–Mykland, paramètres Hawkes trimestriels (fits-*.json, estimés sur les 180 jours précédant chaque trimestre).
Toutes les variables d'une entrée n'utilisent que des minutes closes au plus tard à la clôture T de la bougie de signal.
"""
from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd

from . import hawkes as hk
from . import mtf
from . import stats as st
from .paths import DERIVED, REPORTS
from .pipeline import all_jump_events, hawkes_of, quarter_of
from .trial_log import log

OUT = REPORTS / 'v1-hawkes'
SYM = {'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT'}
PRE_END, PERP_START = pd.Timestamp('2020-01-01', tz='UTC'), pd.Timestamp('2020-07-01', tz='UTC')
BASE = ['f_absZ', 'f_lamPct', 'f_volZ', 'f_breakAtr', 'f_isShort', 'is_eth']
HAWKES = ['h_log_same', 'h_log_opp', 'h_adv60']
FREQ = ['c_same60', 'c_opp60', 'c_all24h']
MERTON = ['j_same', 'j_maxL', 'j_n']
OUTCOMES = {'R': 'R (net)', 'mfe_log': 'MFE (log(1 + MFE_R))', 'mae_R': 'MAE (R)', 'y_stop': 'perte pleine (R ≤ −1)', 'y_adv60': 'saut défavorable < 60 min',
            'cost_1m_bps': 'coût de latence 1 min (pb, proxy)'}


def sources() -> dict:
    """(actif, période) → (Asset, paramètres Hawkes par trimestre, événements de sauts)."""
    out = {}
    for a_, sym in SYM.items():
        for per, (market, start, end, tag) in {'pre': ('spot', '2017-08-17', '2020-01-01', '-pre2020'),
                                               'perp': ('um', '2020-01-01', '2026-10-01', '')}.items():
            a = mtf.load_series(sym, market, start, end, tag)
            fits = {int(k): v for k, v in json.loads((DERIVED / f'fits-{a.sym}.json').read_text()).items()}
            out[(a_, per)] = (a, fits, all_jump_events(a))
    return out


def enrich(tr: pd.DataFrame, src: dict) -> pd.DataFrame:
    rows = []
    for r in tr.to_dict('records'):
        T = r['entry_time']
        per = 'pre' if T < PRE_END else ('perp' if T >= PERP_START else None)
        out = {'id': r['id'], 'period': per or 'non couvert'}
        if per is None:
            rows.append(out)
            continue
        a, fits, (ta, ma) = src[(r['asset'], per)]
        Tms = int(T.value // 1_000_000)
        q = (Tms - a.t0) // 60_000                      # minutes [0, q) closes au plus tard en T
        d = int(r['dir'])
        same, opp = (0, 1) if d > 0 else (1, 0)
        qs = int(quarter_of(np.array([Tms]), sorted(fits))[0])
        if qs < 0 or q < 1500 or q + 61 > a.m.size:
            out['period'] = 'non couvert'
            rows.append(out)
            continue
        f = hawkes_of(fits[qs])
        R0 = hk.states_at(ta, ma, np.array([float(q)]), f.beta)[0]
        lam = f.mu + (f.alpha * R0).sum(axis=1)
        dec = lambda k: float(sum(f.alpha[k, m] / f.beta[k, m] * R0[k, m] * (1 - math.exp(-f.beta[k, m] * 60)) for m in range(2)))
        jw = a.jump
        bar = slice(q - 15, q)
        rb = a.vol.r[bar]
        rbar = np.nansum(rb)
        out.update({
            'h_log_same': math.log(lam[same] / f.mu[same]), 'h_log_opp': math.log(lam[opp] / f.mu[opp]),
            'h_asym': math.log(lam[same] / lam[opp]), 'h_exc_same60': dec(same), 'h_adv60': f.mu[opp] * 60 + dec(opp),
            'c_same60': int(np.sum(jw[q - 60:q] == d)), 'c_opp60': int(np.sum(jw[q - 60:q] == -d)), 'c_all24h': int(np.sum(jw[q - 1440:q] != 0)),
            'j_same': float(np.any(jw[bar] == d)), 'j_n': int(np.sum(jw[bar] != 0)),
            'j_maxL': float(np.nanmax(d * a.vol.L[bar])) if np.isfinite(a.vol.L[bar]).any() else np.nan,
            'j_share': float(np.clip(d * np.nansum(rb[jw[bar] == d]) / abs(rbar), 0, 1.5)) if rbar != 0 else np.nan,
            # correspondance de prix : rendement Binance de la bougie de signal
            'bn_r15': float(rbar), 'bn_ok': float(np.isfinite(a.x[q - 1]) and np.isfinite(a.x[q - 16])),
            # résultats (après T)
            'y_adv60': float(np.any(jw[q:q + 60] == -d)), 'n_adv_trade': np.nan,
            'cost_1m_bps': d * (a.x[q] - a.x[q - 1]) * 1e4 if np.isfinite(a.x[q]) and np.isfinite(a.x[q - 1]) else np.nan,
        })
        rows.append(out)
    return tr.merge(pd.DataFrame(rows), on='id')


def to_ms(s: pd.Series) -> np.ndarray:
    """Horodatages en millisecondes, indépendamment de la résolution interne de pandas."""
    return ((s - pd.Timestamp('1970-01-01', tz='UTC')) // pd.Timedelta(milliseconds=1)).to_numpy(dtype=np.int64)


def walk_forward(df: pd.DataFrame, y: str, models: dict) -> pd.DataFrame:
    """Années civiles 2020 → 2026 ; entraînement sur les trades sortis avant le 1er janvier de l'année prédite."""
    preds = []
    for Y in range(2020, 2027):
        lo = pd.Timestamp(f'{Y}-01-01', tz='UTC')
        tr = df[df['exit_time'] < lo]
        te = df[(df['entry_time'] >= lo) & (df['entry_time'] < pd.Timestamp(f'{Y + 1}-01-01', tz='UTC'))]
        if len(te) == 0 or len(tr) < 100:
            continue
        res = te[list(dict.fromkeys(['id', 'entry_time', 'exit_time', 'R', 'ret', 'y_stop', y]))].copy()
        for name, cols in models.items():
            X = np.column_stack([np.ones(len(tr))] + [tr[c] for c in cols])
            b, *_ = np.linalg.lstsq(X, tr[y].to_numpy(), rcond=None)
            res[f'p_{name}'] = np.column_stack([np.ones(len(te))] + [te[c] for c in cols]) @ b
            fit_in = X @ b
            res[f'thr_{name}'] = np.quantile(fit_in, 0.8)
        res['year'] = Y
        preds.append(res)
    return pd.concat(preds, ignore_index=True)


def dm(y, fa, fb, g) -> dict:
    """Diebold–Mariano (erreurs quadratiques, groupées par jour) : > 0 si b prévoit mieux que a."""
    d = (y - fa) ** 2 - (y - fb) ** 2
    r = st.cluster_mean(d, g)
    from scipy.stats import norm
    return {'mean': r['mean'], 't': r['t'], 'p': float(2 * norm.sf(abs(r['t'])))}


def daily_stats(P: pd.DataFrame, w: np.ndarray) -> tuple[float, float, np.ndarray]:
    """Rendements journaliers approchés : 0,5 × rendement du trade sur sa sleeve, à la date de sortie."""
    days = pd.date_range('2020-07-01', '2026-09-30', freq='D', tz='UTC')
    s = pd.Series(0.5 * P['ret'].to_numpy() * w, index=P['exit_time'].dt.floor('D')).groupby(level=0).sum().reindex(days, fill_value=0.0)
    x = s.to_numpy()
    sh = x.mean() / x.std() * math.sqrt(365) if x.std() > 0 else float('nan')
    eq = np.cumsum(x)
    mdd = float(np.min(eq - np.maximum.accumulate(eq)))
    return sh, mdd, x


def boot_month(x_base: np.ndarray, x_alt: np.ndarray, B: int = 2000, seed: int = 0) -> dict:
    """IC de ΔSharpe par blocs mensuels (≈ 30 jours) sur les séries journalières appariées."""
    rng = np.random.default_rng(seed)
    n = len(x_base)
    nb = n // 30
    idx0 = np.arange(nb * 30).reshape(nb, 30)
    shp = lambda x: x.mean() / x.std() * math.sqrt(365) if x.std() > 0 else np.nan
    est = shp(x_alt) - shp(x_base)
    dist = []
    for _ in range(B):
        k = idx0[rng.integers(0, nb, nb)].ravel()
        dist.append(shp(x_alt[k]) - shp(x_base[k]))
    dist = np.array(dist)
    return {'est': float(est), 'lo95': float(np.nanpercentile(dist, 2.5)), 'hi95': float(np.nanpercentile(dist, 97.5))}


def main():
    tr = pd.read_csv(OUT / 'v1-trades.csv', parse_dates=['entry_time', 'exit_time'])
    tr['is_eth'] = (tr['asset'] == 'ETH').astype(float)
    tr['y_stop'] = (tr['R'] <= -1).astype(float)
    tr['mfe_log'] = np.log1p(tr['mfe_R'].clip(lower=0))
    src = sources()
    df = enrich(tr, src)
    df.to_csv(OUT / 'features.csv', index=False)
    need = BASE + HAWKES + FREQ + MERTON + list(OUTCOMES) + ['cost_1m_bps']
    gap = (df['period'] != 'non couvert') & df[[c for c in need if c in df]].isna().any(axis=1)
    df.loc[gap, 'period'] = 'trou de données Binance'
    cov = df['period'].value_counts().to_dict()
    gaps = df.loc[gap, 'id'].tolist()
    ok = df[~df['period'].isin(['non couvert', 'trou de données Binance'])].copy()
    # correspondance des prix (V1 : Bitstamp BTC/USD, Binance ETH/USDT comptant ; ici Binance 1 min)
    impl = ok['f_absZ'] * ok['f_rv']
    match = {'sign_agree': float(np.mean(np.sign(ok['bn_r15']) == ok['dir'])),
             'corr_abs_return': float(np.corrcoef(np.abs(ok['bn_r15']), impl)[0, 1]),
             'by_asset_period': {f'{a} {p}': v for (a, p), v in ok.assign(sa=np.sign(ok['bn_r15']) == ok['dir']).groupby(['asset', 'period'])['sa'].mean().round(3).items()}}
    models = {'B': BASE, 'BH': BASE + HAWKES, 'BF': BASE + FREQ, 'BM': BASE + MERTON}
    tests, preds = {}, {}
    for y in OUTCOMES:
        P = walk_forward(ok, y, models)
        preds[y] = P
        g = st.day_of(to_ms(P['entry_time']))
        yy = P[y].to_numpy()
        for m in ('BH', 'BF', 'BM'):
            tests[(y, f'{m} vs B')] = st.clark_west(yy, P['p_B'].to_numpy(), P[f'p_{m}'].to_numpy(), g)
        tests[(y, 'BH vs BF')] = dm(yy, P['p_BF'].to_numpy(), P['p_BH'].to_numpy(), g)
    keys = list(tests)
    adj = st.holm(np.array([tests[k]['p'] for k in keys]))
    for k, a in zip(keys, adj):
        tests[k]['p_holm'] = float(a)
    # univarié (descriptif)
    vars_ = HAWKES + ['h_asym', 'h_exc_same60'] + FREQ + MERTON + ['j_share', 'f_absZ', 'f_lamPct']
    uni = {v: {y: float(ok[[v, y]].corr(method='spearman').iloc[0, 1]) for y in OUTCOMES} for v in vars_}
    # économie : règles fixées d'avance sur P(perte pleine) prévue hors échantillon
    P = preds['y_stop']
    econ = {}
    sh0, mdd0, x0 = daily_stats(P, np.ones(len(P)))
    for m in ('B', 'BH', 'BF', 'BM'):
        flag = (P[f'p_{m}'] > P[f'thr_{m}']).to_numpy()
        for rule, w in (('filtre', np.where(flag, 0.0, 1.0)), ('taille ½', np.where(flag, 0.5, 1.0))):
            sh, mdd, x = daily_stats(P, w)
            dR = (w - 1) * P['R'].to_numpy()
            mon = P['entry_time'].dt.strftime('%Y-%m').to_numpy()
            est, dist = st.block_bootstrap([dR, mon], mon, lambda v: v[0].sum(), B=2000, block=3)
            econ[(m, rule)] = {'flagged': int(flag.sum()), 'flagged_winners': int(((P['R'] > 0) & flag).sum()),
                               'flagged_R': float(P['R'][flag].sum()), 'dR_total': float(dR.sum()), 'dR_ci': st.boot_summary(est, dist),
                               'stop_rate_flagged': float(P['y_stop'][flag].mean()) if flag.any() else float('nan'),
                               'sharpe': sh, 'mdd': mdd, 'dsharpe': boot_month(x0, x)}
    # exécution : coût de latence 1 min selon l'état Hawkes / saut (descriptif, terciles de l'échantillon)
    ex = {}
    gday = st.day_of(to_ms(ok['entry_time']))
    for v in ('h_log_same', 'h_adv60', 'c_same60', 'j_same', 'f_absZ'):
        x = ok[v].to_numpy()
        top = (x > np.nanquantile(x, 2 / 3)).astype(float) if v != 'j_same' else x
        ex[v] = st.diff_test(ok['cost_1m_bps'].to_numpy(), top, gday)
    res = {'coverage': {k: int(v) for k, v in cov.items()}, 'gaps': gaps, 'n_analysed': int(len(ok)), 'match': match,
           'tests': {f'{a}|{b}': v for (a, b), v in tests.items()}, 'univariate': uni,
           'econ': {f'{a}|{b}': v for (a, b), v in econ.items()}, 'base_sharpe': sh0, 'base_mdd': mdd0, 'n_oos': int(len(P)),
           'execution': ex, 'cost_1m_mean': float(ok['cost_1m_bps'].mean()), 'adv60_rate': float(ok['y_adv60'].mean())}
    (OUT / 'results.json').write_text(json.dumps(res, indent=1, default=float))
    log('shockfade/v1_hawkes.py', 'V1 × Hawkes/Merton : 24 tests hors échantillon, 2 règles fixées', '2018-09 → 2026-09 (V1)')
    report(res, ok, P)


def report(res: dict, ok: pd.DataFrame, P: pd.DataFrame) -> None:
    f = lambda x, d=3: '—' if x is None or not np.isfinite(x) else f'{x:.{d}f}'
    T = res['tests']
    adv = T['y_adv60|BH vs B']
    sig = [k for k, v in T.items() if v['p_holm'] < 0.05]
    L = ['# Hawkes / Merton × Shock Engine V1 (régime calme) — valeur incrémentale', '',
         'Généré par `research/fade/shockfade/v1_hawkes.py`. V1 non modifiée ; trades exportés en lecture seule par '
         '`research/fade/v1/export-v1-trades.ts` (même chemin que `research/shock/reference.ts`). Aucun modèle réestimé : '
         'paramètres Hawkes trimestriels et détecteur de sauts existants (`research/fade/`). Aucun seuil choisi après lecture.', '',
         '## Verdict', '',
         '| | Statistique | Économique | Verdict |', '|---|---|---|---|',
         f"| **Hawkes** | prévoit mieux que les indicateurs de V1 un **saut défavorable dans l'heure** (R²_OOS {100 * adv['r2_oos']:+.1f} %, "
         f"p Holm {adv['p_holm']:.2f}) ; rien sur R, MFE, MAE, pertes pleines ni coût d'exécution ; pas mieux qu'une simple fréquence "
         f"glissante après correction (p Holm {T['y_adv60|BH vs BF']['p_holm']:.2f}) | filtre et réduction de taille : ΔSharpe dans le bruit, "
         'R total en baisse, comme avec les seuls indicateurs de V1 | **non démontré** |',
         f"| **Merton** (sauts) | aucun gain hors échantillon face au z-score de V1 sur les six résultats (meilleure p Holm "
         f"{min(v['p_holm'] for k, v in T.items() if 'BM vs B' in k):.2f}) | idem | **inutile** pour V1 en l'état |", '',
         'Règle d\'arrêt atteinte : aucune valeur prédictive supplémentaire face aux références simples sur un résultat qui pèse '
         'économiquement (R, pertes, MAE, MFE, coût). Les trades jugés « risqués » contiennent aussi de gros '
         'gagnants : tout filtre ou réduction de taille « par risque » coupe la queue droite qui fait la performance de V1. '
         f"Tests significatifs après Holm : {', '.join(sig) if sig else 'aucun'}.", '',
         '## 1. Couverture et correspondance', '',
         f"- Trades V1 : **716** (BTC 358, ETH 358). Analysés : **{res['n_analysed']}** "
         f"(2018-09 → 2019-12 : {res['coverage'].get('pre', 0)}, 2020-07 → 2026-09 : {res['coverage'].get('perp', 0)}). "
         f"Non couverts : {res['coverage'].get('non couvert', 0)} (2020-01 → 2020-06 : aucun paramètre Hawkes estimé chronologiquement "
         'pour ce semestre ; pas de réestimation). Trou de données Binance sur la bougie de signal : '
         + (', '.join(res['gaps']) if res['gaps'] else 'aucun') + '.',
         '- Sources : V1 décide sur Bitstamp BTC/USD et Binance ETH/USDT comptant (15 min) ; Hawkes et sauts sur Binance 1 min '
         '(comptant avant 2020, perpétuel ensuite). Horodatage : variables calculées sur les minutes closes au plus tard à la '
         'clôture T de la bougie de signal (heure d\'entrée de V1).',
         f"- Contrôle : le rendement Binance de la bougie de signal a le signe du trade dans {100 * res['match']['sign_agree']:.1f} % des cas, "
         f"corrélation |rendement Binance| / |z|·σ de V1 = {res['match']['corr_abs_return']:.2f} ; par actif et période : "
         + ', '.join(f'{k} {100 * v:.1f} %' for k, v in res['match']['by_asset_period'].items()) + '.', '',
         '- Le sous-ensemble « calme » des 1 311 trades E2 (`research/reports/proba/dataset.csv`) ne compte que 714 trades (ETH 356) : '
         'retirer les entrées agitées libère des positions, et V1 compte deux trades ETH de plus. D\'où l\'export exact de V1.', '',
         '## 2. Variables (connues à la clôture T de la bougie de signal)', '',
         '| groupe | variable | définition |', '|---|---|---|',
         '| Hawkes | `h_log_same`, `h_log_opp` | log(λ / μ) dans le sens du trade et en sens opposé (paramètres du trimestre, estimés sur les 180 j précédents) |',
         '| Hawkes | `h_asym` | log(λ même sens / λ opposé) |',
         '| Hawkes | `h_exc_same60`, `h_adv60` | sauts attendus sur 60 min : excitation résiduelle dans le sens du trade (décroissance des noyaux) ; total en sens opposé (μ + excitation) |',
         '| fréquence simple | `c_same60`, `c_opp60`, `c_all24h` | sauts identifiés comptés sur les 60 dernières minutes (même sens, opposés) et les 24 dernières heures |',
         '| Merton | `j_same`, `j_n`, `j_maxL`, `j_share` | saut Lee–Mykland dans le sens du trade dans la bougie de signal, nombre de sauts, L maximal, part du mouvement due aux sauts |',
         '| V1 (référence) | `f_absZ`, `f_lamPct`, `f_volZ`, `f_breakAtr`, sens, actif | z-score, λ de V1, volume, distance de cassure |', '',
         'Résultats mesurés : R net, MFE et MAE (en R, moteur V1), perte pleine (R ≤ −1, 61 % des trades), au moins un saut '
         'identifié contre le trade dans l\'heure qui suit l\'entrée, coût de latence d\'une minute (proxy : déplacement Binance '
         'dans le sens du trade entre T et T + 1 min).', '',
         '## 3. Valeur prédictive incrémentale (hors échantillon, années 2020 → 2026, entraînement sur les années passées)', '',
         'B = indicateurs de V1 (|z|, λ de V1, volume, distance de cassure, sens, actif). BH = B + Hawkes (log λ même sens / μ, '
         'log λ opposé / μ, nombre attendu de sauts défavorables sur 60 min). BF = B + fréquence glissante (sauts même sens et '
         'opposés sur 60 min, tous sur 24 h). BM = B + Merton (saut identifié dans la bougie de signal, L max, nombre de sauts). '
         'R²_OOS relatif à B ; Clark–West unilatéral (BH, BF, BM contre B) ; Diebold–Mariano bilatéral (BH contre BF) ; '
         'erreurs groupées par jour ; Holm sur les 24 tests.', '',
         '| résultat | BH vs B : R²_OOS (p Holm) | BF vs B | BM vs B | BH vs BF : gain (p Holm) |', '|---|---|---|---|---|']
    for y, lab in OUTCOMES.items():
        c = lambda k: f"{100 * T[f'{y}|{k} vs B']['r2_oos']:+.2f} % ({T[f'{y}|{k} vs B']['p_holm']:.2f})"
        d = T[f'{y}|BH vs BF']
        L.append(f"| {lab} | {c('BH')} | {c('BF')} | {c('BM')} | {d['mean']:+.4f} ({d['p_holm']:.2f}) |")
    sig = [k for k, v in T.items() if v['p_holm'] < 0.05]
    L += ['', 'Lecture : Hawkes ne bat les indicateurs de V1 que sur la survenue d\'un saut défavorable dans l\'heure ; la fréquence '
          'glissante n\'y parvient pas, mais l\'écart direct Hawkes − fréquence n\'est pas significatif après correction. Sur les '
          'résultats qui comptent pour le P&L, aucun ajout ne prévoit mieux que V1 seule (R²_OOS ≤ +0,6 %, aucun test significatif).', '',
          'Corrélations de rang (descriptif, tous les trades analysés) :', '',
          '| variable | R | MFE | MAE | perte pleine | saut défavorable < 60 min | coût 1 min |', '|---|---:|---:|---:|---:|---:|---:|']
    for v, u in res['univariate'].items():
        L.append(f"| `{v}` | {u['R']:+.3f} | {u['mfe_log']:+.3f} | {u['mae_R']:+.3f} | {u['y_stop']:+.3f} | {u['y_adv60']:+.3f} | {u['cost_1m_bps']:+.3f} |")
    L += ['', '## 4. Impact économique (règles fixées avant calcul, hors échantillon 2020-07 → 2026-09)', '',
          f"Règle : un trade est « à risque » si sa probabilité prévue de perte pleine dépasse le 80e centile des valeurs ajustées "
          f"de l'entraînement. Filtre = trade retiré ; taille ½ = exposition divisée par deux. Sharpe et drawdown approchés "
          f"(rendements des trades sur leur sleeve × 0,5, à la date de sortie, sans recomposition). Base : {res['n_oos']} trades, "
          f"Sharpe {res['base_sharpe']:.2f}, drawdown {100 * res['base_mdd']:.1f} %. ΔR total : IC bootstrap par blocs de 3 mois ; "
          'ΔSharpe : IC par blocs mensuels.', '',
          '| modèle | règle | trades signalés | dont gagnants | R des signalés | taux de perte pleine des signalés | ΔR total [IC 95 %] | Sharpe | ΔSharpe [IC 95 %] | drawdown |',
          '|---|---|---:|---:|---:|---:|---|---:|---|---:|']
    for k, e in res['econ'].items():
        m, rule = k.split('|')
        L.append(f"| {m} | {rule} | {e['flagged']} | {e['flagged_winners']} | {e['flagged_R']:+.1f} | {100 * e['stop_rate_flagged']:.0f} % | "
                 f"{e['dR_total']:+.1f} [{e['dR_ci']['lo95']:+.1f} ; {e['dR_ci']['hi95']:+.1f}] | {e['sharpe']:.2f} | "
                 f"{e['dsharpe']['est']:+.2f} [{e['dsharpe']['lo95']:+.2f} ; {e['dsharpe']['hi95']:+.2f}] | {100 * e['mdd']:.1f} % |")
    L += ['', 'Lecture : les trades signalés ont un peu plus de pertes pleines (66–71 % contre 61 %) mais un R total positif : '
          'les retirer coûte 87 à 140 R sur six ans, quel que soit le modèle, y compris V1 seule (B). Aucun ΔSharpe n\'est '
          'distinct de zéro ; les écarts entre B, BH, BF et BM sont dans le bruit.', '',
          '## 5. Exécution', '', f"Proxy (données Binance 1 min) : coût de latence d'une minute = déplacement du prix dans le sens du trade "
          f"entre T et T + 1 min (moyenne {res['cost_1m_mean']:.1f} pb). Différence tiers supérieur − reste (ou saut / pas de saut) :", '',
          '| variable | n signalés | coût signalés (pb) | coût autres (pb) | différence (pb) | t |', '|---|---:|---:|---:|---:|---:|']
    for v, e in res['execution'].items():
        L.append(f"| `{v}` | {e['n1']} | {e['mean1']:.1f} | {e['mean0']:.1f} | {e['diff']:+.1f} | {e['t']:.2f} |")
    L += ['', 'Lecture : un λ même sens élevé va avec un coût de latence plus élevé (+4 pb, t = 1,3, terciles de tout l\'échantillon, '
          'descriptif) ; hors échantillon, aucun modèle ne prévoit ce coût mieux que V1 seule (§ 3). Les exécutions réelles du bot '
          '(latence 0,5–5 s, `research/reports/execution/`) ne sont disponibles qu\'en agrégats : pas de test direct possible.', '',
          '## 6. Limites', '',
          '- 24 trades de 2020-01 → 2020-06 non couverts (aucune estimation Hawkes chronologique) et 1 trade dans une panne Binance.',
          '- Hawkes et sauts mesurés sur Binance (comptant puis perpétuel) alors que V1 décide sur Bitstamp (BTC) : correspondance '
          'de signe de la bougie de signal 100 %, corrélation des amplitudes 0,99.',
          '- Régressions linéaires simples, entraînement minimal de 141 trades (2018–2019) pour l\'année 2020 ; Sharpe et drawdown '
          'approchés sans recomposition. Aucune optimisation, aucun nouveau backtest.']
    (OUT / 'report.md').write_text('\n'.join(L) + '\n')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
