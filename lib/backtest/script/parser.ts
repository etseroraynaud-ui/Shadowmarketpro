// Langage de stratégie : analyse lexicale et syntaxique.
//
// Un script est une suite de lignes « nom = expression », proche de Pine Script :
//   rapide = ema(close, input(20, "EMA rapide"))
//   long   = crossover(rapide, ema(close, 50))
// Les expressions acceptent + - * / %, les comparaisons, and/or/not, l'opérateur ?:,
// l'historique x[n], les appels de fonctions (préfixes ta. et math. acceptés) et
// les arguments nommés (minval=2).

import type { Msg } from '../types.ts'

export interface Pos {
  line: number
  col: number
}

export class ScriptError extends Error {
  pos: Pos | null
  msg: Msg
  constructor(msg: Msg, pos: Pos | null) {
    super(msg.en)
    this.msg = msg
    this.pos = pos
  }
}

export type Expr =
  | { k: 'num'; v: number; pos: Pos; bool?: boolean }
  | { k: 'str'; v: string; pos: Pos }
  | { k: 'na'; pos: Pos }
  | { k: 'id'; name: string; pos: Pos }
  | { k: 'call'; name: string; args: Expr[]; named: Record<string, Expr>; pos: Pos }
  | { k: 'un'; op: string; e: Expr; pos: Pos }
  | { k: 'bin'; op: string; a: Expr; b: Expr; pos: Pos }
  | { k: 'tern'; c: Expr; a: Expr; b: Expr; pos: Pos }
  | { k: 'idx'; e: Expr; i: Expr; pos: Pos }

export type Stmt =
  | { k: 'assign'; names: string[]; tuple: boolean; e: Expr; pos: Pos }
  | { k: 'expr'; e: Expr; pos: Pos }

interface Tok {
  t: 'num' | 'str' | 'id' | 'op' | 'nl' | 'eof'
  v: string
  pos: Pos
}

const OPS2 = ['<=', '>=', '==', '!=', ':=', '=>', '&&', '||', '+=', '-=', '*=', '/=']
const OPS1 = '+-*/%<>=?:()[],!'
const INFIX = new Set(['+', '-', '*', '/', '%', '<', '>', '<=', '>=', '==', '!=', '&&', '||', '?', ':', 'and', 'or'])
const TYPE_WORDS = new Set(['var', 'varip', 'float', 'int', 'bool', 'string', 'color', 'series', 'simple', 'const'])

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  let line = 1
  let lineStart = 0
  const pos = (): Pos => ({ line, col: i - lineStart + 1 })
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\n') {
      toks.push({ t: 'nl', v: '\n', pos: pos() })
      i++
      line++
      lineStart = i
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === ';') { i++; continue }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') { line++; lineStart = i + 1 }
        i++
      }
      i += 2
      continue
    }
    if (ch === '#') {
      // Couleur hexadécimale de Pine (#ff8800) : lue comme une chaîne.
      const p = pos()
      let j = i + 1
      while (j < src.length && /[0-9a-fA-F]/.test(src[j])) j++
      if (j - i - 1 >= 3) { toks.push({ t: 'str', v: src.slice(i, j), pos: p }); i = j; continue }
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const p = pos()
      let j = i
      while (j < src.length && /[0-9_]/.test(src[j])) j++
      if (src[j] === '.' && /[0-9]/.test(src[j + 1] || '')) { j++; while (j < src.length && /[0-9]/.test(src[j])) j++ } else if (src[j] === '.' && !/[A-Za-z_]/.test(src[j + 1] || '')) j++
      if (/[eE]/.test(src[j] || '') && /[-+0-9]/.test(src[j + 1] || '')) {
        j += 2
        while (j < src.length && /[0-9]/.test(src[j])) j++
      }
      toks.push({ t: 'num', v: src.slice(i, j).replace(/_/g, ''), pos: p })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      const p = pos()
      let j = i
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      while (src[j] === '.' && /[A-Za-z_]/.test(src[j + 1] || '')) {
        j++
        while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++
      }
      toks.push({ t: 'id', v: src.slice(i, j), pos: p })
      i = j
      continue
    }
    if (ch === '"' || ch === "'") {
      const p = pos()
      let j = i + 1
      let s = ''
      while (j < src.length && src[j] !== ch && src[j] !== '\n') {
        if (src[j] === '\\' && j + 1 < src.length) { s += src[j + 1]; j += 2 } else s += src[j++]
      }
      if (src[j] !== ch) throw new ScriptError({ fr: 'Chaîne de caractères non fermée.', en: 'Unterminated string.' }, p)
      toks.push({ t: 'str', v: s, pos: p })
      i = j + 1
      continue
    }
    const two = src.slice(i, i + 2)
    if (OPS2.includes(two)) { toks.push({ t: 'op', v: two, pos: pos() }); i += 2; continue }
    if (OPS1.includes(ch)) { toks.push({ t: 'op', v: ch, pos: pos() }); i++; continue }
    throw new ScriptError({ fr: `Caractère inattendu « ${ch} ».`, en: `Unexpected character '${ch}'.` }, pos())
  }
  toks.push({ t: 'nl', v: '\n', pos: { line, col: i - lineStart + 1 } })
  toks.push({ t: 'eof', v: '', pos: { line, col: i - lineStart + 1 } })
  // Les sauts de ligne entre parenthèses, après un opérateur ou avant un opérateur infixe
  // continuent l'instruction.
  const out: Tok[] = []
  let depth = 0
  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k]
    if (tk.t === 'op' && (tk.v === '(' || tk.v === '[')) depth++
    if (tk.t === 'op' && (tk.v === ')' || tk.v === ']')) depth = Math.max(0, depth - 1)
    if (tk.t === 'nl') {
      if (depth > 0) continue
      const prev = out[out.length - 1]
      if (prev && ((prev.t === 'op' && (INFIX.has(prev.v) || prev.v === ',' || prev.v === '=')) || (prev.t === 'id' && (prev.v === 'and' || prev.v === 'or' || prev.v === 'not')))) continue
      let m = k + 1
      while (toks[m] && toks[m].t === 'nl') m++
      const next = toks[m]
      if (next && ((next.t === 'op' && INFIX.has(next.v)) || (next.t === 'id' && (next.v === 'and' || next.v === 'or')))) continue
      if (prev && prev.t === 'nl') continue
    }
    out.push(tk)
  }
  return out
}

export function parse(src: string): Stmt[] {
  const toks = tokenize(src)
  let p = 0
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)]
  const next = () => toks[p++]
  const isOp = (v: string, o = 0) => peek(o).t === 'op' && peek(o).v === v
  const isWord = (v: string, o = 0) => peek(o).t === 'id' && peek(o).v === v
  const expectOp = (v: string) => {
    const tk = peek()
    if (tk.t === 'op' && tk.v === v) return next()
    throw new ScriptError({ fr: `« ${v} » attendu${show(tk, 'fr')}.`, en: `'${v}' expected${show(tk, 'en')}.` }, tk.pos)
  }
  const show = (tk: Tok, lang: 'fr' | 'en') => {
    if (tk.t === 'eof') return lang === 'fr' ? ' avant la fin du script' : ' before the end of the script'
    if (tk.t === 'nl') return lang === 'fr' ? ' avant la fin de la ligne' : ' before the end of the line'
    return lang === 'fr' ? ` au lieu de « ${tk.v} »` : ` instead of '${tk.v}'`
  }

  function expr(): Expr {
    return ternary()
  }
  function ternary(): Expr {
    const c = or()
    if (isOp('?')) {
      const pos = next().pos
      const a = ternary()
      expectOp(':')
      const b = ternary()
      return { k: 'tern', c, a, b, pos }
    }
    return c
  }
  function or(): Expr {
    let a = and()
    while (isWord('or') || isOp('||')) {
      const pos = next().pos
      a = { k: 'bin', op: 'or', a, b: and(), pos }
    }
    return a
  }
  function and(): Expr {
    let a = not()
    while (isWord('and') || isOp('&&')) {
      const pos = next().pos
      a = { k: 'bin', op: 'and', a, b: not(), pos }
    }
    return a
  }
  function not(): Expr {
    if (isWord('not') || isOp('!')) {
      const pos = next().pos
      return { k: 'un', op: 'not', e: not(), pos }
    }
    return cmp()
  }
  function cmp(): Expr {
    let a = add()
    while (peek().t === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(peek().v)) {
      const tk = next()
      a = { k: 'bin', op: tk.v, a, b: add(), pos: tk.pos }
    }
    return a
  }
  function add(): Expr {
    let a = mul()
    while (isOp('+') || isOp('-')) {
      const tk = next()
      a = { k: 'bin', op: tk.v, a, b: mul(), pos: tk.pos }
    }
    return a
  }
  function mul(): Expr {
    let a = unary()
    while (isOp('*') || isOp('/') || isOp('%')) {
      const tk = next()
      a = { k: 'bin', op: tk.v, a, b: unary(), pos: tk.pos }
    }
    return a
  }
  function unary(): Expr {
    if (isOp('-') || isOp('+')) {
      const tk = next()
      const e = unary()
      return tk.v === '-' ? { k: 'un', op: '-', e, pos: tk.pos } : e
    }
    return postfix()
  }
  function postfix(): Expr {
    let e = primary()
    while (isOp('[')) {
      const pos = next().pos
      const i = expr()
      expectOp(']')
      e = { k: 'idx', e, i, pos }
    }
    return e
  }
  function primary(): Expr {
    const tk = peek()
    if (tk.t === 'num') {
      next()
      return { k: 'num', v: Number(tk.v), pos: tk.pos }
    }
    if (tk.t === 'str') {
      next()
      return { k: 'str', v: tk.v, pos: tk.pos }
    }
    if (tk.t === 'op' && tk.v === '(') {
      next()
      const e = expr()
      expectOp(')')
      return e
    }
    if (tk.t === 'id') {
      next()
      if (tk.v === 'true') return { k: 'num', v: 1, pos: tk.pos, bool: true }
      if (tk.v === 'false') return { k: 'num', v: 0, pos: tk.pos, bool: true }
      if (tk.v === 'na' && !isOp('(')) return { k: 'na', pos: tk.pos }
      if (isOp('(')) {
        next()
        const args: Expr[] = []
        const named: Record<string, Expr> = {}
        if (!isOp(')')) {
          for (;;) {
            if (peek().t === 'id' && isOp('=', 1)) {
              const name = next().v
              next()
              named[name] = expr()
            } else {
              if (Object.keys(named).length) {
                throw new ScriptError({ fr: 'Un argument sans nom ne peut pas suivre un argument nommé.', en: 'A positional argument cannot follow a named one.' }, peek().pos)
              }
              args.push(expr())
            }
            if (isOp(',')) { next(); continue }
            break
          }
        }
        expectOp(')')
        return { k: 'call', name: tk.v, args, named, pos: tk.pos }
      }
      return { k: 'id', name: tk.v, pos: tk.pos }
    }
    throw new ScriptError({ fr: `Expression attendue${show(tk, 'fr')}.`, en: `Expression expected${show(tk, 'en')}.` }, tk.pos)
  }

  const stmts: Stmt[] = []
  while (peek().t !== 'eof') {
    if (peek().t === 'nl') { next(); continue }
    const start = peek()
    if (start.t === 'id' && ['if', 'for', 'while', 'switch', 'else'].includes(start.v)) {
      throw new ScriptError({
        fr: `« ${start.v} » n'existe pas ici : chaque ligne définit une série. Écrivez la condition avec and / or ou l'opérateur ?: (ex. x = cond ? a : b).`,
        en: `'${start.v}' is not supported: each line defines a series. Write the condition with and / or or the ?: operator (e.g. x = cond ? a : b).`,
      }, start.pos)
    }
    while (peek().t === 'id' && TYPE_WORDS.has(peek().v) && peek(1).t === 'id') next()
    if (isOp('[')) {
      const pos = next().pos
      const names: string[] = []
      for (;;) {
        const tk = next()
        if (tk.t !== 'id') throw new ScriptError({ fr: 'Nom de variable attendu dans [a, b, …].', en: 'Variable name expected in [a, b, …].' }, tk.pos)
        names.push(tk.v)
        if (isOp(',')) { next(); continue }
        break
      }
      expectOp(']')
      if (isOp(':=')) throw reassign(peek().pos)
      expectOp('=')
      stmts.push({ k: 'assign', names, tuple: true, e: expr(), pos })
    } else if (peek().t === 'id' && isOp('=', 1)) {
      const tk = next()
      next()
      stmts.push({ k: 'assign', names: [tk.v], tuple: false, e: expr(), pos: tk.pos })
    } else if (peek().t === 'id' && peek(1).t === 'op' && [':=', '+=', '-=', '*=', '/='].includes(peek(1).v)) {
      throw reassign(peek(1).pos)
    } else if (peek().t === 'id' && isOp('(', 1) && functionDef()) {
      throw new ScriptError({ fr: 'Les fonctions définies dans le script (=>) ne sont pas prises en charge.', en: 'Functions defined in the script (=>) are not supported.' }, peek().pos)
    } else {
      const e = expr()
      stmts.push({ k: 'expr', e, pos: start.pos })
    }
    const end = peek()
    if (end.t !== 'nl' && end.t !== 'eof') {
      throw new ScriptError({ fr: `Fin de ligne attendue au lieu de « ${end.v} ».`, en: `End of line expected instead of '${end.v}'.` }, end.pos)
    }
  }
  return stmts

  function functionDef(): boolean {
    let k = 1
    let depth = 0
    for (;;) {
      const tk = peek(k)
      if (tk.t === 'eof' || tk.t === 'nl') return false
      if (tk.t === 'op' && tk.v === '(') depth++
      if (tk.t === 'op' && tk.v === ')') {
        depth--
        if (depth === 0) return peek(k + 1).t === 'op' && peek(k + 1).v === '=>'
      }
      k++
    }
  }
}

function reassign(pos: Pos): ScriptError {
  return new ScriptError({
    fr: 'La réaffectation (:=, +=) n\'est pas prise en charge : chaque variable est une série définie une seule fois. Utilisez un nouveau nom, ou ?: pour les cas.',
    en: 'Reassignment (:=, +=) is not supported: each variable is a series defined once. Use a new name, or ?: for cases.',
  }, pos)
}
