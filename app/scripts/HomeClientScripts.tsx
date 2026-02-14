'use client'

import { useEffect } from 'react'

interface CandleData {
  o: number
  h: number
  l: number
  c: number
}

interface IndicatorConfig {
  t: string
  pitch: string
  bul: string[]
  tech: string
  ideal: string
  draw: (cv: HTMLCanvasElement) => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  s: number
  o: number
}

interface FaqItem {
  q: string
  a: string
}

function sm(a: number[], w: number): number[] {
  return a.map((_, i) => {
    const s = Math.max(0, i - w)
    const e = Math.min(a.length, i + w + 1)
    return a.slice(s, e).reduce((x, y) => x + y) / (e - s)
  })
}

function drawTCP(cv: HTMLCanvasElement) {
  const cx = cv.getContext('2d')
  if (!cx) return
  const W = cv.width = cv.offsetWidth * 2
  const H = cv.height = cv.offsetHeight * 2
  cx.fillStyle = '#040a1a'
  cx.fillRect(0, 0, W, H)
  const n = 70, g = W / n
  const data: CandleData[] = []
  let pr = 200
  for (let i = 0; i < n; i++) {
    const b = i < 20 ? .02 : i < 40 ? -.06 : i < 55 ? -.04 : .03
    const v = 3.5
    const ch = (Math.random() - .5 + b) * v
    const o = pr, c = o + ch
    data.push({ o, h: Math.max(o, c) + Math.random() * v * .35, l: Math.min(o, c) - Math.random() * v * .35, c })
    pr = c
  }
  const cl = data.map(d => d.c), sma = sm(cl, 7)
  const u1 = sma.map(v => v + 5), l1 = sma.map(v => v - 5)
  const u2 = sma.map(v => v + 9), l2 = sma.map(v => v - 9)
  const dmin = Math.min(...data.map(d => d.l), ...l2) - 3
  const dmax = Math.max(...data.map(d => d.h), ...u2) + 3
  const dr = dmax - dmin || 1
  const py = (v: number) => H - (v - dmin) / dr * H * .85 + H * .04
  cx.fillStyle = 'rgba(6,182,212,.06)'
  cx.beginPath()
  u2.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  for (let i = n - 1; i >= 0; i--) cx.lineTo(i * g, py(u1[i]))
  cx.closePath()
  cx.fill()
  cx.fillStyle = 'rgba(236,72,153,.06)'
  cx.beginPath()
  l1.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  for (let i = n - 1; i >= 0; i--) cx.lineTo(i * g, py(l2[i]))
  cx.closePath()
  cx.fill()
  cx.strokeStyle = 'rgba(6,182,212,.5)'
  cx.lineWidth = 1.5
  cx.beginPath()
  u1.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  cx.stroke()
  cx.strokeStyle = 'rgba(236,72,153,.5)'
  cx.beginPath()
  l1.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  cx.stroke()
  cx.strokeStyle = 'rgba(6,182,212,.2)'
  cx.beginPath()
  u2.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  cx.stroke()
  cx.strokeStyle = 'rgba(236,72,153,.2)'
  cx.beginPath()
  l2.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  cx.stroke()
  cx.strokeStyle = 'rgba(59,130,246,.35)'
  cx.lineWidth = 1
  cx.setLineDash([5, 5])
  cx.beginPath()
  sma.forEach((v, i) => { i === 0 ? cx.moveTo(i * g, py(v)) : cx.lineTo(i * g, py(v)) })
  cx.stroke()
  cx.setLineDash([])
  data.forEach((d, i) => {
    const bull = d.c >= d.o
    cx.strokeStyle = bull ? 'rgba(34,197,94,.5)' : 'rgba(239,68,68,.5)'
    cx.lineWidth = 1
    cx.beginPath()
    cx.moveTo(i * g + g * .4, py(d.h))
    cx.lineTo(i * g + g * .4, py(d.l))
    cx.stroke()
    cx.fillStyle = bull ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)'
    cx.fillRect(i * g + g * .2, py(Math.max(d.o, d.c)), g * .4, py(Math.min(d.o, d.c)) - py(Math.max(d.o, d.c)) || 1)
  })
}

function drawOSC(cv: HTMLCanvasElement) {
  const cx = cv.getContext('2d')
  if (!cx) return
  const W = cv.width = cv.offsetWidth * 2
  const H = cv.height = cv.offsetHeight * 2
  cx.fillStyle = '#040a1a'
  cx.fillRect(0, 0, W, H)
  const n = 50, g = W / n, fs = Math.max(W * .014, 10)
  const cH = H * .52, oY = H * .55, oH = H * .4
  const data: CandleData[] = []
  let pr = 50
  for (let i = 0; i < n; i++) {
    const ph = i < 12 ? .1 : i < 20 ? -.05 : i < 30 ? .02 : i < 40 ? -.08 : .06
    const v = 2.5
    const ch = (Math.random() - .5 + ph) * v
    const o = pr, c = o + ch
    data.push({ o, h: Math.max(o, c) + Math.random() * v * .3, l: Math.min(o, c) - Math.random() * v * .3, c })
    pr = c
  }
  const dmin = Math.min(...data.map(d => d.l)), dmax = Math.max(...data.map(d => d.h)), dr = dmax - dmin || 1
  const cpy = (v: number) => cH - (v - dmin) / dr * cH * .85 + H * .02
  data.forEach((d, i) => {
    const bull = d.c >= d.o
    cx.strokeStyle = bull ? 'rgba(34,197,94,.5)' : 'rgba(239,68,68,.5)'
    cx.lineWidth = 1
    cx.beginPath()
    cx.moveTo(i * g + g * .4, cpy(d.h))
    cx.lineTo(i * g + g * .4, cpy(d.l))
    cx.stroke()
    cx.fillStyle = bull ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)'
    cx.fillRect(i * g + g * .2, cpy(Math.max(d.o, d.c)), g * .4, cpy(Math.min(d.o, d.c)) - cpy(Math.max(d.o, d.c)) || 1)
  })
  cx.font = `bold ${fs}px sans-serif`
  const labels = [{ i: 4, t: 'FBO?', c: '#22c55e' }, { i: 10, t: 'FBO?', c: '#22c55e' }, { i: 16, t: 'EXH', c: '#f472b6' }, { i: 38, t: 'EXH', c: '#f472b6' }]
  labels.forEach(l => { cx.fillStyle = l.c; cx.fillText(l.t, l.i * g, oY + 14) })
  const oc1: number[] = [], oc2: number[] = []
  for (let i = 0; i < n; i++) {
    oc1.push(Math.sin(i * .22) * 40 + Math.cos(i * .1) * 22 + (Math.random() - .5) * 10)
    oc2.push(Math.sin(i * .16 + .8) * 28 + Math.cos(i * .08 + .3) * 20 + (Math.random() - .5) * 7)
  }
  const os1 = sm(oc1, 2), os2 = sm(oc2, 3), oMid = oY + oH * .5 + 8, oSc = oH * .34
  const omx = Math.max(...os1.map(Math.abs), ...os2.map(Math.abs)) || 1
  cx.beginPath()
  cx.fillStyle = 'rgba(34,197,94,.15)'
  os1.forEach((v, i) => { const px = i * g; const py2 = oMid - Math.max(0, v) / omx * oSc; i === 0 ? cx.moveTo(px, py2) : cx.lineTo(px, py2) })
  cx.lineTo(W, oMid)
  cx.lineTo(0, oMid)
  cx.closePath()
  cx.fill()
  cx.beginPath()
  cx.strokeStyle = 'rgba(34,197,94,.45)'
  cx.lineWidth = 1.5
  os1.forEach((v, i) => { const px = i * g; const py2 = oMid - v / omx * oSc; i === 0 ? cx.moveTo(px, py2) : cx.lineTo(px, py2) })
  cx.stroke()
  cx.beginPath()
  cx.fillStyle = 'rgba(99,102,241,.18)'
  os2.forEach((v, i) => { const px = i * g; const py2 = oMid - Math.min(0, v) / omx * oSc; i === 0 ? cx.moveTo(px, py2) : cx.lineTo(px, py2) })
  cx.lineTo(W, oMid)
  cx.lineTo(0, oMid)
  cx.closePath()
  cx.fill()
  cx.beginPath()
  cx.strokeStyle = 'rgba(99,102,241,.45)'
  cx.lineWidth = 1
  os2.forEach((v, i) => { const px = i * g; const py2 = oMid - v / omx * oSc * .7; i === 0 ? cx.moveTo(px, py2) : cx.lineTo(px, py2) })
  cx.stroke()
  for (let i = 0; i < n; i++) {
    const v = os1[i] * .3 + os2[i] * .2
    const bh = Math.abs(v) / omx * oSc * .45
    cx.fillStyle = v >= 0 ? 'rgba(249,168,37,.35)' : 'rgba(249,168,37,.18)'
    cx.fillRect(i * g + g * .15, v >= 0 ? oMid - bh : oMid, g * .3, bh)
  }
  ;[5, 12, 20, 28, 35, 42].forEach(idx => {
    if (idx < n) {
      cx.strokeStyle = 'rgba(59,130,246,.35)'
      cx.lineWidth = 1.5
      cx.beginPath()
      cx.arc(idx * g + g * .3, oMid - os1[idx] / omx * oSc * .3, 4, 0, Math.PI * 2)
      cx.stroke()
    }
  })
  let iN = false, ns2 = 0
  for (let i = 0; i <= n; i++) {
    const neg = i < n && os2[i] < -8
    if (neg && !iN) { iN = true; ns2 = i }
    if ((!neg || i === n) && iN) { iN = false; cx.strokeStyle = 'rgba(239,68,68,.25)'; cx.lineWidth = 1.5; cx.strokeRect(ns2 * g, oMid, (i - ns2) * g, oSc * .65) }
  }
  cx.fillStyle = '#06b6d4'
  cx.fillText('SQZ', W * .52, oY + oH - 12)
  cx.beginPath()
  cx.arc(W * .52 + fs * 2.5, oY + oH - 16, 5, 0, Math.PI * 2)
  cx.fill()
  cx.strokeStyle = 'rgba(255,255,255,.04)'
  cx.setLineDash([4, 4])
  cx.lineWidth = .5
  cx.beginPath()
  cx.moveTo(0, oMid)
  cx.lineTo(W, oMid)
  cx.stroke()
  cx.setLineDash([])
}

function drawMRE(cv: HTMLCanvasElement) {
  const cx = cv.getContext('2d')
  if (!cx) return
  const W = cv.width = cv.offsetWidth * 2
  const H = cv.height = cv.offsetHeight * 2
  cx.fillStyle = '#040a1a'
  cx.fillRect(0, 0, W, H)
  const n = 60, g = W / n, fs = Math.max(W * .013, 9)
  const cH = H * .50, oY = H * .54, oH = H * .42
  const data: CandleData[] = []
  let pr = 160
  for (let i = 0; i < n; i++) {
    const ph = i < 8 ? .04 : i < 18 ? .02 : i < 28 ? -.01 : i < 38 ? -.12 : i < 48 ? -.08 : .02
    const v = i < 28 ? 2 : i < 48 ? 4 : 2.5
    const ch = (Math.random() - .5 + ph) * v
    const o = pr, c = o + ch
    data.push({ o, h: Math.max(o, c) + Math.random() * v * .3, l: Math.min(o, c) - Math.random() * v * .3, c })
    pr = c
  }
  const dmin = Math.min(...data.map(d => d.l)), dmax = Math.max(...data.map(d => d.h)), dr = dmax - dmin || 1
  const cpy = (v: number) => cH - (v - dmin) / dr * cH * .88 + H * .02
  cx.strokeStyle = 'rgba(255,255,255,.04)'
  cx.setLineDash([6, 5])
  cx.lineWidth = .7
  cx.beginPath()
  cx.moveTo(0, cH * .3)
  cx.lineTo(W, cH * .3)
  cx.stroke()
  cx.beginPath()
  cx.moveTo(0, cH * .6)
  cx.lineTo(W, cH * .6)
  cx.stroke()
  cx.setLineDash([])
  data.forEach((d, i) => {
    const bull = d.c >= d.o
    const col = bull ? 'rgba(255,255,255,.65)' : 'rgba(239,68,68,.65)'
    cx.strokeStyle = col
    cx.lineWidth = 1
    cx.beginPath()
    cx.moveTo(i * g + g * .45, cpy(d.h))
    cx.lineTo(i * g + g * .45, cpy(d.l))
    cx.stroke()
    cx.fillStyle = bull ? 'rgba(255,255,255,.55)' : 'rgba(239,68,68,.55)'
    const top = cpy(Math.max(d.o, d.c)), bot = cpy(Math.min(d.o, d.c))
    cx.fillRect(i * g + g * .2, top, g * .5, Math.max(1, bot - top))
  })
  cx.strokeStyle = 'rgba(255,255,255,.06)'
  cx.lineWidth = 1
  cx.beginPath()
  cx.moveTo(0, oY - 4)
  cx.lineTo(W, oY - 4)
  cx.stroke()
  const oMid = oY + oH * .45
  const regBars: number[] = []
  for (let i = 0; i < n; i++) {
    const bias = data[i].c > data[Math.max(0, i - 3)]?.c ? 1 : data[i].c < data[Math.max(0, i - 3)]?.c ? -1 : 0
    regBars.push(bias)
  }
  const barH = oH * .04
  regBars.forEach((b, i) => { cx.fillStyle = b >= 0 ? 'rgba(34,197,94,.6)' : 'rgba(200,50,200,.6)'; cx.fillRect(i * g, oY, g - 1, barH) })
  cx.font = `bold ${fs}px sans-serif`
  const labels = [{ i: 6, t: 'FBO?', c: '#22c55e' }, { i: 14, t: 'FBO?', c: '#22c55e' }, { i: 20, t: 'FBO?', c: '#22c55e' }, { i: 30, t: 'EXH', c: '#f472b6' }, { i: 40, t: 'EXH', c: '#f472b6' }, { i: 50, t: 'FBO?', c: '#22c55e' }]
  labels.forEach(l => { if (l.i < n) { cx.fillStyle = l.c; cx.fillText(l.t, l.i * g, oY + barH + fs + 4) } })
  labels.forEach(l => {
    if (l.i < n) {
      const dx = l.i * g + fs * 1.2, dy = oY + barH + 2
      cx.fillStyle = 'rgba(200,50,200,.7)'
      cx.beginPath()
      cx.moveTo(dx, dy - 4)
      cx.lineTo(dx + 4, dy)
      cx.lineTo(dx, dy + 4)
      cx.lineTo(dx - 4, dy)
      cx.closePath()
      cx.fill()
    }
  })
  const wave1: number[] = [], wave2: number[] = [], wave3: number[] = []
  for (let i = 0; i < n; i++) {
    wave1.push(Math.sin(i * .18) * 30 + Math.cos(i * .09) * 18 + (Math.random() - .5) * 6)
    wave2.push(Math.sin(i * .14 + .5) * 22 + Math.cos(i * .07 + .2) * 15 + (Math.random() - .5) * 5)
    wave3.push(Math.sin(i * .2 + 1) * 35 + Math.cos(i * .12 + .7) * 20 + (Math.random() - .5) * 8)
  }
  const sw1 = sm(wave1, 2), sw2 = sm(wave2, 3), sw3 = sm(wave3, 2)
  const wMax = Math.max(...sw1.map(Math.abs), ...sw2.map(Math.abs), ...sw3.map(Math.abs)) || 1
  const wSc = oH * .28, wBase = oMid + oH * .08
  cx.beginPath()
  cx.fillStyle = 'rgba(34,197,94,.12)'
  sw1.forEach((v, i) => { const py2 = wBase - Math.max(0, v) / wMax * wSc; i === 0 ? cx.moveTo(i * g, py2) : cx.lineTo(i * g, py2) })
  cx.lineTo((n - 1) * g, wBase)
  cx.lineTo(0, wBase)
  cx.closePath()
  cx.fill()
  cx.beginPath()
  cx.fillStyle = 'rgba(168,85,247,.15)'
  sw3.forEach((v, i) => { const py2 = wBase - Math.min(0, v) / wMax * wSc; i === 0 ? cx.moveTo(i * g, py2) : cx.lineTo(i * g, py2) })
  cx.lineTo((n - 1) * g, wBase)
  cx.lineTo(0, wBase)
  cx.closePath()
  cx.fill()
  cx.beginPath()
  cx.strokeStyle = 'rgba(34,197,94,.55)'
  cx.lineWidth = 1.8
  sw1.forEach((v, i) => { const py2 = wBase - v / wMax * wSc; i === 0 ? cx.moveTo(i * g, py2) : cx.lineTo(i * g, py2) })
  cx.stroke()
  cx.beginPath()
  cx.strokeStyle = 'rgba(249,168,37,.55)'
  cx.lineWidth = 1.2
  sw2.forEach((v, i) => { const py2 = wBase - v / wMax * wSc * .7; i === 0 ? cx.moveTo(i * g, py2) : cx.lineTo(i * g, py2) })
  cx.stroke()
  cx.beginPath()
  cx.strokeStyle = 'rgba(236,72,200,.6)'
  cx.lineWidth = 2
  sw3.forEach((v, i) => { const py2 = wBase - v / wMax * wSc * .85; i === 0 ? cx.moveTo(i * g, py2) : cx.lineTo(i * g, py2) })
  cx.stroke()
  cx.beginPath()
  cx.strokeStyle = 'rgba(180,180,180,.2)'
  cx.lineWidth = 1
  sw1.forEach((v, i) => { const py2 = wBase - v / wMax * wSc * .5 + 4; i === 0 ? cx.moveTo(i * g, py2) : cx.lineTo(i * g, py2) })
  cx.stroke()
  const boxZones = [{ s: 18, e: 28 }, { s: 32, e: 42 }, { s: 46, e: 54 }]
  boxZones.forEach(z => { cx.strokeStyle = 'rgba(239,68,68,.3)'; cx.lineWidth = 1.5; cx.strokeRect(z.s * g, wBase - wSc * .6, (z.e - z.s) * g, wSc * 1.3) })
  ;[6, 14, 20, 50].forEach(i => { if (i < n) { cx.strokeStyle = 'rgba(34,197,94,.15)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(i * g, oY + barH); cx.lineTo(i * g, oY + oH); cx.stroke() } })
  cx.strokeStyle = 'rgba(255,255,255,.06)'
  cx.setLineDash([4, 4])
  cx.lineWidth = .5
  cx.beginPath()
  cx.moveTo(0, wBase)
  cx.lineTo(W, wBase)
  cx.stroke()
  cx.setLineDash([])
  const sqY = oY + oH - oH * .06
  for (let i = 0; i < n; i++) {
    const v = sw1[i] + sw3[i] * .5
    cx.fillStyle = v > 5 ? 'rgba(34,197,94,.5)' : v < -5 ? 'rgba(239,68,68,.4)' : 'rgba(200,50,200,.3)'
    cx.fillRect(i * g + 1, sqY, g - 2, oH * .05)
  }
}

function drawATTD(cv: HTMLCanvasElement) {
  const cx = cv.getContext('2d')
  if (!cx) return
  const W = cv.width = cv.offsetWidth * 2
  const H = cv.height = cv.offsetHeight * 2
  cx.fillStyle = '#040a1a'
  cx.fillRect(0, 0, W, H)
  const n = 60, g = W / n, cH = H * .54, oY = H * .58, oH = H * .36
  const data: CandleData[] = []
  let pr = 120
  for (let i = 0; i < n; i++) {
    const ph = i < 20 ? .07 : i < 40 ? .01 : .05
    const v = i < 20 ? 3 : i < 40 ? 2 : 3.5
    const ch = (Math.random() - .5 + ph) * v
    const o = pr, c = o + ch
    data.push({ o, h: Math.max(o, c) + Math.random() * v * .4, l: Math.min(o, c) - Math.random() * v * .4, c })
    pr = c
  }
  const dmin = Math.min(...data.map(d => d.l)), dmax = Math.max(...data.map(d => d.h)), dr = dmax - dmin || 1
  const cpy = (v: number) => cH - (v - dmin) / dr * cH * .85 + H * .02
  cx.strokeStyle = 'rgba(255,255,255,.05)'
  cx.setLineDash([8, 6])
  cx.lineWidth = 1
  cx.beginPath()
  cx.moveTo(0, cH * .35)
  cx.lineTo(W, cH * .35)
  cx.stroke()
  cx.beginPath()
  cx.moveTo(0, cH * .75)
  cx.lineTo(W, cH * .75)
  cx.stroke()
  cx.setLineDash([])
  data.forEach((d, i) => {
    const bull = d.c >= d.o
    const col = bull ? 'rgba(34,197,94,.7)' : 'rgba(239,68,68,.7)'
    cx.strokeStyle = col
    cx.lineWidth = 1
    cx.beginPath()
    cx.moveTo(i * g + g * .4, cpy(d.h))
    cx.lineTo(i * g + g * .4, cpy(d.l))
    cx.stroke()
    cx.fillStyle = col
    cx.fillRect(i * g + g * .22, cpy(Math.max(d.o, d.c)), g * .36, cpy(Math.min(d.o, d.c)) - cpy(Math.max(d.o, d.c)) || 1)
  })
  cx.fillStyle = 'rgba(6,182,212,.04)'
  cx.fillRect(0, oY, W, oH)
  cx.strokeStyle = 'rgba(6,182,212,.2)'
  cx.lineWidth = 1
  cx.beginPath()
  cx.moveTo(0, oY + oH * .15)
  cx.lineTo(W, oY + oH * .15)
  cx.stroke()
  cx.beginPath()
  cx.moveTo(0, oY + oH * .85)
  cx.lineTo(W, oY + oH * .85)
  cx.stroke()
  const mom = data.map(d => (d.c - d.o) / dr * 120 + (Math.random() - .5) * 5)
  const mMax = Math.max(...mom.map(Math.abs)) || 1
  const mMid = oY + oH * .5
  mom.forEach((v, i) => {
    const bw = g * .5
    const bh = Math.abs(v) / mMax * (oH * .3)
    cx.fillStyle = v >= 0 ? 'rgba(34,197,94,.5)' : 'rgba(239,68,68,.5)'
    cx.fillRect(i * g + g * .15, v >= 0 ? mMid - bh : mMid, bw, bh)
  })
}

function initParticles() {
  const c = document.getElementById('pc') as HTMLCanvasElement
  if (!c) return
  const x = c.getContext('2d')
  if (!x) return
  let ps: Particle[] = []
  function r() {
    c.width = innerWidth
    c.height = innerHeight
    ps = []
    const n = Math.min(Math.floor(c.width * c.height / 35000), 30)
    for (let i = 0; i < n; i++) ps.push({ x: Math.random() * c.width, y: Math.random() * c.height, vx: (Math.random() - .5) * .07, vy: (Math.random() - .5) * .07, s: Math.random() * 1 + .3, o: Math.random() * .1 + .02 })
  }
  function d() {
    x!.clearRect(0, 0, c.width, c.height)
    ps.forEach(p => {
      p.x += p.vx; p.y += p.vy
      if (p.x < 0) p.x = c.width; if (p.x > c.width) p.x = 0
      if (p.y < 0) p.y = c.height; if (p.y > c.height) p.y = 0
      x!.beginPath(); x!.arc(p.x, p.y, p.s, 0, Math.PI * 2)
      x!.fillStyle = `rgba(6,182,212,${p.o})`; x!.fill()
    })
    requestAnimationFrame(d)
  }
  r(); d(); window.addEventListener('resize', r)
}

function initHeroBg() {
  const cv = document.getElementById('heroBg') as HTMLCanvasElement
  if (!cv) return
  const cx = cv.getContext('2d')
  if (!cx) return
  function resize() {
    const parent = cv.parentElement
    if (!parent) return
    cv.width = parent.offsetWidth * 2
    cv.height = parent.offsetHeight * 2
    draw()
  }
  function draw() {
    const W = cv.width, H = cv.height
    cx!.clearRect(0, 0, W, H)
    const n = 90, g = W / n, cw = g * .5
    let p = H * .32
    const ps: number[] = []
    for (let i = 0; i < n; i++) {
      const ph = i < 45 ? .05 : i < 60 ? -.01 : -.12
      p += ((Math.random() - .5) + ph) * (H * .007)
      p = Math.max(H * .1, Math.min(H * .9, p))
      ps.push(p)
    }
    cx!.strokeStyle = 'rgba(6,182,212,.04)'
    cx!.lineWidth = 1
    for (let y = 0; y < H; y += H / 7) { cx!.beginPath(); cx!.moveTo(0, y); cx!.lineTo(W, y); cx!.stroke() }
    for (let i = 0; i < n; i++) {
      const o = ps[i], c2 = ps[i] + (Math.random() - .5) * H * .018
      const hi = Math.min(o, c2) - Math.random() * H * .01
      const lo = Math.max(o, c2) + Math.random() * H * .01
      const xPos = i * g + g * .2
      const bull = c2 < o
      cx!.strokeStyle = bull ? 'rgba(6,182,212,.3)' : 'rgba(59,130,246,.18)'
      cx!.lineWidth = 1.5
      cx!.beginPath(); cx!.moveTo(xPos + cw / 2, hi); cx!.lineTo(xPos + cw / 2, lo); cx!.stroke()
      cx!.fillStyle = bull ? 'rgba(6,182,212,.25)' : 'rgba(59,130,246,.12)'
      cx!.fillRect(xPos, Math.min(o, c2), cw, Math.abs(c2 - o) || 2)
    }
  }
  resize(); window.addEventListener('resize', resize)
}

function initNavScroll() {
  const handleScroll = () => {
    const nv = document.getElementById('nv')
    if (nv) nv.classList.toggle('sc', window.scrollY > 20)
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
}

function buildIndicatorCards() {
  const inds: IndicatorConfig[] = [
    { t: "Trend Channel Pro", pitch: "Adaptive Gaussian channel with trap detection and internal momentum reading.", bul: ["Immediate visual reading of directional bias and probability zones", "Early reversal detection via early flip and residual Z-score", "Automatic trap identification: false breakouts, volume divergences"], tech: "Built on a multi-kernel trend engine with adaptive bands modulated by an institutional flow proxy.", ideal: "Ideal for: swing trading, entry/exit zones, false signal filtering.", draw: drawTCP },
    { t: "Oscillator MarketTiming", pitch: "One of the only indicators in the suite to generate explicit actionable signals.", bul: ["Gold Long / Gold Short / Early signals with multi-condition validation", "Combination of momentum, mean reversion and noise filters", "Clean conditional alerts — every signal is a setup"], tech: "Regime + timing + cross-validation logic. Signals emitted only when multiple conditions converge.", ideal: "Ideal for: entry timing, setup confirmation.", draw: drawOSC },
    { t: "Markov Regime Engine (MRE-VWAP)", pitch: "Quantitative regime classification engine built on Markov modeling, VWAP structure and conditional probability.", bul: ["Segments the market from price–VWAP structure, spread volatility, and normalized momentum", "Continuous Regime Wave synthesizes directional probability, chaos risk, and conditional expectancy", "Identifies when the market allows a real edge — not what to trade, but when to trade"], tech: "Markov-based state estimation using VWAP directional structure, volatility compression/expansion, and conditional regime transitions.", ideal: "Ideal for: regime filtering, setup qualification, risk context.", draw: drawMRE },
    { t: "True Adaptive Trend Detector", pitch: "Macro-directional bias via adaptive filtering and oscillator transformation.", bul: ["Clean directional bias via adaptive price series filtering", "Color-coded histogram by OB/OS zones with midline", "Macro-regime reading to confirm or invalidate a bias"], tech: "Adaptive filtering on the price series before derivation of a transformed oscillator.", ideal: "Ideal for: directional bias confirmation, macro-regime reading.", draw: drawATTD }
  ]
  const ig2 = document.getElementById('ig')
  if (!ig2) return
  inds.forEach((ind, i) => {
    const el = document.createElement('div')
    el.className = 'gl glh ic'
    el.innerHTML = `<div class="iss"><canvas id="c${i}"></canvas></div><div class="ib"><h3>${ind.t}</h3><div class="pitch">${ind.pitch}</div><ul class="ibu">${ind.bul.map(b => `<li>${b}</li>`).join('')}</ul><div class="tech-block">${ind.tech}</div><div class="ideal">${ind.ideal}</div></div>`
    ig2.appendChild(el)
  })
  setTimeout(() => { inds.forEach((ind, i) => { const cv = document.getElementById('c' + i) as HTMLCanvasElement; if (cv) ind.draw(cv) }) }, 60)
  window.addEventListener('resize', () => { inds.forEach((ind, i) => { const cv = document.getElementById('c' + i) as HTMLCanvasElement; if (cv) ind.draw(cv) }) })
}

function buildFaq() {
  const faqs: FaqItem[] = [
    { q: "What markets are supported?", a: "Forex, stocks, indices, crypto, commodities and futures." },
    { q: "How is access delivered?", a: "After verification, your TradingView username is added to private access." },
    { q: "How long after payment?", a: "Usually 1 to 12 hours. Up to 24 hours during high demand periods." },
    { q: "Refund policy?", a: "No refunds once access has been activated." },
    { q: "Suitable for beginners?", a: "Yes, the interface is clean. A basic understanding of technical analysis is recommended." },
    { q: "Are alerts included?", a: "Yes, fully integrated: email, mobile push or webhook." },
    { q: "Can I change plans?", a: "Upgrade anytime. Downgrade at end of period." },
    { q: "What cryptocurrencies are accepted?", a: "USDT on BSC (BEP20) and USDT on TRON (TRC20)." },
    { q: "What is the Lifetime plan?", a: "A one-time payment of $1,599 for permanent access to all current indicators only (not the future indicators). Limited to the first 50 members — after that, only annual subscriptions will be available." }
  ]
  const fb2 = document.getElementById('fb')
  if (!fb2) return
  faqs.forEach(f => {
    const el = document.createElement('div')
    el.className = 'fqi'
    el.innerHTML = `<button class="fqb"><span>${f.q}</span><span class="fqc"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M2 4l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><div class="fqa"><p>${f.a}</p></div>`
    const btn = el.querySelector('.fqb')
    if (btn) {
      btn.addEventListener('click', () => {
        const isOpen = el.classList.contains('open')
        document.querySelectorAll('.fqi').forEach(e => e.classList.remove('open'))
        if (!isOpen) el.classList.add('open')
      })
    }
    fb2.appendChild(el)
  })
}

export default function HomeClientScripts() {
  useEffect(() => {
    initParticles()
    initHeroBg()
    initNavScroll()
    buildIndicatorCards()
    buildFaq()
  }, [])
  return null
}
