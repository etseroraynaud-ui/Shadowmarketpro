// Contrôles du moteur d'exécution, de la référence aléatoire et de l'import de la page.
// Usage : node tools/page_core_test.js runs/<run_id>/report/dashboard.html
const fs = require('fs'), assert = require('assert');
const html = fs.readFileSync(process.argv[2], 'utf8');
eval(html.match(/<script id="evmc-core">([\s\S]*?)<\/script>/)[1]);
const K = globalThis.EVMC_CORE;
const close = (a, b, eps = 1e-12) => assert(Math.abs(a - b) <= eps, a + ' != ' + b);
// --- mini-marché : 10 barres journalières, zone notée à partir de la barre 2
const DAY = 86400e3;
const o = [10, 10, 10, 11, 12, 12, 11, 10, 9, 10], c = [10, 10, 11, 12, 12, 11, 10, 9, 10, 11];
const B = { n: 10, tf: 86400, ts: Float64Array.from(o.map((_, i) => (i + 1) * DAY)), o: Float64Array.from(o), c: Float64Array.from(c),
  h: Float64Array.from(o.map((v, i) => Math.max(v, c[i]) + 0.5)), l: Float64Array.from(o.map((v, i) => Math.min(v, c[i]) - 0.5)) };
const ctx = { B, D: { split: { eval_start: 2 } }, barsPerYear: 365, G: [1, 3] };
// 1. sortie après N barres : signal à la clôture de 2, entrée à l'ouverture de 3, sortie à la clôture de 5
let sig = Int8Array.from([0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
let tr = K.tradesFromSignals(ctx, sig, { dir: 'both', exit: 'bars', hold: 3, tp: 0, sl: 0, cost: 0 });
assert.deepStrictEqual(tr.map(t => [t.t, t.e, t.x, t.dir, t.entry, t.exit, t.why]), [[2, 3, 5, 1, 11, 11, 'durée']]);
// 2. sortie au signal : le signal tombe à la clôture de 4, sortie à l'ouverture de 5 ; vente lue en 5, entrée en 6
sig = Int8Array.from([0, 0, 1, 1, 0, -1, -1, -1, 0, 0]);
tr = K.tradesFromSignals(ctx, sig, { dir: 'both', exit: 'signal', hold: 99, tp: 0, sl: 0, cost: 0 });
assert.deepStrictEqual(tr.map(t => [t.e, t.x, t.dir, t.entry, t.exit, t.why]), [[3, 5, 1, 11, 12, 'signal'], [6, 9, -1, 11, 10, 'signal']]);
// 2 bis. retournement : long puis vente lue à la même clôture, sortie et entrée à la même ouverture
sig = Int8Array.from([0, 0, 1, 1, -1, -1, 0, 0, 0, 0]);
tr = K.tradesFromSignals(ctx, sig, { dir: 'both', exit: 'signal', hold: 99, tp: 0, sl: 0, cost: 0 });
assert.deepStrictEqual(tr.map(t => [t.e, t.x, t.dir, t.entry, t.exit]), [[3, 5, 1, 11, 12], [5, 7, -1, 12, 10]]);
// long seulement : la vente n'ouvre rien
tr = K.tradesFromSignals(ctx, sig, { dir: 'long', exit: 'signal', hold: 99, tp: 0, sl: 0, cost: 0 });
assert.strictEqual(tr.length, 1);
// 3. stop avant objectif dans la même barre ; coûts des deux côtés
sig = Int8Array.from([0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
tr = K.tradesFromSignals(ctx, sig, { dir: 'both', exit: 'bars', hold: 5, tp: 1, sl: 1, cost: 10 });
assert.strictEqual(tr[0].why, 'stop'); close(tr[0].exit, 11 * 0.99); close(tr[0].net, 0.999 * 0.999 * 0.99 - 1);
// 4. capital : deux trades enchaînés à la même barre, valorisés à la clôture
sig = Int8Array.from([0, 0, 1, 1, -1, -1, 0, 0, 0, 0]);
tr = K.tradesFromSignals(ctx, sig, { dir: 'both', exit: 'signal', hold: 99, tp: 0, sl: 0, cost: 0 });
const ev = K.evaluate(ctx, tr, 0, 5);
// barres 2..9 : plat, long 11 -> clôtures 12, 12, sortie à 12 en barre 5 puis short 12 -> clôtures 11, 10, sortie à 10 en barre 7
const e1 = 12 / 11;
[1, e1, e1, e1 * (1 + (1 - 11 / 12)), e1 * (1 + (1 - 10 / 12)), e1 * (1 + (1 - 10 / 12)), e1 * (1 + (1 - 10 / 12)), e1 * (1 + (1 - 10 / 12))].forEach((v, i) => close(ev.eq[i], v));
close(ev.stats.net, e1 * (1 + 2 / 12) - 1); assert.strictEqual(ev.stats.n, 2); close(ev.stats.exposure, 6 / 8);
// 5. indicateurs
const m = K.sma(Float64Array.from([1, 2, 3, 4]), 2); assert(isNaN(m[0])); close(m[3], 3.5);
const r = K.rsi(Float64Array.from([1, 2, 3, 2, 3, 4, 5]), 3); assert(isNaN(r[2])); close(r[3], 100 - 100 / (1 + (2 / 3) / (1 / 3)));
// 6. référence aléatoire : déterministe, bornée, rang cohérent
const rr = K.randomRef(ctx, [{ e: 3, x: 4, dir: 1 }], 0, 0.05, 200, 7), rr2 = K.randomRef(ctx, [{ e: 3, x: 4, dir: 1 }], 0, 0.05, 200, 7);
assert.deepStrictEqual(rr, rr2); assert(rr.rank >= 0 && rr.rank <= 1 && rr.q05 <= rr.median && rr.median <= rr.q95);
assert.strictEqual(K.randomRef(ctx, [{ e: 3, x: 9, dir: 1 }], 0, 0, 10, 1), null);
// 7. import : dates, liste de trades TradingView, série de signaux
close(K.parseTime('1970-01-03'), 2 * DAY, 0); close(K.parseTime('1970-01-03 12:00'), 2.5 * DAY, 0); close(K.parseTime('172800'), 2 * DAY, 0); close(K.parseTime('1970-01-03T00:00:00+02:00'), 2 * DAY - 7200e3, 0);
assert.strictEqual(K.barAt(ctx, 2.5 * DAY), 2); assert.strictEqual(K.barAt(ctx, 10 * DAY), -1); assert.strictEqual(K.barAt(ctx, -1), -1);
const tv = 'Trade #,Type,Signal,Date/Time,Price USDT,Contracts,Profit USDT\n1,Exit Long,x,1970-01-07 00:00,12,1,1\n1,Entry Long,e,1970-01-05 00:00,11.5,1,\n2,Entry Short,e,1970-01-08 00:00,10,1,\n2,Exit Short,x,1970-01-09 00:00,"9,5",1,0.5\n3,Entry Long,e,1970-01-02 00:00,10,1,\n3,Exit Long,x,1970-01-02 00:00,10,1,0\n';
const it = K.readImport(ctx, tv);
assert.strictEqual(it.kind, 'trades'); assert.strictEqual(it.total, 3); assert.strictEqual(it.out, 1);
assert.deepStrictEqual(it.trades.map(t => [t.e, t.x, t.dir, t.entry, t.exit]), [[4, 6, 1, 11.5, 12], [7, 8, -1, 10, 9.5]]);
const run = K.runStrategy(ctx, 'import', {}, { dir: 'both', exit: 'signal', hold: 5, tp: 0, sl: 0, cost: 0 }, it);
close(run.stats.net, (12 / 11.5) * (1 + (1 - 9.5 / 10)) - 1);
const ser = 'time;close;mon indicateur\n345600;12;0.4\n432000;12;-0.7\n518400;11;abc\n';
const is = K.readImport(ctx, ser);
assert.strictEqual(is.kind, 'series'); assert.deepStrictEqual(is.cols, ['close', 'mon indicateur']); assert.strictEqual(is.def, 1); assert.strictEqual(is.mapped, 3);
const rs = K.runStrategy(ctx, 'import', { col: 1, a: 0, b: 0, carry: false }, { dir: 'both', exit: 'signal', hold: 5, tp: 0, sl: 0, cost: 0 }, is);
assert.deepStrictEqual(rs.trades.map(t => [t.e, t.x, t.dir]), [[5, 6, 1], [6, 7, -1]]);
assert(K.readImport(ctx, 'a,b\n1,2\n').error);
console.log('cœur de la page : 7 groupes de contrôles réussis');
