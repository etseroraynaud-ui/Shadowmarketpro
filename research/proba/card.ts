// Couche probabiliste · fiche d'un signal (« SHOCK ENGINE — PROBABILISTIC SIGNAL REPORT »), en HTML
// autonome et en texte. Ne calcule rien : met en page un SignalScore (frozen.ts) ou une prévision
// hors entraînement du walk-forward. Chaque valeur est accompagnée de la valeur naïve et du verdict du
// walk-forward pour la cible ; l'intervalle n'est affiché que s'il a été estimé.

import type { CardKey, Quantity, SignalScore } from './frozen.ts'

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const MINUS = '−'
const fin = (x: number) => typeof x === 'number' && Number.isFinite(x)
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const pct = (x: number, d = 1) => (fin(x) ? fr(`${(x * 100).toFixed(d)} %`) : '—')
const rr = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : '+'}${Math.abs(x).toFixed(d)} R`) : '—')
const MODEL_FR: Record<string, string> = { full: 'complet', reduced: 'réduit', context: 'contexte', naive: 'naïf', ridge: 'ridge' }
const fmtQ = (q: Quantity, x: number) => (q.key === 'er' ? rr(x) : pct(x))

/** Fiche pour une prévision qui n'a pas d'intervalle (walk-forward) : lo = hi = NaN. */
export interface CardInput extends SignalScore {
  /** Origine des valeurs : modèle figé ou modèle d'un pli du walk-forward. */
  source: string
  /** Résultat observé, pour les exemples historiques (null en temps réel). */
  outcome?: { R: number; win: boolean; exits: string } | null
}

function verdictChip(q: Quantity) {
  const v = q.verdict
  return v.demonstrated
    ? `<span class="chip ok" title="${esc(`${v.test} : ${v.metric} ${v.est.toFixed(4)} [${v.lo.toFixed(4)} ; ${v.hi.toFixed(4)}]`)}">✓ apport démontré (walk-forward)</span>`
    : `<span class="chip" title="${esc(`${v.test} : ${v.metric} ${v.est.toFixed(4)} [${v.lo.toFixed(4)} ; ${v.hi.toFixed(4)}], p = ${(v.pHolm ?? v.p).toFixed(3)}`)}">○ apport non démontré</span>`
}

function interval(q: Quantity, level: number) {
  return fin(q.lo) && fin(q.hi) ? `${Math.round(level * 100)} % : ${fmtQ(q, q.lo)} → ${fmtQ(q, q.hi)}` : 'intervalle non estimé'
}

function tile(q: Quantity, level: number) {
  return `<div class="ctile"><div class="cl">${esc(q.label)}</div><div class="cv">${fmtQ(q, q.value)}</div>
<div class="cs">${interval(q, level)}</div><div class="cs">naïf ${fmtQ(q, q.naive)} · modèle ${esc(MODEL_FR[q.model] ?? q.model)}${q.calibrated ? ' calibré' : ''}</div>${verdictChip(q)}</div>`
}

function meter(q: Quantity, level: number) {
  const w = (x: number) => `${Math.max(0, Math.min(100, x * 100)).toFixed(1)}%`
  const band = fin(q.lo) && fin(q.hi) ? `<span class="band" style="left:${w(q.lo)};width:${(Math.max(0, Math.min(1, q.hi)) * 100 - Math.max(0, Math.min(1, q.lo)) * 100).toFixed(1)}%"></span>` : ''
  return `<div class="crow"><span class="cn">${esc(q.label.replace('Continuation ', ''))}</span>
<span class="meter" role="img" aria-label="${esc(`${q.label} ${pct(q.value)}, naïf ${pct(q.naive)}`)}">${band}<span class="fill" style="width:${w(q.value)}"></span><span class="tick" style="left:${w(q.naive)}" title="naïf ${pct(q.naive)}"></span></span>
<span class="cval">${pct(q.value)}</span><span class="csub2"><span class="cs">naïf ${pct(q.naive)} · ${interval(q, level)}</span>${verdictChip(q)}</span></div>`
}

export function cardBody(s: CardInput): string {
  const Q = s.quantities
  const level = s.model.intervalLevel
  const dir = s.direction === 'long' ? 'LONG' : 'SHORT'
  const out = s.outcome ? `<p class="cs">Résultat observé (après coup) : R = ${rr(s.outcome.R)} · ${s.outcome.win ? 'gagnant' : 'perdant'} · sorties ${esc(s.outcome.exits)}</p>` : ''
  return `<article class="card" aria-label="Fiche du signal ${esc(s.id)}">
<header class="ch"><p class="ct">SHOCK ENGINE — PROBABILISTIC SIGNAL REPORT</p><span class="mode ${s.mode === 'prospectif' ? 'pro' : ''}">${esc(s.mode)}</span></header>
<h3 class="cid">${esc(s.asset)} · ${dir} <span class="cs">${esc(s.entryTime.replace('T', ' ').slice(0, 16))} UTC · ${esc(s.id)}</span></h3>
<p class="cs">Régime de volatilité <b>${esc(s.volRegime)}</b> · tendance journalière <b>${esc(s.trendRegime)}</b> · source : ${esc(s.source)}</p>
<div class="ctiles">${(['win', 'r2', 'er'] as CardKey[]).map(k => tile(Q[k], level)).join('')}</div>
<h4 class="csub">Probabilité que le prix continue dans le sens du signal (sans les règles de sortie)</h4>
${(['h1', 'h4', 'h16', 'h64'] as CardKey[]).map(k => meter(Q[k], level)).join('')}
${out}
<footer class="cf">Modèle ${esc(s.model.version)} · empreinte ${esc(s.model.sha256.slice(0, 12))} · ${esc(s.model.status)} Intervalles : incertitude des paramètres seulement (bootstrap par mois). Repère gris : valeur naïve (taux de l'entraînement). Aucune valeur de cette fiche ne modifie une décision de trading.</footer>
</article>`
}

export const CARD_CSS = `
.card{border:1px solid var(--border);border-radius:12px;padding:16px 18px;background:var(--surface);margin:12px 0}
.ch{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ct{margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--ink2)}
.mode{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--axis);border-radius:999px;padding:2px 8px;color:var(--ink2)}
.mode.pro{border-color:var(--s1);color:var(--ink)}
.cid{font-size:20px;margin:8px 0 2px}
.cs{font-size:12px;color:var(--muted);font-weight:400}
.ctiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}
.ctile{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--page)}
.cl{font-size:12px;color:var(--ink2)}
.cv{font-size:26px;font-weight:620;margin:2px 0}
.chip{display:inline-block;margin-top:6px;font-size:11.5px;color:var(--ink2);border:1px solid var(--grid);border-radius:999px;padding:1px 8px}
.chip.ok{color:var(--ok);border-color:var(--ok)}
.csub{font-size:13px;margin:14px 0 6px;color:var(--ink2);font-weight:600}
.crow{display:grid;grid-template-columns:52px minmax(80px,1fr) 64px;gap:4px 10px;align-items:center;margin:6px 0}
.csub2{grid-column:2 / span 2;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center}
.csub2 .chip{margin:0}
.cn{font-size:13px;color:var(--ink2)}
.cval{font-size:14px;font-weight:620;text-align:right;font-variant-numeric:tabular-nums}
.meter{position:relative;height:10px;border-radius:5px;background:color-mix(in oklab,var(--s1) 14%,var(--mid))}
.meter .fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--s1)}
.meter .band{position:absolute;top:-3px;bottom:-3px;border-radius:3px;background:color-mix(in oklab,var(--s1) 22%,transparent)}
.meter .tick{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--ink2)}
.cf{font-size:11.5px;color:var(--muted);margin-top:12px;border-top:1px solid var(--grid);padding-top:8px}
@media (max-width:720px){.ctiles{grid-template-columns:1fr}}
`

const PAGE_CSS = `
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6f6d68;--grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);--s1:#2a78d6;--mid:#f0efec;--ok:#006300}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--muted:#9a988f;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--mid:#383835;--ok:#0ca30c}}
:root[data-theme="dark"]{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--muted:#9a988f;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--mid:#383835;--ok:#0ca30c}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:16px}
`

/** Page HTML autonome d'une ou plusieurs fiches. */
export function cardPage(cards: CardInput[], title = 'Fiche du signal Shock Engine'): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}${CARD_CSS}</style></head><body><main>${cards.map(cardBody).join('\n')}</main></body></html>\n`
}

/** Fiche en texte, pour le terminal et les journaux. */
export function cardText(s: CardInput): string {
  const Q = s.quantities
  const lvl = s.model.intervalLevel
  const line = (q: Quantity) => {
    const iv = fin(q.lo) && fin(q.hi) ? `[${fmtQ(q, q.lo)} ; ${fmtQ(q, q.hi)}]` : '[non estimé]'
    return `  ${q.label.padEnd(22)} ${fmtQ(q, q.value).padStart(9)}  ${iv.padEnd(24)} naïf ${fmtQ(q, q.naive).padStart(9)}  ${q.verdict.demonstrated ? 'apport démontré' : 'apport non démontré'}`
  }
  return [
    'SHOCK ENGINE — PROBABILISTIC SIGNAL REPORT',
    `  ${s.asset} · ${s.direction.toUpperCase()} · ${s.entryTime} · ${s.id} · ${s.mode}`,
    `  Régime de volatilité ${s.volRegime} · tendance journalière ${s.trendRegime} · source ${s.source}`,
    `  (intervalles ${Math.round(lvl * 100)} % : incertitude des paramètres seulement)`,
    ...(['win', 'r2', 'er', 'h1', 'h4', 'h16', 'h64'] as CardKey[]).map(k => line(Q[k])),
    ...(s.outcome ? [`  Résultat observé : R = ${rr(s.outcome.R)} (${s.outcome.exits})`] : []),
    `  Modèle ${s.model.version} · ${s.model.sha256.slice(0, 12)} · ${s.model.status}`,
  ].join('\n')
}
