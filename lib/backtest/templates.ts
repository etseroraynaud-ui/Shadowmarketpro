// Stratégies modèles : points de départ, et exemples du langage.

import type { Msg, Settings } from './types.ts'

export interface Template {
  id: string
  name: Msg
  desc: Msg
  /** Famille, pour le classement dans l'interface. */
  kind: 'trend' | 'reversion' | 'breakout' | 'reference'
  script: string
  settings?: Partial<Settings>
}

export const TEMPLATES: Template[] = [
  {
    id: 'ema_cross',
    kind: 'trend',
    name: { fr: 'Croisement de moyennes', en: 'Moving average crossover' },
    desc: {
      fr: 'Achète quand la moyenne rapide passe au-dessus de la lente, revend au croisement inverse. Le classique du suivi de tendance.',
      en: 'Buys when the fast average crosses above the slow one, sells on the opposite cross. The trend-following classic.',
    },
    script: `// Croisement de moyennes exponentielles
rapide = input(20, "EMA rapide", 2, 200)
lente  = input(50, "EMA lente", 5, 400)

emaRapide = ema(close, rapide)
emaLente  = ema(close, lente)
plot(emaRapide, "EMA rapide", color=#f5b942)
plot(emaLente, "EMA lente", color=#60a5fa)

long     = crossover(emaRapide, emaLente)
exitLong = crossunder(emaRapide, emaLente)
`,
  },
  {
    id: 'rsi_reversion',
    kind: 'reversion',
    name: { fr: 'RSI : retour à la moyenne', en: 'RSI mean reversion' },
    desc: {
      fr: 'Achète un marché survendu (RSI bas) au-dessus de sa moyenne longue, revend quand le RSI remonte.',
      en: 'Buys an oversold market (low RSI) above its long average, sells when RSI recovers.',
    },
    script: `// RSI : achat sur excès de baisse, dans une tendance de fond haussière
periode = input(14, "Période RSI", 2, 50)
seuilBas = input(30, "Seuil d'achat", 5, 50)
seuilHaut = input(55, "Seuil de sortie", 40, 95)
filtre = input(200, "Moyenne de tendance", 20, 400)

r = rsi(close, periode)
tendance = sma(close, filtre)
plot(tendance, "Moyenne de tendance")
plot(r, "RSI")

long     = r < seuilBas and close > tendance
exitLong = r > seuilHaut
`,
  },
  {
    id: 'donchian',
    kind: 'breakout',
    name: { fr: 'Cassure de canal (Turtle)', en: 'Channel breakout (Turtle)' },
    desc: {
      fr: 'Achète la cassure du plus haut de N barres, sort sous le plus bas de M barres. Stop à 2 ATR, inspiré des Turtle Traders.',
      en: 'Buys a break of the N-bar high, exits below the M-bar low. Stop at 2 ATR, inspired by the Turtle Traders.',
    },
    script: `// Cassure de canal de Donchian, stop à 2 ATR
entree = input(20, "Canal d'entrée", 5, 100)
sortie = input(10, "Canal de sortie", 2, 100)
multAtr = input(2.0, "Stop (× ATR)", 0.5, 6, 0.5)

haut = highest(high, entree)[1]
bas  = lowest(low, sortie)[1]
plot(haut, "Plus haut")
plot(bas, "Plus bas")

long     = close > haut
exitLong = close < bas
stopLoss = multAtr * atr(14)
`,
  },
  {
    id: 'bollinger',
    kind: 'reversion',
    name: { fr: 'Bandes de Bollinger', en: 'Bollinger Bands' },
    desc: {
      fr: 'Achète une clôture sous la bande basse, revend au retour sur la moyenne centrale.',
      en: 'Buys a close below the lower band, sells on the return to the middle average.',
    },
    script: `// Retour à la moyenne sur bandes de Bollinger
longueur = input(20, "Longueur", 5, 100)
ecart = input(2.0, "Écarts types", 1, 4, 0.25)

[milieu, haute, basse] = bb(close, longueur, ecart)
plot(milieu, "Milieu")
plot(haute, "Bande haute")
plot(basse, "Bande basse")

long     = crossunder(close, basse)
exitLong = close > milieu
`,
  },
  {
    id: 'supertrend',
    kind: 'trend',
    name: { fr: 'Supertrend', en: 'Supertrend' },
    desc: {
      fr: 'Suit la direction du Supertrend : achat quand il passe sous le prix, vente à découvert quand il passe au-dessus.',
      en: 'Follows the Supertrend direction: buy when it flips below price, short when it flips above.',
    },
    script: `// Supertrend, positions dans les deux sens
facteur = input(3.0, "Facteur", 1, 6, 0.5)
periode = input(10, "Période ATR", 5, 50)

[st, direction] = supertrend(facteur, periode)
plot(st, "Supertrend")

long  = direction < 0 and direction[1] > 0
short = direction > 0 and direction[1] < 0
`,
    settings: { direction: 'both' },
  },
  {
    id: 'macd',
    kind: 'trend',
    name: { fr: 'MACD et filtre de tendance', en: 'MACD with trend filter' },
    desc: {
      fr: 'Achète quand la MACD croise sa ligne de signal au-dessus de zéro, si le prix est au-dessus de sa moyenne 200.',
      en: 'Buys when MACD crosses its signal line above zero, if price is above its 200 average.',
    },
    script: `// MACD avec filtre de tendance
rapide = input(12, "Rapide", 2, 50)
lente = input(26, "Lente", 5, 100)
signal = input(9, "Signal", 2, 50)

[ligne, sig, histo] = macd(close, rapide, lente, signal)
tendance = ema(close, 200)
plot(tendance, "EMA 200")
plot(histo, "Histogramme MACD")

long     = crossover(ligne, sig) and ligne > 0 and close > tendance
exitLong = crossunder(ligne, sig)
`,
  },
  {
    id: 'breakout_atr',
    kind: 'breakout',
    name: { fr: 'Momentum avec stop suiveur', en: 'Momentum with trailing stop' },
    desc: {
      fr: 'Achète un nouveau plus haut sur 50 barres avec un ADX fort ; la sortie se fait par stop et objectif en ATR.',
      en: 'Buys a new 50-bar high with a strong ADX; exits by ATR-based stop and target.',
    },
    script: `// Momentum : nouveau plus haut avec tendance forte
fenetre = input(50, "Plus haut sur", 10, 200)
adxMin = input(20, "ADX minimum", 10, 40)
stopAtr = input(2.0, "Stop (× ATR)", 0.5, 5, 0.5)
cibleAtr = input(4.0, "Objectif (× ATR)", 1, 10, 0.5)

[plusDI, moinsDI, force] = dmi(14, 14)
volat = atr(14)

long       = close > highest(high, fenetre)[1] and force > adxMin and plusDI > moinsDI
stopLoss   = stopAtr * volat
takeProfit = cibleAtr * volat
`,
  },
  {
    id: 'buy_hold',
    kind: 'reference',
    name: { fr: 'Achat conservé', en: 'Buy and hold' },
    desc: {
      fr: 'Achète à la première barre et ne vend jamais : la référence à battre.',
      en: 'Buys on the first bar and never sells: the benchmark to beat.',
    },
    script: `// Achat conservé : la référence
long = true
`,
  },
]

export const STARTER_SCRIPT = TEMPLATES[0].script
