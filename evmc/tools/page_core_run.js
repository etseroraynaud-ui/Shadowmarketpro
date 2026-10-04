// Exécute le banc d'essai de la page hors navigateur ; appelé par tools/page_xcheck.py.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const data = html.match(/<script type="application\/json" id="evmc-data">([\s\S]*?)<\/script>/)[1];
const core = html.match(/<script id="evmc-core">([\s\S]*?)<\/script>/)[1];
eval(core);
const D = JSON.parse(data);
const C = globalThis.EVMC_CORE.load(D);
const sets = JSON.parse(process.argv[3]);
const out = sets.map(P => { const r = globalThis.EVMC_CORE.backtest(C, P); return { stats: r.stats, n: r.trades.length, first: r.trades.slice(0, 3), last: r.trades.slice(-1), eqEnd: r.eq[r.eq.length - 1], path5: r.paths.length ? Array.from(r.paths[0]).slice(0, 6) : [] }; });
console.log(JSON.stringify(out));
