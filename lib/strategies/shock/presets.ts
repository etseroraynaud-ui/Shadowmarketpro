// Généré par research/shock/export-presets.ts depuis research/reports : ne pas modifier à la main.
// Écarts aux valeurs par défaut du script.

import type { ShockParams } from './params.ts'

type Over = Partial<ShockParams>

/** Meilleur jeu unique sur tout l'historique (walk-forward, 30 min et 15 min). */
export const WF30: Over = {"highActivityMode":false,"volWin":200,"kMain":2.5,"kMicro":2,"rangeWin":45,"wickThr":0.45,"cooldownBars":3,"htfEmaLen":80,"volZWin":65,"volZThr":0,"compThr":-0.1,"atrLen":28,"atrStopMult":0.8,"atrTrailMult":50,"useTP1":false,"tp1AtrMult":0.6,"tp1QtyPct":30,"htfSlopeMode":"htf","allowShort":false}
export const WF15: Over = {"highActivityMode":false,"volWin":100,"kMain":2.6,"kMicro":2.2,"rangeWin":40,"wickThr":0.4,"cooldownBars":9,"htfEmaLen":55,"useVolFilter":false,"volZWin":35,"volZThr":-0.2,"compThr":-0.6,"atrLen":24,"atrStopMult":2.7,"atrTrailMult":3.7,"useTP1":false,"tp1AtrMult":0.8,"tp1QtyPct":80,"allowShort":false}

/** Sélection selon la volatilité (calme / agitée) ; null = pas de trade dans ce régime. */
export const ADAPTIVE30: { calm: Over | null; agitated: Over | null } = {"calm":{"volWin":130,"kMain":2.9,"useMicroShock":false,"kMicro":1.7,"rangeWin":15,"wickThr":0.4,"cooldownBars":3,"htfEmaLen":70,"volZWin":75,"volZThr":1.3,"useCompression":true,"compThr":-0.5,"atrLen":30,"atrStopMult":3.3,"atrTrailMult":50,"useTP1":false,"tp1AtrMult":0.8,"tp1QtyPct":20,"flipMainOnly":true,"htfSlopeMode":"htf"},"agitated":{"highActivityMode":false,"volWin":170,"kMain":3,"kMicro":1.2,"rangeWin":5,"wickThr":0.7,"cooldownBars":18,"htfMinutes":1440,"volZWin":25,"volZThr":-0.3,"useCompression":true,"compThr":0.3,"atrStopMult":1.2,"atrTrailMult":50,"useTP1":false,"tp1AtrMult":1.1,"tp1QtyPct":30,"flipMainOnly":true,"htfSlopeMode":"htf","allowShort":false}}
export const ADAPTIVE15: { calm: Over | null; agitated: Over | null } = {"calm":{"volWin":130,"kMain":2.9,"useMicroShock":false,"kMicro":1.7,"rangeWin":15,"wickThr":0.4,"cooldownBars":3,"htfEmaLen":70,"volZWin":75,"volZThr":1.3,"useCompression":true,"compThr":-0.5,"atrLen":30,"atrStopMult":3.3,"atrTrailMult":50,"useTP1":false,"tp1AtrMult":0.8,"tp1QtyPct":20,"flipMainOnly":true,"htfSlopeMode":"htf"},"agitated":{"volWin":150,"kMain":2.4,"kMicro":2.2,"rangeWin":50,"wickThr":0.45,"cooldownBars":4,"htfEmaLen":65,"volZWin":25,"volZThr":-0.5,"useCompression":true,"compThr":0.2,"atrLen":22,"atrStopMult":1.1,"atrTrailMult":3.2,"tp1AtrMult":0.9,"tp1QtyPct":20,"flipMainOnly":true,"htfSlopeMode":"htf","allowShort":false}}
