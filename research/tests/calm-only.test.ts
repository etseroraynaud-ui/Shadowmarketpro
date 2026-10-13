// V1-calme figée (research/lib/calm-only.ts) et univers B (candidats de regime-wf, graine 5).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calmOnly } from '../lib/calm-only.ts'
import { candidates } from '../shock/regime-wf.ts'

test('V1-calme : retire les seules entrées en régime agité, des deux côtés', () => {
  const select = Int8Array.from([0, 1, 1, 0, -1, 1, 0])
  const long = Uint8Array.from([1, 1, 0, 0, 1, 0, 1]), short = Uint8Array.from([0, 0, 1, 1, 0, 1, 0])
  const o = calmOnly({ long, short }, select)
  assert.deepEqual(Array.from(o.long), [1, 0, 0, 0, 1, 0, 1])
  assert.deepEqual(Array.from(o.short), [0, 0, 0, 1, 0, 0, 0])
  // les listes d'origine ne sont pas modifiées
  assert.deepEqual(Array.from(long), [1, 1, 0, 0, 1, 0, 1])
})

test('univers B : 6 jeux fixes + 200 tirages, reproductibles', () => {
  const a = candidates(200, 5), b = candidates(200, 5)
  assert.equal(a.length, 206)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a[6].over, candidates(200, 9)[6].over)
})
