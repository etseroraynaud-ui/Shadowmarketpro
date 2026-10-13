"""Étude d'événements BTC/ETH sur la période E (protocole § 5, livrable 5).

    cd research/fade && python3 -m shockfade.eventstudy
Sortie : research/reports/shock-fade/03-event-study.{md,json}.
"""
from __future__ import annotations

import json
import math

import numpy as np
import pandas as pd

from . import config as C
from . import jumps as jp
from . import stats as st
from .paths import DERIVED, REPORTS
from .pipeline import load_asset
from .trial_log import log

SYMS = ['BTCUSDT', 'ETHUSDT']
H = C.HORIZONS
RT1 = 2 * C.COSTS['C1']


def load_events(delta: int, start: str = C.E_START, end: str = C.E_END) -> pd.DataFrame:
    ev = pd.concat([pd.read_parquet(DERIVED / f'events-{s}-{delta}m.parquet') for s in SYMS], ignore_index=True)
    return ev[(ev['T'] >= C.ms(start)) & (ev['T'] < C.ms(end))].reset_index(drop=True)


def bps(x, d=1):
    return '—' if x is None or not np.isfinite(x) else f'{1e4 * x:.{d}f}'


def pct(x, d=1):
    return '—' if x is None or not np.isfinite(x) else f'{100 * x:.{d}f} %'


def gross_row(e: pd.DataFrame, h: int, prefix: str = '') -> dict:
    g = e[f'{prefix}g{h}'].to_numpy()
    ok = np.isfinite(g)
    g = g[ok]
    if len(g) < 2:
        return {'n': int(len(g))}
    cm = st.cluster_mean(g, st.day_of(e['T'].to_numpy()[ok]))
    return {'n': int(len(g)), 'mean': float(g.mean()), 't': cm['t'], 'median': float(np.median(g)), 'pos': float(np.mean(g > 0)),
            'gt_cost': float(np.mean(g > RT1)), 'net_c1': float(g.mean() - RT1),
            'q01': float(np.percentile(g, 1)), 'q05': float(np.percentile(g, 5)), 'q95': float(np.percentile(g, 95)),
            'q99': float(np.percentile(g, 99))}


def jump_section(L: list, res: dict) -> None:
    L += ['## 1. Sauts à 1 minute (Merton, test de Lee–Mykland)', '',
          f'Seuil de Gumbel θ = {jp.THETA:.3f} (α = 1 %, n = 1 440) sur L = r̃/σ̂ (variation bipuissance des 360 minutes '
          'précédentes, rendements désaisonnalisés). Sous l\'hypothèse nulle d\'une diffusion, on attend au plus ≈ 0,01 saut '
          'détecté par jour.', '',
          '| actif | année | sauts / jour | hausse | baisse | \\|saut\\| médian (pb) | \\|saut\\| médian (σ diffusifs) | jours BNS rejetés (0,1 %) | part de la VQ due aux sauts (BNS) |',
          '|---|---|---:|---:|---:|---:|---:|---:|---:|']
    res['jumps'] = {}
    for sym in SYMS:
        a = load_asset(sym, C.DESIGN_GRID_END)
        yr = pd.to_datetime(a.m.t, unit='ms').year.to_numpy()
        r5 = np.diff(np.log(a.m.c[4::5]), prepend=np.nan)
        b = jp.bns_daily(r5)
        dyr = pd.to_datetime(a.m.t[::1440][: len(b['z'])], unit='ms').year.to_numpy()
        res['jumps'][sym] = {}
        for y in range(2020, 2025):
            s = (yr == y) & np.isfinite(a.vol.L)
            if y == 2020:
                s &= a.m.t >= C.ms(C.WARMUP_END)
            j = a.jump[s]
            r = a.vol.r[s][j != 0]
            sz = np.abs(r) / np.sqrt(a.vol.v[s][j != 0])
            days = s.sum() / 1440
            bs = (dyr == y) & np.isfinite(b['z'])
            if y == 2020:
                bs &= np.arange(len(dyr)) >= (C.ms(C.WARMUP_END) - a.t0) // 86_400_000
            row = {'per_day': float((j != 0).sum() / days), 'up': int((j > 0).sum()), 'down': int((j < 0).sum()),
                   'median_abs_bps': float(1e4 * np.median(np.abs(r))), 'median_sigma': float(np.median(sz)),
                   'bns_reject': float(np.mean(jp.bns_reject(b['z'][bs]))),
                   'bns_jshare': float(np.nansum(b['rv'][bs] * b['jshare'][bs]) / np.nansum(b['rv'][bs])),
                   'mean_up_bps': float(1e4 * r[r > 0].mean()), 'sd_up_bps': float(1e4 * r[r > 0].std()),
                   'mean_down_bps': float(1e4 * r[r < 0].mean()), 'sd_down_bps': float(1e4 * r[r < 0].std())}
            res['jumps'][sym][y] = row
            L.append(f"| {sym} | {y}{' (S2)' if y == 2020 else ''} | {row['per_day']:.2f} | {row['up']} | {row['down']} | "
                     f"{row['median_abs_bps']:.1f} | {row['median_sigma']:.1f} | {pct(row['bns_reject'])} | {pct(row['bns_jshare'])} |")
    L += ['', 'Lecture : plusieurs sauts « identifiés » par jour, des centaines de fois le taux de fausses détections '
          'attendu sous une diffusion : à 1 min, les queues des rendements crypto sont bien plus épaisses qu\'une diffusion '
          'à volatilité localement constante. Une partie de ces « sauts » est probablement de la volatilité très courte '
          '(sous l\'heure) plutôt qu\'une vraie discontinuité ; le test ne peut pas les distinguer. Le caractère « saut » est '
          'donc statistique (rejet de la diffusion locale), pas une preuve de discontinuité.', '']


def counts_section(L, res, ev5, ev15):
    L += ['## 2. Chocs détectés (|Z| ≥ k, volatilité prévue avant la barre)', '',
          '| fréquence | actif | k = 3 | k = 4 | k = 5 | hausse (k=4) | baisse (k=4) | avec saut identifié (k=4) | failed breakout (k=4) | par jour (k=4) |',
          '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|']
    res['counts'] = {}
    ndays = (C.ms(C.E_END) - C.ms(C.E_START)) / 86_400_000
    for delta, ev in ((5, ev5), (15, ev15)):
        for sym in SYMS:
            e = ev[ev['asset'] == sym]
            e4 = e[e['absZ'] >= 4]
            row = {'k3': int((e['absZ'] >= 3).sum()), 'k4': int(len(e4)), 'k5': int((e['absZ'] >= 5).sum()),
                   'up': int((e4['d'] > 0).sum()), 'down': int((e4['d'] < 0).sum()), 'J': float(e4['J'].mean()),
                   'FB': float(e4['FB'].mean()), 'per_day': len(e4) / ndays}
            res['counts'][f'{delta}-{sym}'] = row
            L.append(f"| {delta} min | {sym} | {row['k3']} | {row['k4']} | {row['k5']} | {row['up']} | {row['down']} | "
                     f"{pct(row['J'])} | {pct(row['FB'])} | {row['per_day']:.2f} |")
    by_year = ev5[ev5['absZ'] >= 4].assign(y=pd.to_datetime(ev5['T'], unit='ms').dt.year).groupby(['asset', 'y']).size().unstack(0)
    L += ['', 'Chocs |Z| ≥ 4 à 5 min par année : ' + '; '.join(f"{y} : BTC {int(r.get('BTCUSDT', 0))}, ETH {int(r.get('ETHUSDT', 0))}"
                                                     for y, r in by_year.iterrows()), '']


def returns_section(L, res, ev, delta, title):
    e4 = ev[ev['absZ'] >= 4]
    L += [f'## {title}', '',
          'Rendement du Fade (position −d) de la clôture de la minute T+1 à la clôture de T+1+h·Δ, en pb. '
          f'Coût aller-retour C1 = {1e4 * RT1:.0f} pb. t : erreur type groupée par jour UTC.', '',
          '| h | n | moyenne brute | t | médiane | P(> 0) | P(> coût) | moyenne nette C1 | sans latence (brute) | 1 % | 5 % | 95 % | 99 % |',
          '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    out = {}
    for h in H:
        r = gross_row(e4, h)
        r['zero_latency_mean'] = float(np.nanmean(e4[f'g0lat{h}']))
        out[h] = r
        L.append(f"| {h} | {r['n']} | {bps(r['mean'])} | {r['t']:.2f} | {bps(r['median'])} | {pct(r['pos'])} | {pct(r['gt_cost'])} | "
                 f"{bps(r['net_c1'])} | {bps(r['zero_latency_mean'])} | {bps(r['q01'], 0)} | {bps(r['q05'], 0)} | {bps(r['q95'], 0)} | {bps(r['q99'], 0)} |")
    res[f'returns_{delta}'] = out
    L += ['', 'Sensibilité au seuil k (moyenne brute, pb ; t entre parenthèses) :', '',
          '| k | n | ' + ' | '.join(f'h={h}' for h in H) + ' |', '|---:|---:|' + '---:|' * len(H)]
    sens = {}
    for k in (3.0, 4.0, 5.0):
        e = ev[ev['absZ'] >= k]
        rr = {h: gross_row(e, h) for h in H}
        sens[k] = rr
        L.append(f'| {k:g} | {len(e)} | ' + ' | '.join(f"{bps(rr[h]['mean'])} ({rr[h]['t']:.1f})" for h in H) + ' |')
    res[f'k_sensitivity_{delta}'] = sens
    L.append('')


def excursion_section(L, res, ev):
    e4 = ev[ev['absZ'] >= 4]
    L += ['## 4. Excursions favorable et adverse (MFE / MAE, 5 min)', '',
          'Sur le chemin 1 min (hauts et bas) après l\'entrée, dans le sens du Fade. |R| = amplitude du choc.', '',
          '| h | MFE médiane (pb) | MAE médiane (pb) | P(MFE > coût) | MFE médiane / \\|R\\| | MAE médiane / \\|R\\| | MAE 95e centile (pb) | MAE 99e centile (pb) |',
          '|---:|---:|---:|---:|---:|---:|---:|---:|']
    out = {}
    absR = np.abs(e4['R'].to_numpy())
    for h in H:
        mfe, mae = e4[f'mfe{h}'].to_numpy(), e4[f'mae{h}'].to_numpy()
        ok = np.isfinite(mfe)
        row = {'mfe_med': float(np.median(mfe[ok])), 'mae_med': float(np.median(mae[ok])), 'p_mfe_cost': float(np.mean(mfe[ok] > RT1)),
               'mfe_rel': float(np.median(mfe[ok] / absR[ok])), 'mae_rel': float(np.median(mae[ok] / absR[ok])),
               'mae95': float(np.percentile(mae[ok], 95)), 'mae99': float(np.percentile(mae[ok], 99))}
        out[h] = row
        L.append(f"| {h} | {bps(row['mfe_med'])} | {bps(row['mae_med'])} | {pct(row['p_mfe_cost'])} | {row['mfe_rel']:.2f} | "
                 f"{row['mae_rel']:.2f} | {bps(row['mae95'], 0)} | {bps(row['mae99'], 0)} |")
    res['excursions_5'] = out
    L += ['', 'Récupération du mouvement (clôtures 1 min, depuis la clôture du choc, censure à 32 barres = 160 min) et, en '
          'regard, **extension symétrique** du même pourcentage dans le sens du choc. Une marche aléatoire atteint aussi '
          'souvent l\'un que l\'autre : seule la comparaison des deux colonnes dit s\'il y a réversion.', '',
          '| groupe | n | 25 % repris | ext. 25 % | médiane (min) | 50 % repris | ext. 50 % | médiane (min) | 75 % repris | ext. 75 % | médiane (min) | 100 % repris | ext. 100 % | médiane (min) |',
          '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    rec = {}
    for name, sub in (('tous', e4), ('avec saut identifié', e4[e4['J'] == 1]), ('sans saut identifié', e4[e4['J'] == 0]),
                      ('failed breakout', e4[e4['FB'] == 1]), ('cassure confirmée', e4[e4['BO'] == 1])):
        row = {'n': int(len(sub))}
        cells = []
        for q in (25, 50, 75, 100):
            t = sub[f'ret{q}_min'].to_numpy()
            reach = float(np.mean(np.isfinite(t)))
            ext = float(np.mean(np.isfinite(sub[f'ext{q}_min'].to_numpy())))
            med = float(np.nanmedian(t)) if np.isfinite(t).any() else float('nan')
            row[q] = {'reach': reach, 'extension': ext, 'median_min': med}
            cells += [pct(reach), pct(ext), f'{med:.0f}' if np.isfinite(med) else '—']
        rec[name] = row
        L.append(f'| {name} | {len(sub)} | ' + ' | '.join(cells) + ' |')
    res['recovery_5'] = rec
    L += ['', 'Amplitude de réversion observée (fraction du choc reprise à la sortie, médiane) : ' +
          ', '.join(f"h={h} : {np.nanmedian(e4[f'retfrac{h}']):.2f}" for h in H) + '.', '']


def hawkes_section(L, res, ev, delta):
    e4 = ev[ev['absZ'] >= 4]
    L += ['## 5. Intensité Hawkes et nouveaux sauts après le choc (5 min)', '',
          'Probabilité réalisée d\'au moins un saut identifié dans le sens du choc (« continuation ») ou opposé, dans '
          '(T, T + 1 + h·Δ] ; prévision Hawkes moyenne (paramètres du trimestre, estimés avant lui) ; référence de Poisson '
          '(taux constant des 180 jours précédents). Ce sont des probabilités d\'**événements**, pas de signe du rendement.', '',
          '| h | P(saut même sens) réalisée | Hawkes prévue | Poisson | P(saut sens opposé) réalisée | Hawkes prévue | P(≥ 2 même sens) réalisée | Hawkes prévue |',
          '|---:|---:|---:|---:|---:|---:|---:|---:|']
    out = {}
    for h in H:
        Hm = 1 + h * delta
        rs = (e4[f'nj_same{h}'] >= 1).mean()
        ro = (e4[f'nj_opp{h}'] >= 1).mean()
        rc = (e4[f'nj_same{h}'] >= 2).mean()
        pois = (1 - np.exp(-e4['mu_pois_same'] * Hm)).mean()
        row = {'real_same': float(rs), 'hawkes_same': float(e4[f'p_same{h}'].mean()), 'poisson_same': float(pois),
               'real_opp': float(ro), 'hawkes_opp': float(e4[f'p_opp{h}'].mean()), 'real_casc': float(rc),
               'hawkes_casc': float(e4[f'p_casc{h}'].mean())}
        out[h] = row
        L.append(f"| {h} | {pct(rs)} | {pct(row['hawkes_same'])} | {pct(pois)} | {pct(ro)} | {pct(row['hawkes_opp'])} | {pct(rc)} | {pct(row['hawkes_casc'])} |")
    ratio_pre = (e4['lam_same_pre'] / e4['mu_same']).median()
    ratio_T = (e4['lam_same'] / e4['mu_same']).median()
    ratio_D2 = (e4['lam_same_D2'] / e4['mu_same']).median()
    res['hawkes_5'] = {'rows': out, 'lam_ratio_pre': float(ratio_pre), 'lam_ratio_T': float(ratio_T), 'lam_ratio_D2': float(ratio_D2)}
    L += ['', f'Intensité dans le sens du choc rapportée au taux de base μ (médianes) : avant la barre du choc {ratio_pre:.2f}, '
          f'à la décision T {ratio_T:.2f}, deux barres plus tard (D2) {ratio_D2:.2f}.', '']


def breakdown_section(L, res, ev, hs=(4, 16)):
    e4 = ev[ev['absZ'] >= 4].copy()
    e4['regime'] = pd.cut(e4['rv_pct'], [-0.01, 1 / 3, 2 / 3, 1.01], labels=['calme', 'normal', 'agité'])
    e4['session'] = pd.cut(e4['hour'], [-1, 7, 12, 20, 24], labels=['Asie 0–8 h', 'Europe 8–13 h', 'US 13–21 h', 'soir 21–24 h'])
    e4['year'] = pd.to_datetime(e4['T'], unit='ms').dt.year
    e4['dir'] = np.where(e4['d'] > 0, 'choc haussier (Fade short)', 'choc baissier (Fade long)')
    e4['Jl'] = np.where(e4['J'] == 1, 'saut identifié dans la barre', 'pas de saut identifié')
    e4['FBl'] = np.where(e4['FB'] == 1, 'failed breakout', 'pas de failed breakout')
    L += ['## 6. Répartition par actif, régime de volatilité, sens, saut, session et année (5 min, |Z| ≥ 4)', '',
          'Moyenne brute du Fade en pb (t groupé par jour) et moyenne nette C1, à h = ' + ' et '.join(str(h) for h in hs) + '.', '',
          '| découpage | groupe | n | ' + ' | '.join(f'h={h} brut (t) | h={h} net C1' for h in hs) + ' |',
          '|---|---|---:|' + '---:|---:|' * len(hs)]
    out = {}
    for col, name in (('asset', 'actif'), ('regime', 'régime de volatilité'), ('dir', 'sens'), ('Jl', 'saut'), ('FBl', 'H1'),
                      ('session', 'session'), ('year', 'année')):
        for grp, sub in e4.groupby(col, observed=True):
            cells = []
            for h in hs:
                r = gross_row(sub, h)
                out[f'{col}={grp}@{h}'] = r
                cells += [f"{bps(r.get('mean'))} ({r.get('t', float('nan')):.1f})", bps(r.get('net_c1'))]
            L.append(f'| {name} | {grp} | {len(sub)} | ' + ' | '.join(cells) + ' |')
    res['breakdown_5'] = out
    L.append('')


def main():
    ev5, ev15 = load_events(5), load_events(15)
    res: dict = {}
    L = ['# Shock Fade Engine — étude d\'événements BTC/ETH (période E : 2020-07-01 → 2024-12-31)', '',
         'Généré par `research/fade/shockfade/eventstudy.py`. Perpétuels Binance USDⓈ-M, bougies 1 min ; chocs sur barres de '
         '5 min (principal) et 15 min (secondaire). Entrée à la clôture de la minute qui suit la clôture du choc (une '
         'minute de latence). Le holdout C (2025-01 → 2026-09) n\'est pas lu.', '']
    jump_section(L, res)
    counts_section(L, res, ev5, ev15)
    returns_section(L, res, ev5, 5, '3. Rendement du Fade après un choc, 5 min (|Z| ≥ 4)')
    excursion_section(L, res, ev5)
    hawkes_section(L, res, ev5, 5)
    breakdown_section(L, res, ev5)
    returns_section(L, res, ev15, 15, '7. Fréquence secondaire : rendement du Fade après un choc, 15 min (|Z| ≥ 4)')
    (REPORTS / '03-event-study.md').write_text('\n'.join(L) + '\n')
    (REPORTS / '03-event-study.json').write_text(json.dumps(res, indent=1, default=float))
    log('shockfade/eventstudy.py', 'étude d\'événements, k ∈ {3, 4, 5}, Δ ∈ {5, 15}', f'E = {C.E_START} → {C.E_END}')
    print('\n'.join(L))


if __name__ == '__main__':
    main()
