// Couche probabiliste · scoring d'un signal par le modèle figé, journal prospectif et bilan.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --asset btc --at 2026-09-21T20:30:00Z [--html fiche.html] [--log]
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --latest
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --evaluate
//
// --at : heure d'entrée du signal (clôture de la bougie de signal, comme dans l'identifiant du trade).
//   Le signal doit être une entrée du Shock Engine de référence à cette bougie ; il est noté sur un
//   historique coupé à cette bougie (rien de postérieur n'existe). Fiche en texte, et en HTML avec
//   --html. --log ajoute le score au journal.
// --latest : rejoue le Shock Engine de référence sur les données à jour et note chaque entrée
//   postérieure aux données du modèle (signaux prospectifs), puis les ajoute au journal (sans doublon).
// --evaluate : bilan du journal (signaux prospectifs fermés, comparés au naïf ; test à partir de
//   PROSPECTIVE_MIN signaux fermés).
//
// Lecture seule pour le moteur : rien n'est envoyé, aucune décision n'est modifiée.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { M15 } from './config.ts'
import { referenceSleeve, tradesAfter, truncatedContext, KEYS } from './dataset.ts'
import type { ReferenceSleeve } from './dataset.ts'
import type { SleeveKey } from '../lib/frozen-shock.ts'
import { appendLog, evaluateLog, loadModel, readLog, scoreAt } from './frozen.ts'
import type { FrozenModel, SignalScore } from './frozen.ts'
import { signalFeatures } from './features.ts'
import { cardPage, cardText } from './card.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const opt = (k: string, d: string | null = null) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const has = (k: string) => args.includes(`--${k}`)
const MODEL = join(ROOT, opt('model', 'research/reports/proba/model.json')!)
const LOG = join(ROOT, opt('log-file', 'research/reports/proba/prospective/predictions.jsonl')!)
const KEY: Record<string, SleeveKey> = { btc: 'btc', eth: 'ethusdt', ethusdt: 'ethusdt' }

/** Note l'entrée de la bougie i sur un historique coupé à i ; vérifie l'égalité avec le contexte complet. */
export function scoreEntry(model: FrozenModel, sha: string, ref: ReferenceSleeve, i: number, dir: 1 | -1, now = Date.now()): SignalScore {
  const ctx = truncatedContext(ref, i)
  const full = signalFeatures(ref.ctx, i, dir), cut = signalFeatures(ctx, i, dir)
  for (const k of Object.keys(full) as (keyof typeof full)[]) {
    const a = full[k], b = cut[k]
    if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)))) throw new Error(`caractéristique ${k} différente sur l'historique coupé (${a} ≠ ${b}) : lecture du futur`)
  }
  return scoreAt(model, sha, ctx, i, dir, now)
}

function main() {
  const { model, sha } = loadModel(MODEL)
  process.stderr.write(`modèle ${model.version} · ${sha.slice(0, 12)} · signaux prospectifs après ${model.data.prospectiveAfter}\n`)

  if (has('evaluate')) {
    const refs = Object.fromEntries(KEYS.map(k => [k, referenceSleeve(k)])) as Record<SleeveKey, ReferenceSleeve>
    const rows = tradesAfter(refs, Date.parse(model.data.prospectiveAfter)).map(x => x.row)
    console.log(JSON.stringify(evaluateLog(readLog(LOG), rows, sha), null, 1))
    return
  }

  if (has('latest')) {
    const refs = Object.fromEntries(KEYS.map(k => [k, referenceSleeve(k)])) as Record<SleeveKey, ReferenceSleeve>
    // Entrées postérieures aux données du modèle, y compris la position encore ouverte en fin de données.
    const sig = tradesAfter(refs, Date.parse(model.data.prospectiveAfter), false)
    let added = 0
    const cards = []
    for (const { ref, p } of sig) {
      const s = scoreEntry(model, sha, ref, p.entryIdx, p.dir)
      if (appendLog(LOG, s)) added++
      cards.push({ ...s, source: 'modèle figé' })
      console.log(cardText({ ...s, source: 'modèle figé' }) + '\n')
    }
    if (cards.length) {
      const out = join(dirname(LOG), 'cards', `latest.html`)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, cardPage(cards, 'Derniers signaux Shock Engine'))
    }
    console.log(`${sig.length} signal(aux) postérieur(s) au ${model.data.prospectiveAfter}, ${added} ajouté(s) au journal ${LOG.replace(ROOT + '/', '')}`)
    return
  }

  const asset = opt('asset'), at = opt('at')
  if (!asset || !at || !KEY[asset]) throw new Error('usage : --asset btc|eth --at <heure d\'entrée ISO> | --latest | --evaluate')
  const ref = referenceSleeve(KEY[asset])
  const entry = Date.parse(at)
  const b = ref.sleeve.bars
  let i = -1
  for (let k = 0; k < b.n; k++) if (b.t[k] + M15 === entry) { i = k; break }
  if (i < 0) throw new Error(`aucune bougie ne se clôt à ${at}`)
  const pos = ref.run.positions.find(p => p.entryIdx === i)
  if (!pos) throw new Error(`le Shock Engine de référence n'entre pas à ${at} : aucun signal à noter`)
  const s = scoreEntry(model, sha, ref, i, pos.dir)
  const card = { ...s, source: 'modèle figé' }
  console.log(cardText(card))
  const html = opt('html')
  if (html) { writeFileSync(html, cardPage([card])); process.stderr.write(`fiche : ${html}\n`) }
  if (has('log')) process.stderr.write(appendLog(LOG, s) ? `ajouté au journal ${LOG}\n` : 'déjà dans le journal\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main() } catch (e) { process.stderr.write(`erreur : ${(e as Error).message}\n`); process.exit(1) }
}
