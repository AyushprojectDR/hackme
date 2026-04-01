'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AGENT_THEMES } from '@/components/AgentTheme'

const API = 'http://localhost:8000'

interface Entry  { role: string; agent: string; content: string; metadata: Record<string, unknown> }
interface Result { run_id: string; entries: Entry[]; error?: string }

const AGENT_MAP: Record<string, string> = {
  explorer: 'Explorer', skeptic: 'Skeptic', statistician: 'Statistician',
  feature_engineer: 'Feat.Eng', ethicist: 'Ethicist', pragmatist: 'Pragmatist',
  devil_advocate: "Devil's Adv", optimizer: 'Optimizer', diagnostic: 'Diagnostic',
  code_writer: 'CodeWriter', architect: 'Architect', storyteller: 'Storyteller',
}

const PHASE_GROUPS: string[][] = [
  ['Explorer', 'Skeptic', 'Statistician', 'Feat.Eng'],
  ['Pragmatist', "Devil's Adv", 'Ethicist', 'Architect'],
  ['CodeWriter', 'Optimizer'],
  ['Storyteller', 'Diagnostic'],
]

interface AgentNode {
  id:      string
  x: number; y: number; vx: number; vy: number
  entries: Entry[]
  color:   string
  icon:    string
  role:    string
  phase:   number
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function buildReportMd(entries: Entry[]): string {
  const sections: Record<string, Entry[]> = {}
  for (const e of entries) { (sections[e.role] ??= []).push(e) }
  const order = ['dataset_context','meta','analysis','plan','code','result','narrative','error']
  const labels: Record<string,string> = { dataset_context:'Dataset Profile', meta:'Builder', analysis:'Analysis', plan:'Plans', code:'Code', result:'Results', narrative:'Narrative', error:'Errors' }
  return order.flatMap(role => {
    const ents = sections[role]; if (!ents?.length) return []
    const lines = [`## ${labels[role] ?? role}\n`]
    for (const e of ents) {
      const t = e.agent.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
      if (role === 'code') lines.push(`### ${t}\n\`\`\`python\n${e.content.slice(0,4000)}\n\`\`\`\n`)
      else lines.push(`### ${t}\n\n${e.content}\n`)
    }
    return lines
  }).join('\n')
}

// ── Node graph canvas ─────────────────────────────────────────────────
const NODE_R = 46

function NodeGraph({ agents, connections, onNodeClick }: {
  agents:      AgentNode[]
  connections: [number, number][]
  onNodeClick: (n: AgentNode) => void
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const nodesRef   = useRef(agents)
  const mouseRef   = useRef({ x: -9999, y: -9999 })
  const hoveredRef = useRef(-1)
  const cbRef      = useRef(onNodeClick)

  useEffect(() => { nodesRef.current = agents },     [agents])
  useEffect(() => { cbRef.current    = onNodeClick }, [onNodeClick])

  useEffect(() => {
    if (!agents.length) return
    const canvas = canvasRef.current!
    const dpr    = Math.min(window.devicePixelRatio || 1, 2)
    let W = window.innerWidth, H = window.innerHeight

    const setSize = () => {
      canvas.width  = W * dpr; canvas.height = H * dpr
      canvas.style.width  = W + 'px'; canvas.style.height = H + 'px'
    }
    setSize()
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)

    // Scatter nodes around a soft ellipse
    const nodes = nodesRef.current
    const cx = W / 2, cy = H / 2
    nodes.forEach((node, i) => {
      const a   = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      const jit = 0.55 + Math.random() * 0.7
      node.x  = cx + Math.cos(a) * W * 0.32 * jit
      node.y  = cy + Math.sin(a) * H * 0.32 * jit
      node.vx = (Math.random() - 0.5) * 0.4
      node.vy = (Math.random() - 0.5) * 0.4
    })

    // Starfield (drawn once into offscreen canvas)
    const starCV = document.createElement('canvas')
    starCV.width = W; starCV.height = H
    const sctx = starCV.getContext('2d')!
    sctx.fillStyle = '#000'
    sctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 700; i++) {
      const op  = 0.1 + Math.random() * 0.5
      const sz  = Math.random() * 1.2
      sctx.beginPath()
      sctx.arc(Math.random()*W, Math.random()*H, sz, 0, Math.PI*2)
      sctx.fillStyle = `rgba(255,255,255,${op})`
      sctx.fill()
    }

    // Flow dot progress per connection
    const flowT = connections.map(() => Math.random())

    let t = 0, raf: number

    const draw = () => {
      raf = requestAnimationFrame(draw)
      t  += 0.010

      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(starCV, 0, 0)

      // Center radial vignette
      const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.72)
      vig.addColorStop(0, 'rgba(5,7,18,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)

      // Physics
      nodes.forEach((n, i) => {
        n.vx += (Math.random() - 0.5) * 0.035
        n.vy += (Math.random() - 0.5) * 0.035

        nodes.forEach((o, j) => {
          if (i === j) return
          const dx = n.x - o.x, dy = n.y - o.y
          const d2 = dx*dx + dy*dy
          const min = NODE_R * 5
          if (d2 < min*min && d2 > 0) {
            const d = Math.sqrt(d2)
            const f = 100 / d2
            n.vx += (dx/d)*f; n.vy += (dy/d)*f
          }
        })

        n.vx *= 0.93; n.vy *= 0.93
        const m = NODE_R + 80
        if (n.x < m)     n.vx += (m - n.x)     * 0.04
        if (n.x > W - m) n.vx -= (n.x - W + m) * 0.04
        if (n.y < m)     n.vy += (m - n.y)     * 0.04
        if (n.y > H - m) n.vy -= (n.y - H + m) * 0.04
        n.x += n.vx; n.y += n.vy
      })

      // Connections + flow dots
      connections.forEach(([ai, bi], ci) => {
        const a = nodes[ai], b = nodes[bi]
        if (!a || !b) return
        const [ar,ag,ab] = hexToRgb(a.color)
        const [br,bg,bb] = hexToRgb(b.color)

        const gr = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        gr.addColorStop(0, `rgba(${ar},${ag},${ab},0.22)`)
        gr.addColorStop(1, `rgba(${br},${bg},${bb},0.22)`)
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y)
        ctx.strokeStyle = gr; ctx.lineWidth = 1; ctx.stroke()

        // Animated flow dot
        flowT[ci] = (flowT[ci] + 0.0025) % 1
        const ft = flowT[ci]
        const fx = a.x + (b.x-a.x)*ft, fy = a.y + (b.y-a.y)*ft
        const fr = Math.round(ar+(br-ar)*ft), fg2 = Math.round(ag+(bg-ag)*ft), fb = Math.round(ab+(bb-ab)*ft)
        ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${fr},${fg2},${fb},0.95)`
        ctx.fill()
      })

      // Nodes
      const {x: mx, y: my} = mouseRef.current
      let newHov = -1

      nodes.forEach((node, i) => {
        const pulse   = Math.sin(t * 1.8 + i * 1.3) * 0.5 + 0.5
        const isHov   = Math.hypot(mx - node.x, my - node.y) < NODE_R + 14
        if (isHov) newHov = i
        const scale   = isHov ? 1.18 : 1
        const r       = NODE_R * scale
        const [cr,cg,cb] = hexToRgb(node.color)

        // Multi-layer glow
        ;([
          [r*3.2, 0.03 + pulse*0.04],
          [r*2.1, 0.07 + pulse*0.06],
          [r*1.5, 0.13 + pulse*0.09],
        ] as [number,number][]).forEach(([rad, op]) => {
          const g = ctx.createRadialGradient(node.x,node.y,0, node.x,node.y,rad)
          g.addColorStop(0, `rgba(${cr},${cg},${cb},${op})`)
          g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
          ctx.beginPath(); ctx.arc(node.x,node.y,rad,0,Math.PI*2)
          ctx.fillStyle = g; ctx.fill()
        })

        // Ring
        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI*2)
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${isHov ? 0.95 : 0.45 + pulse*0.35})`
        ctx.lineWidth = isHov ? 2.5 : 1.5
        ctx.stroke()

        // Inner fill
        const fill = ctx.createRadialGradient(node.x-r*.2, node.y-r*.2, 0, node.x, node.y, r)
        fill.addColorStop(0, `rgba(${cr},${cg},${cb},0.18)`)
        fill.addColorStop(1, 'rgba(0,0,0,0.9)')
        ctx.beginPath(); ctx.arc(node.x,node.y,r-1,0,Math.PI*2)
        ctx.fillStyle = fill; ctx.fill()

        // Icon
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${isHov ? 1 : 0.8})`
        ctx.font = `${Math.round(r*.52)}px "JetBrains Mono",monospace`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(node.icon, node.x, node.y - 3)

        // Name
        ctx.font = `600 ${Math.round(r*.29)}px "Space Grotesk",sans-serif`
        ctx.fillStyle = isHov ? '#fff' : 'rgba(255,255,255,0.72)'
        ctx.textBaseline = 'top'
        ctx.fillText(node.id, node.x, node.y + r + 7)

        // Role badge
        ctx.font = `${Math.round(r*.21)}px "JetBrains Mono",monospace`
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${isHov ? 0.7 : 0.38})`
        ctx.fillText(node.role.toUpperCase(), node.x, node.y + r + 7 + Math.round(r*.31))

        // Count badge
        if (node.entries.length > 1) {
          const bx = node.x + r*.72, by = node.y - r*.72
          ctx.beginPath(); ctx.arc(bx,by,10,0,Math.PI*2)
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.9)`; ctx.fill()
          ctx.fillStyle = '#000'
          ctx.font = 'bold 9px monospace'
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(String(node.entries.length), bx, by)
        }
      })

      hoveredRef.current = newHov
      canvas.style.cursor = newHov >= 0 ? 'pointer' : 'default'
    }
    draw()

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight; setSize()
      ctx.scale(dpr, dpr)
    }
    const onMove  = (e: MouseEvent) => { mouseRef.current = {x: e.clientX, y: e.clientY} }
    const onClick = () => { const h = hoveredRef.current; if (h >= 0) cbRef.current(nodesRef.current[h]) }

    window.addEventListener('resize', onResize)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('click', onClick)
    }
  }, [agents.length, connections])  // run once agents are loaded

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0 }} />
}

// ── Agent modal ───────────────────────────────────────────────────────
function AgentModal({ node, onClose }: { node: AgentNode; onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const entry  = node.entries[tab] ?? node.entries[0]
  const isCode = entry?.role === 'code'
  const [cr,cg,cb] = hexToRgb(node.color)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(28px)',
        padding: '2rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.80, opacity: 0, y: 40 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 660, maxHeight: '80vh',
          overflowY: 'auto', position: 'relative',
          background: `rgba(6,8,18,0.98)`,
          border: `1px solid rgba(${cr},${cg},${cb},0.22)`,
          borderRadius: 22,
          boxShadow: `0 0 80px rgba(${cr},${cg},${cb},0.14), 0 50px 100px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Top color bar */}
        <div style={{
          height: 3, borderRadius: '22px 22px 0 0',
          background: `linear-gradient(90deg, rgba(${cr},${cg},${cb},0.9) 0%, rgba(${cr},${cg},${cb},0.05) 100%)`,
        }} />

        {/* Header */}
        <div style={{ padding: '1.6rem 2rem 1rem', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 16,
            background: `rgba(${cr},${cg},${cb},0.10)`,
            border: `1px solid rgba(${cr},${cg},${cb},0.28)`,
            boxShadow: `0 0 24px rgba(${cr},${cg},${cb},0.15)`,
            fontSize: 24, color: node.color,
          }}>
            {node.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {node.id}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: node.color, opacity: 0.7 }}>
              {node.role}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '6px 10px', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
          >×</button>
        </div>

        {/* Tabs (if multiple entries) */}
        {node.entries.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 2rem 1rem', flexWrap: 'wrap' }}>
            {node.entries.map((e, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                background: tab===i ? `rgba(${cr},${cg},${cb},0.14)` : 'transparent',
                border: `1px solid ${tab===i ? `rgba(${cr},${cg},${cb},0.4)` : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                color: tab===i ? node.color : 'rgba(255,255,255,0.3)',
                fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                letterSpacing: '0.08em', textTransform: 'uppercase', transition: 'all 0.2s',
              }}>
                {e.role}
              </button>
            ))}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: `rgba(${cr},${cg},${cb},0.08)`, margin: '0 2rem' }} />

        {/* Content */}
        {entry && (
          <div className="report" style={{ padding: '1.6rem 2rem 2.2rem' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {isCode ? `\`\`\`python\n${entry.content.slice(0, 6000)}\n\`\`\`` : entry.content}
            </ReactMarkdown>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Results page ──────────────────────────────────────────────────────
export default function ResultsPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [result,       setResult]       = useState<Result | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null)
  const [report,       setReport]       = useState('')

  useEffect(() => {
    if (!id) return
    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/result/${id}`)
        const d = await r.json()
        if (d.error === 'Still running') { setTimeout(poll, 1000); return }
        setResult(d)
        if (d.entries) setReport(buildReportMd(d.entries))
        setLoading(false)
      } catch { setTimeout(poll, 2000) }
    }
    poll()
  }, [id])

  const agentNodes = useMemo<AgentNode[]>(() => {
    if (!result?.entries) return []
    const byAgent: Record<string, Entry[]> = {}
    for (const e of result.entries) { (byAgent[e.agent] ??= []).push(e) }
    return Object.entries(byAgent).map(([key, entries]) => {
      const name  = AGENT_MAP[key] ?? key
      const theme = AGENT_THEMES[name]
      let phase = 0
      PHASE_GROUPS.forEach((g, i) => { if (g.includes(name)) phase = i })
      return {
        id: name, x: 0, y: 0, vx: 0, vy: 0,
        entries, phase,
        color: theme?.color ?? '#6366f1',
        icon:  theme?.icon  ?? '◎',
        role:  theme?.role  ?? name,
      }
    })
  }, [result])

  const connections = useMemo<[number, number][]>(() => {
    const names = agentNodes.map(n => n.id)
    const pairs: [number, number][] = []
    PHASE_GROUPS.forEach(group => {
      const inG = group.filter(n => names.includes(n))
      for (let i = 0; i < inG.length; i++)
        for (let j = i+1; j < inG.length; j++) {
          const ai = names.indexOf(inG[i]), bi = names.indexOf(inG[j])
          if (ai >= 0 && bi >= 0) pairs.push([ai, bi])
        }
    })
    return pairs
  }, [agentNodes])

  const handleNodeClick = useCallback((node: AgentNode) => setSelectedNode(node), [])

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 32, height: 32, border: '2px solid rgba(99,102,241,0.18)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>Loading results…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  )

  const hasError = !!result?.error

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', position: 'relative' }}>

      {/* Node graph */}
      {!hasError && agentNodes.length > 0 && (
        <NodeGraph agents={agentNodes} connections={connections} onNodeClick={handleNodeClick} />
      )}

      {/* Nav — always on top */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.1rem 2rem',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 13, cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", transition: 'color 0.2s', pointerEvents: 'all' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
        >← new analysis</button>

        <span className={hasError ? 'pill pill-error' : 'pill pill-done'} style={{ pointerEvents: 'none' }}>
          {hasError ? '✗ Failed' : `✓ ${id}`}
        </span>

        {!hasError && report && (
          <a
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(report)}`}
            download={`analysis_${id}.md`}
            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.2)', textDecoration: 'none', transition: 'color 0.2s', pointerEvents: 'all' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
          >↓ .md</a>
        )}
      </div>

      {/* Hint */}
      {!hasError && agentNodes.length > 0 && !selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          style={{
            position: 'fixed', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)',
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
            color: 'rgba(255,255,255,0.18)', letterSpacing: '0.10em',
            pointerEvents: 'none', zIndex: 10,
          }}
        >
          click any node to explore
        </motion.div>
      )}

      {/* Error */}
      {hasError && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass" style={{ maxWidth: 520, width: '100%', padding: '2rem' }}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, color: '#f87171', marginBottom: '1rem' }}>Pipeline error</h2>
            <pre style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{result?.error}</pre>
            <button className="btn-primary" onClick={() => router.push('/')}>← Back to setup</button>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {selectedNode && (
          <AgentModal node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </AnimatePresence>
    </main>
  )
}
