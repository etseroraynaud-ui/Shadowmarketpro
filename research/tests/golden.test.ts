import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeGolden, GOLDEN_FILE } from './golden.ts'

test('Shock Engine : résultats identiques aux empreintes de référence', () => {
  const ref = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'))
  const now = computeGolden()
  for (const k of Object.keys(ref)) assert.deepEqual(now[k], ref[k], k)
})
