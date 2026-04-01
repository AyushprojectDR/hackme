'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Agent definitions ─────────────────────────────────────────────────
export const AGENT_THEMES: Record<string, {
  color: string
  glow: string
  icon: string
  role: string
  tagline: string
  animation: 'radar' | 'matrix' | 'bars' | 'circuit' | 'scales' | 'gears' | 'lightning' | 'waves' | 'scan' | 'rain'
}> = {
  'Explorer': {
    color:     '#a78bfa',
    glow:      'rgba(167,139,250,0.15)',
    icon:      '◎',
    role:      'Data Explorer',
    tagline:   'Mapping the landscape of your data',
    animation: 'radar',
  },
  'Skeptic': {
    color:     '#f472b6',
    glow:      'rgba(244,114,182,0.15)',
    icon:      '⚡',
    role:      'Critical Analyst',
    tagline:   'Challenging every assumption',
    animation: 'lightning',
  },
  'Statistician': {
    color:     '#38bdf8',
    glow:      'rgba(56,189,248,0.15)',
    icon:      '∑',
    role:      'Statistical Engine',
    tagline:   'Finding signal in the noise',
    animation: 'bars',
  },
  'Feat.Eng': {
    color:     '#34d399',
    glow:      'rgba(52,211,153,0.15)',
    icon:      '⬡',
    role:      'Feature Engineer',
    tagline:   'Crafting predictive signals',
    animation: 'circuit',
  },
  'Ethicist': {
    color:     '#fb923c',
    glow:      'rgba(251,146,60,0.15)',
    icon:      '⚖',
    role:      'Ethics Guardian',
    tagline:   'Ensuring fairness and responsibility',
    animation: 'scales',
  },
  'Pragmatist': {
    color:     '#facc15',
    glow:      'rgba(250,204,21,0.15)',
    icon:      '◈',
    role:      'Pragmatic Advisor',
    tagline:   'What works in the real world',
    animation: 'gears',
  },
  "Devil's Adv": {
    color:     '#f87171',
    glow:      'rgba(248,113,113,0.15)',
    icon:      '∇',
    role:      "Devil's Advocate",
    tagline:   'Stress-testing every decision',
    animation: 'waves',
  },
  'Optimizer': {
    color:     '#818cf8',
    glow:      'rgba(129,140,248,0.15)',
    icon:      '⟳',
    role:      'Optimizer',
    tagline:   'Converging on the best solution',
    animation: 'waves',
  },
  'Diagnostic': {
    color:     '#22d3ee',
    glow:      'rgba(34,211,238,0.15)',
    icon:      '◉',
    role:      'Diagnostic Agent',
    tagline:   'Deep scan in progress',
    animation: 'scan',
  },
  'CodeWriter': {
    color:     '#4ade80',
    glow:      'rgba(74,222,128,0.15)',
    icon:      '{ }',
    role:      'Code Writer',
    tagline:   'Translating insight into code',
    animation: 'rain',
  },
  'Architect': {
    color:     '#c084fc',
    glow:      'rgba(192,132,252,0.15)',
    icon:      '⬢',
    role:      'Model Architect',
    tagline:   'Designing the optimal structure',
    animation: 'circuit',
  },
  'Storyteller': {
    color:     '#f9a8d4',
    glow:      'rgba(249,168,212,0.15)',
    icon:      '◐',
    role:      'Storyteller',
    tagline:   'Weaving insights into narrative',
    animation: 'radar',
  },
}

// ── Radar animation ───────────────────────────────────────────────────
function RadarCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    const cx = cv.width / 2, cy = cv.height / 2
    const R = Math.min(cx, cy) * 0.85
    let angle = 0, raf: number
    const dots: { a: number; r: number; life: number }[] = []

    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, cv.width, cv.height)

      // Rings
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${hexToRgb(color)},0.12)`
        ctx.lineWidth = 1
        ctx.stroke()
      }
      // Cross
      ctx.strokeStyle = `rgba(${hexToRgb(color)},0.1)`
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke()

      // Sweep
      // sweep placeholder (conical gradient not standard)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      const g = ctx.createLinearGradient(0, 0, R, 0)
      g.addColorStop(0, `rgba(${hexToRgb(color)},0.0)`)
      g.addColorStop(1, `rgba(${hexToRgb(color)},0.35)`)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, R, -0.6, 0)
      ctx.closePath()
      ctx.fillStyle = g
      ctx.fill()
      ctx.restore()

      // Sweep line
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R)
      ctx.strokeStyle = `rgba(${hexToRgb(color)},0.7)`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Random dots
      if (Math.random() < 0.08) {
        dots.push({ a: angle + (Math.random() - 0.5) * 0.3, r: Math.random() * R * 0.9 + R * 0.05, life: 1 })
      }
      dots.forEach((d, i) => {
        d.life -= 0.012
        if (d.life <= 0) { dots.splice(i, 1); return }
        const x = cx + Math.cos(d.a) * d.r, y = cy + Math.sin(d.a) * d.r
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${hexToRgb(color)},${d.life * 0.9})`
        ctx.fill()
      })

      angle += 0.018
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Matrix rain ───────────────────────────────────────────────────────
function MatrixCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    const cols = Math.floor(cv.width / 20)
    const drops = Array(cols).fill(0).map(() => Math.random() * cv.height / 18)
    let raf: number
    const CHARS = '01アイウエオカキクケコ∑∇⬡◎'

    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.fillStyle = 'rgba(0,0,0,0.06)'
      ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.font = '14px JetBrains Mono, monospace'
      drops.forEach((y, i) => {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        ctx.fillStyle = `rgba(${hexToRgb(color)},${0.3 + Math.random() * 0.7})`
        ctx.fillText(char, i * 20, y * 18)
        if (y * 18 > cv.height && Math.random() > 0.975) drops[i] = 0
        else drops[i] += 0.5
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Bars animation ────────────────────────────────────────────────────
function BarsCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    const N = 24
    const targets = Array(N).fill(0).map(() => Math.random())
    const current = Array(N).fill(0).map(() => Math.random())
    let raf: number
    let t = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      t += 0.02
      ctx.clearRect(0, 0, cv.width, cv.height)

      const w = cv.width / N
      current.forEach((v, i) => {
        current[i] += (targets[i] - v) * 0.04
        if (Math.abs(targets[i] - current[i]) < 0.01) targets[i] = 0.1 + Math.random() * 0.85

        const h = current[i] * cv.height * 0.7
        const x = i * w + w * 0.15
        const bw = w * 0.7
        const y = cv.height - h

        const g = ctx.createLinearGradient(0, y, 0, cv.height)
        g.addColorStop(0, `rgba(${hexToRgb(color)},0.8)`)
        g.addColorStop(1, `rgba(${hexToRgb(color)},0.1)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x, y, bw, h, 3)
        ctx.fill()
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Scan lines ────────────────────────────────────────────────────────
function ScanCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    let y = 0, raf: number

    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, cv.width, cv.height)

      // Horizontal scan lines
      for (let i = 0; i < cv.height; i += 4) {
        const dist = Math.abs(i - y)
        const alpha = Math.max(0, 1 - dist / 80) * 0.15
        ctx.fillStyle = `rgba(${hexToRgb(color)},${alpha})`
        ctx.fillRect(0, i, cv.width, 2)
      }

      // Main scan beam
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 40)
      g.addColorStop(0, 'transparent')
      g.addColorStop(0.5, `rgba(${hexToRgb(color)},0.6)`)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(0, y - 40, cv.width, 80)

      y = (y + 1.5) % cv.height
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Wave rings ────────────────────────────────────────────────────────
function WaveCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    const cx = cv.width / 2, cy = cv.height / 2
    let t = 0, raf: number

    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, cv.width, cv.height)
      t += 0.025

      for (let i = 0; i < 6; i++) {
        const phase = (t + i * 0.6) % (Math.PI * 2)
        const r = 30 + ((t * 40 + i * 55) % 220)
        const alpha = (1 - r / 220) * 0.5
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${hexToRgb(color)},${alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Circuit lines ─────────────────────────────────────────────────────
function CircuitCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    const GRID = 40
    const cols = Math.ceil(cv.width / GRID)
    const rows = Math.ceil(cv.height / GRID)
    let raf: number

    // Pre-generate circuit paths
    const paths: { x: number; y: number; dir: number; progress: number; speed: number; alpha: number }[] = []
    for (let i = 0; i < 18; i++) {
      paths.push({
        x: Math.floor(Math.random() * cols) * GRID,
        y: Math.floor(Math.random() * rows) * GRID,
        dir: Math.floor(Math.random() * 4),
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.012,
        alpha: 0.15 + Math.random() * 0.5,
      })
    }

    const DX = [GRID, 0, -GRID, 0]
    const DY = [0, GRID, 0, -GRID]

    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, cv.width, cv.height)

      paths.forEach(p => {
        p.progress += p.speed
        if (p.progress >= 1) {
          p.x = ((p.x + DX[p.dir]) + cv.width * 2) % (cols * GRID)
          p.y = ((p.y + DY[p.dir]) + cv.height * 2) % (rows * GRID)
          p.dir = Math.random() < 0.3 ? (p.dir + 1) % 4 : p.dir
          p.progress = 0
        }
        const tx = p.x + DX[p.dir] * p.progress
        const ty = p.y + DY[p.dir] * p.progress
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(tx, ty)
        ctx.strokeStyle = `rgba(${hexToRgb(color)},${p.alpha})`
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(tx, ty, 3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${hexToRgb(color)},${p.alpha + 0.2})`
        ctx.fill()
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Lightning ─────────────────────────────────────────────────────────
function LightningCanvas({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    cv.width = cv.offsetWidth; cv.height = cv.offsetHeight
    let t = 0, raf: number

    const bolt = (x1: number, y1: number, x2: number, y2: number, depth: number) => {
      if (depth === 0) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2)
        ctx.strokeStyle = `rgba(${hexToRgb(color)},${0.15 + Math.random() * 0.4})`
        ctx.lineWidth = depth === 0 ? 0.8 : 0.5
        ctx.stroke(); return
      }
      const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 30
      const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 30
      bolt(x1, y1, mx, my, depth - 1)
      bolt(mx, my, x2, y2, depth - 1)
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, cv.width, cv.height)
      t++
      if (t % 8 === 0) {
        const x = Math.random() * cv.width
        bolt(x, 0, x + (Math.random() - 0.5) * 100, cv.height, 4)
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [color])
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Utility ───────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

function AnimationCanvas({ type, color }: { type: string; color: string }) {
  switch (type) {
    case 'radar':     return <RadarCanvas color={color} />
    case 'rain':      return <MatrixCanvas color={color} />
    case 'matrix':    return <MatrixCanvas color={color} />
    case 'bars':      return <BarsCanvas color={color} />
    case 'circuit':   return <CircuitCanvas color={color} />
    case 'scan':      return <ScanCanvas color={color} />
    case 'waves':     return <WaveCanvas color={color} />
    case 'lightning': return <LightningCanvas color={color} />
    case 'gears':     return <WaveCanvas color={color} />
    case 'scales':    return <WaveCanvas color={color} />
    default:          return <RadarCanvas color={color} />
  }
}

// ── Main component ────────────────────────────────────────────────────
export default function AgentTheme({ agentName }: { agentName: string }) {
  const theme = AGENT_THEMES[agentName]
  if (!theme) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={agentName}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
      >
        {/* Ambient background glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${theme.glow} 0%, transparent 70%)`,
          transition: 'background 0.5s ease',
        }} />

        {/* Animation layer (bottom quarter, faded) */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', opacity: 0.35, maskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
          <AnimationCanvas type={theme.animation} color={theme.color} />
        </div>

        {/* Agent card — bottom center */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '14px 24px',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(24px)',
            border: `1px solid ${theme.color}30`,
            borderRadius: 16,
            boxShadow: `0 0 40px ${theme.color}20, inset 0 1px 0 rgba(255,255,255,0.04)`,
            whiteSpace: 'nowrap',
          }}
        >
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${theme.color}18`,
            border: `1px solid ${theme.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: theme.color,
            fontFamily: "'Space Grotesk', sans-serif",
            flexShrink: 0,
            boxShadow: `0 0 20px ${theme.color}30`,
          }}>
            {theme.icon}
          </div>

          {/* Text */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                color: theme.color,
                letterSpacing: '0.01em',
              }}>
                {agentName}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: 'rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                padding: '1px 7px',
                letterSpacing: '0.08em',
              }}>
                {theme.role}
              </span>

              {/* Live indicator */}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.color, boxShadow: `0 0 6px ${theme.color}`, animation: 'dot-pulse 1.5s ease infinite' }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>ACTIVE</span>
              </span>
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.01em' }}>
              {theme.tagline}
            </div>
          </div>
        </motion.div>

        {/* Top color stripe accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(to right, transparent 0%, ${theme.color}60 30%, ${theme.color}80 50%, ${theme.color}60 70%, transparent 100%)`,
        }} />
      </motion.div>
    </AnimatePresence>
  )
}
