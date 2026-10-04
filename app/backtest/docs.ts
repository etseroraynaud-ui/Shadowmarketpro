// Aide du langage de stratégie, affichée à côté de l'éditeur.

import type { Lang } from './i18n'

export interface DocSection {
  title: string
  intro?: string
  rows?: [string, string][]
  code?: string
}

const fr: DocSection[] = [
  {
    title: 'Principe',
    intro: 'Chaque ligne donne un nom à une série calculée sur toutes les barres. Le moteur lit les signaux à la clôture de chaque barre et passe l\'ordre à l\'ouverture suivante. Les fonctions ne voient jamais le futur.',
    code: `rapide = ema(close, 20)          // une série
long = crossover(rapide, sma(close, 50))   // signal d'achat`,
  },
  {
    title: 'Signaux reconnus',
    rows: [
      ['long', 'Ouvrir un achat quand la condition est vraie.'],
      ['exitLong', 'Fermer l\'achat en cours.'],
      ['short', 'Ouvrir une vente à découvert (ferme aussi un achat en cours).'],
      ['exitShort', 'Fermer la vente en cours.'],
      ['stopLoss', 'Distance du stop en prix, lue à la barre du signal (ex. 2 * atr(14)).'],
      ['takeProfit', 'Distance de l\'objectif en prix.'],
    ],
  },
  {
    title: 'Paramètres',
    intro: 'input() crée un réglage modifiable dans l\'interface et optimisable.',
    code: `periode = input(14, "Période RSI", 2, 50)      // défaut, titre, min, max
mult = input.float(2.0, "Multiplicateur", minval=0.5, step=0.5)
filtre = input.bool(true, "Filtre de tendance")`,
  },
  {
    title: 'Données de prix',
    rows: [
      ['open high low close volume', 'Prix et volume de la barre.'],
      ['hl2 hlc3 ohlc4', 'Moyennes de prix.'],
      ['close[1]', 'Valeur de la barre précédente ; [n] = n barres avant.'],
      ['bar_index time', 'Numéro de la barre, horodatage en ms.'],
      ['year month dayofweek hour', 'Calendrier UTC (dayofweek : 1 = dimanche).'],
    ],
  },
  {
    title: 'Opérateurs',
    rows: [
      ['+ - * / %', 'Calcul.'],
      ['> < >= <= == !=', 'Comparaisons (vrai = 1, faux = 0).'],
      ['and or not', 'Logique (&& || ! aussi acceptés).'],
      ['cond ? a : b', 'a si cond, sinon b.'],
      ['[a, b, c] = f(…)', 'Fonctions qui renvoient plusieurs séries.'],
      ['na, nz(x, 0), na(x)', 'Valeur manquante ; remplacement ; test.'],
    ],
  },
  {
    title: 'Moyennes et volatilité',
    rows: [
      ['sma ema wma rma hma dema tema(src, n)', 'Moyennes mobiles.'],
      ['vwma(src, n)', 'Moyenne pondérée par le volume.'],
      ['vwap', 'VWAP du jour (UTC).'],
      ['stdev variance(src, n)', 'Écart type, variance.'],
      ['atr(n), tr', 'Average True Range, True Range.'],
      ['[mid, haut, bas] = bb(src, n, mult)', 'Bandes de Bollinger.'],
      ['[mid, haut, bas] = kc(src, n, mult)', 'Canaux de Keltner.'],
      ['highest lowest(src, n)', 'Plus haut / plus bas sur n barres.'],
      ['linreg(src, n, décalage)', 'Régression linéaire.'],
    ],
  },
  {
    title: 'Oscillateurs et tendance',
    rows: [
      ['rsi(src, n)', 'RSI de Wilder.'],
      ['[ligne, signal, histo] = macd(src, 12, 26, 9)', 'MACD.'],
      ['stoch(close, high, low, n)', 'Stochastique %K.'],
      ['cci(src, n), mfi(hlc3, n), wpr(n)', 'CCI, Money Flow, Williams %R.'],
      ['[plusDI, moinsDI, adx] = dmi(14, 14)', 'Directional Movement ; adx(14) seul.'],
      ['[ligne, direction] = supertrend(3, 10)', 'Supertrend ; direction -1 = hausse.'],
      ['roc mom change(src, n)', 'Variation en %, en points.'],
      ['obv, cum(src), sum(src, n)', 'On Balance Volume, cumul, somme glissante.'],
      ['pivothigh pivotlow(gauche, droite)', 'Pivots, confirmés après « droite » barres.'],
    ],
  },
  {
    title: 'Conditions',
    rows: [
      ['crossover crossunder cross(a, b)', 'a passe au-dessus / en dessous de b.'],
      ['rising falling(src, n)', 'Plus haut / plus bas que les n valeurs précédentes.'],
      ['barssince(cond)', 'Barres depuis la dernière fois que cond était vraie.'],
      ['valuewhen(cond, src, 0)', 'Valeur de src la dernière fois que cond était vraie.'],
      ['abs max min round sqrt log pow…', 'Mathématiques (préfixe math. accepté).'],
    ],
  },
  {
    title: 'Affichage',
    code: `plot(ema(close, 50), "EMA 50")              // sur le prix
plot(rsi(close, 14), "RSI")                  // panneau séparé, choisi seul
plot(x, "Mon indicateur", color=#f5b942, overlay=false)`,
  },
  {
    title: 'Venir de Pine Script',
    intro: 'Les noms ta.ema, math.abs, input.int, les arguments nommés et les couleurs #rrggbb sont acceptés tels quels. Pas de if, de := ni de strategy.entry : on écrit la condition directement (long = …). L\'onglet Pine Script convertit le reste automatiquement.',
  },
]

const en: DocSection[] = [
  {
    title: 'Principle',
    intro: 'Each line names a series computed over all bars. The engine reads the signals at each bar\'s close and places the order at the next open. Functions never see the future.',
    code: `fast = ema(close, 20)            // a series
long = crossover(fast, sma(close, 50))     // buy signal`,
  },
  {
    title: 'Recognised signals',
    rows: [
      ['long', 'Open a long position when the condition is true.'],
      ['exitLong', 'Close the open long.'],
      ['short', 'Open a short position (also closes an open long).'],
      ['exitShort', 'Close the open short.'],
      ['stopLoss', 'Stop distance in price, read at the signal bar (e.g. 2 * atr(14)).'],
      ['takeProfit', 'Target distance in price.'],
    ],
  },
  {
    title: 'Parameters',
    intro: 'input() creates a setting you can change in the interface and optimise.',
    code: `length = input(14, "RSI length", 2, 50)       // default, title, min, max
mult = input.float(2.0, "Multiplier", minval=0.5, step=0.5)
useFilter = input.bool(true, "Trend filter")`,
  },
  {
    title: 'Price data',
    rows: [
      ['open high low close volume', 'Bar prices and volume.'],
      ['hl2 hlc3 ohlc4', 'Price averages.'],
      ['close[1]', 'Previous bar\'s value; [n] = n bars back.'],
      ['bar_index time', 'Bar number, timestamp in ms.'],
      ['year month dayofweek hour', 'UTC calendar (dayofweek: 1 = Sunday).'],
    ],
  },
  {
    title: 'Operators',
    rows: [
      ['+ - * / %', 'Arithmetic.'],
      ['> < >= <= == !=', 'Comparisons (true = 1, false = 0).'],
      ['and or not', 'Logic (&& || ! also accepted).'],
      ['cond ? a : b', 'a if cond, else b.'],
      ['[a, b, c] = f(…)', 'Functions returning several series.'],
      ['na, nz(x, 0), na(x)', 'Missing value; replacement; test.'],
    ],
  },
  {
    title: 'Averages and volatility',
    rows: [
      ['sma ema wma rma hma dema tema(src, n)', 'Moving averages.'],
      ['vwma(src, n)', 'Volume-weighted average.'],
      ['vwap', 'Daily VWAP (UTC).'],
      ['stdev variance(src, n)', 'Standard deviation, variance.'],
      ['atr(n), tr', 'Average True Range, True Range.'],
      ['[mid, upper, lower] = bb(src, n, mult)', 'Bollinger Bands.'],
      ['[mid, upper, lower] = kc(src, n, mult)', 'Keltner Channels.'],
      ['highest lowest(src, n)', 'Highest / lowest over n bars.'],
      ['linreg(src, n, offset)', 'Linear regression.'],
    ],
  },
  {
    title: 'Oscillators and trend',
    rows: [
      ['rsi(src, n)', 'Wilder\'s RSI.'],
      ['[line, signal, hist] = macd(src, 12, 26, 9)', 'MACD.'],
      ['stoch(close, high, low, n)', 'Stochastic %K.'],
      ['cci(src, n), mfi(hlc3, n), wpr(n)', 'CCI, Money Flow, Williams %R.'],
      ['[plusDI, minusDI, adx] = dmi(14, 14)', 'Directional Movement; adx(14) alone.'],
      ['[line, direction] = supertrend(3, 10)', 'Supertrend; direction -1 = uptrend.'],
      ['roc mom change(src, n)', 'Change in %, in points.'],
      ['obv, cum(src), sum(src, n)', 'On Balance Volume, cumulative, rolling sum.'],
      ['pivothigh pivotlow(left, right)', 'Pivots, confirmed after "right" bars.'],
    ],
  },
  {
    title: 'Conditions',
    rows: [
      ['crossover crossunder cross(a, b)', 'a crosses above / below b.'],
      ['rising falling(src, n)', 'Higher / lower than the previous n values.'],
      ['barssince(cond)', 'Bars since cond was last true.'],
      ['valuewhen(cond, src, 0)', 'Value of src when cond was last true.'],
      ['abs max min round sqrt log pow…', 'Math (math. prefix accepted).'],
    ],
  },
  {
    title: 'Display',
    code: `plot(ema(close, 50), "EMA 50")              // on price
plot(rsi(close, 14), "RSI")                  // separate pane, chosen automatically
plot(x, "My indicator", color=#f5b942, overlay=false)`,
  },
  {
    title: 'Coming from Pine Script',
    intro: 'ta.ema, math.abs, input.int, named arguments and #rrggbb colours are accepted as is. No if, := or strategy.entry: write the condition directly (long = …). The Pine Script tab converts the rest automatically.',
  },
]

export const DOCS: Record<Lang, DocSection[]> = { fr, en }
