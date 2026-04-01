'use client'

import { useEffect, useRef } from 'react'

export const AGENT_LIST = [
  { name: 'Explorer',    col: '#a78bfa', icon: '◎' },
  { name: 'Skeptic',     col: '#f472b6', icon: '⚡' },
  { name: 'Statistician',col: '#38bdf8', icon: '∑'  },
  { name: 'Feat.Eng',    col: '#34d399', icon: '⬡' },
  { name: 'Ethicist',    col: '#fb923c', icon: '⚖' },
  { name: 'Pragmatist',  col: '#facc15', icon: '◈' },
  { name: "Devil's Adv", col: '#f87171', icon: '∇' },
  { name: 'Optimizer',   col: '#818cf8', icon: '⟳' },
  { name: 'CodeWriter',  col: '#4ade80', icon: '{}' },
  { name: 'Architect',   col: '#c084fc', icon: '⬢' },
  { name: 'Storyteller', col: '#f9a8d4', icon: '◐' },
]

const EDGES: [number, number][] = [
  [0,1],[0,2],[1,5],[2,5],[3,7],[4,6],[5,8],[6,8],[7,8],[0,6],[2,3],[8,10],[9,8],
]

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#',''), 16)
  return [(n>>16)&255, (n>>8)&255, n&255]
}

interface Props {
  activeAgents: string[]
  doneAgents:   string[]
  done?:        boolean
}

export default function AgentCanvas({ activeAgents, doneAgents, done = false }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const activeRef  = useRef(activeAgents)
  const doneRef    = useRef(doneAgents)
  const allDoneRef = useRef(done)

  useEffect(() => { activeRef.current  = activeAgents }, [activeAgents])
  useEffect(() => { doneRef.current    = doneAgents   }, [doneAgents])
  useEffect(() => { allDoneRef.current = done         }, [done])

  useEffect(() => {
    const canvas = canvasRef.current!
    const dpr    = Math.min(window.devicePixelRatio || 1, 2)
    let W = window.innerWidth
    let H = window.innerHeight

    const resize = () => {
      canvas.width  = W * dpr
      canvas.height = H * dpr
      canvas.style.width  = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ctx = canvas.getContext('2d')!
    resize()

    // ── Starfield (static) ────────────────────────────────────────
    const stars = Array.from({ length: 500 }, () => ({
      x:  Math.random() * W,
      y:  Math.random() * H,
      r:  Math.random() * 1.1,
      op: 0.08 + Math.random() * 0.35,
    }))

    // ── Node positions on ellipse ─────────────────────────────────
    const getPositions = () => {
      const cx = W / 2, cy = H / 2
      const rx = Math.min(W * 0.40, 380)
      const ry = Math.min(H * 0.38, 260)
      return AGENT_LIST.map((_, i) => {
        const a = (i / AGENT_LIST.length) * Math.PI * 2 - Math.PI / 2
        return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }
      })
    }
    let positions = getPositions()

    const NODE_R   = Math.min(W, H) * 0.038
    const ringT    = AGENT_LIST.map((_, i) => i / AGENT_LIST.length) // stagger rings

    let t   = 0
    let raf: number

    const draw = () => {
      raf = requestAnimationFrame(draw)
      t  += 0.016

      const W2 = W, H2 = H
      ctx.clearRect(0, 0, W2, H2)

      // Background
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W2, H2)

      // Stars
      stars.forEach(s => {
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.op})`
        ctx.fill()
      })

      const active  = activeRef.current
      const done_   = doneRef.current
      const allDone = allDoneRef.current
      const cx = W2 / 2, cy = H2 / 2

      // ── Edges ───────────────────────────────────────────────────
      EDGES.forEach(([ai, bi]) => {
        const a  = positions[ai], b = positions[bi]
        const aA = active.includes(AGENT_LIST[ai].name) || active.includes(AGENT_LIST[bi].name)
        const aD = done_.includes(AGENT_LIST[ai].name)  && done_.includes(AGENT_LIST[bi].name)
        const op = aA ? 0.6 : aD ? 0.25 : 0.10
        const [ar,ag_,ab] = hexRgb(AGENT_LIST[ai].col)
        const [br,bg_,bb] = hexRgb(AGENT_LIST[bi].col)
        const gr = ctx.createLinearGradient(a.x,a.y, b.x,b.y)
        gr.addColorStop(0, `rgba(${ar},${ag_},${ab},${op})`)
        gr.addColorStop(1, `rgba(${br},${bg_},${bb},${op})`)
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y)
        ctx.strokeStyle = gr; ctx.lineWidth = aA ? 1.4 : 0.8; ctx.stroke()
      })

      // ── Center orchestrator ─────────────────────────────────────
      const cp = Math.sin(t * 2) * 0.5 + 0.5
      ;[28, 18, 10].forEach((r, i) => {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(99,102,241,${[0.06,0.12,0.9][i] * (0.7 + cp * 0.3)})`
        ctx.fill()
      })
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = `700 9px "JetBrains Mono",monospace`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('ORCH', cx, cy)

      // Dashed lines center → active nodes
      ctx.setLineDash([4, 6])
      active.forEach(name => {
        const ni  = AGENT_LIST.findIndex(a => a.name === name)
        if (ni < 0) return
        const pos = positions[ni]
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pos.x, pos.y)
        ctx.strokeStyle = `rgba(99,102,241,${0.25 + cp * 0.2})`
        ctx.lineWidth = 0.9; ctx.stroke()
      })
      ctx.setLineDash([])

      // ── Nodes ───────────────────────────────────────────────────
      AGENT_LIST.forEach((agent, i) => {
        const pos     = positions[i]
        const isActive= active.includes(agent.name)
        const isDone  = allDone || done_.includes(agent.name)
        const [cr,cg,cb] = hexRgb(agent.col)

        const aP = Math.sin(t * 4) * 0.5 + 0.5         // active pulse
        const iP = Math.sin(t * 1.1 + i * 0.65) * 0.5 + 0.5 // idle pulse
        const r  = NODE_R * (isActive ? 1 + aP * 0.18 : 0.88 + iP * 0.10)

        // Multi-layer glow
        const glowR  = r * (isActive ? 3.2 : 2.0)
        const glowOp = isActive ? 0.12 + aP * 0.12 : isDone ? 0.06 : 0.025
        const grd = ctx.createRadialGradient(pos.x,pos.y,0, pos.x,pos.y,glowR)
        grd.addColorStop(0, `rgba(${cr},${cg},${cb},${glowOp})`)
        grd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
        ctx.beginPath(); ctx.arc(pos.x,pos.y,glowR,0,Math.PI*2)
        ctx.fillStyle = grd; ctx.fill()

        // Expanding rings (active only)
        if (isActive) {
          for (let ri = 0; ri < 2; ri++) {
            const rp = ((t * 0.55 + ringT[i] + ri * 0.5) % 1)
            ctx.beginPath()
            ctx.arc(pos.x, pos.y, r * (1.1 + rp * 2.2), 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(1-rp) * 0.55})`
            ctx.lineWidth = 1.5; ctx.stroke()
          }
        }

        // Ring border
        ctx.beginPath(); ctx.arc(pos.x,pos.y,r,0,Math.PI*2)
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${isActive ? 0.9 : isDone ? 0.45 : 0.22})`
        ctx.lineWidth = isActive ? 2 : 1.2; ctx.stroke()

        // Inner fill
        const fill = ctx.createRadialGradient(pos.x,pos.y,0, pos.x,pos.y,r)
        fill.addColorStop(0, `rgba(${cr},${cg},${cb},${isActive ? 0.20 : isDone ? 0.10 : 0.05})`)
        fill.addColorStop(1, 'rgba(0,0,0,0.88)')
        ctx.beginPath(); ctx.arc(pos.x,pos.y,r-1,0,Math.PI*2)
        ctx.fillStyle = fill; ctx.fill()

        // Icon
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${isActive ? 1 : isDone ? 0.6 : 0.28})`
        ctx.font = `${Math.round(r * 0.55)}px "JetBrains Mono",monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(agent.icon, pos.x, pos.y - 2)

        // Name
        ctx.font = `500 ${Math.round(r * 0.32)}px "Space Grotesk",sans-serif`
        ctx.fillStyle = `rgba(255,255,255,${isActive ? 0.9 : isDone ? 0.40 : 0.15})`
        ctx.textBaseline = 'top'
        ctx.fillText(agent.name, pos.x, pos.y + r + 5)
      })
    }
    draw()

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight
      stars.forEach(s => { s.x = Math.random()*W; s.y = Math.random()*H })
      positions = getPositions()
      resize()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
}
