'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'

const AgentOrbit3D = dynamic(() => import('@/components/AgentOrbit3D'), { ssr: false, loading: () => null })

const API = 'http://localhost:8000'

// ── Per-agent themes ─────────────────────────────────────────────────────────
const AGENT_THEMES: Record<string, {
  color: string
  glow: string
  label: string
  role: string
  description: string
  icon: string
}> = {
  explorer: {
    color: '#a78bfa', glow: 'rgba(167,139,250,0.18)',
    label: 'EXPLORER', role: 'Data Scout',
    description: 'Scans dataset structure, file formats, and surface-level patterns.',
    icon: '◉',
  },
  skeptic: {
    color: '#f472b6', glow: 'rgba(244,114,182,0.18)',
    label: 'SKEPTIC', role: 'Quality Guard',
    description: 'Challenges assumptions and flags anomalies in the data.',
    icon: '⚠',
  },
  statistician: {
    color: '#38bdf8', glow: 'rgba(56,189,248,0.18)',
    label: 'STATISTICIAN', role: 'Numbers Expert',
    description: 'Computes distributions, correlations and statistical summaries.',
    icon: '∑',
  },
  feature_engineer: {
    color: '#34d399', glow: 'rgba(52,211,153,0.18)',
    label: 'FEAT. ENGINEER', role: 'Signal Extractor',
    description: 'Identifies predictive features and transformation opportunities.',
    icon: '⟁',
  },
  ethicist: {
    color: '#fb923c', glow: 'rgba(251,146,60,0.18)',
    label: 'ETHICIST', role: 'Bias Detector',
    description: 'Evaluates fairness, bias risks and ethical implications of the data.',
    icon: '⚖',
  },
  pragmatist: {
    color: '#facc15', glow: 'rgba(250,204,21,0.18)',
    label: 'PRAGMATIST', role: 'Reality Check',
    description: 'Balances complexity vs. feasibility for real-world deployment.',
    icon: '◈',
  },
  devil_advocate: {
    color: '#f87171', glow: 'rgba(248,113,113,0.18)',
    label: 'DEVIL ADVOCATE', role: 'Critical Thinker',
    description: 'Argues against prevailing conclusions to stress-test ideas.',
    icon: '⛧',
  },
  optimizer: {
    color: '#818cf8', glow: 'rgba(129,140,248,0.18)',
    label: 'OPTIMIZER', role: 'Efficiency Expert',
    description: 'Identifies bottlenecks and performance optimization strategies.',
    icon: '⚡',
  },
  architect: {
    color: '#c084fc', glow: 'rgba(192,132,252,0.18)',
    label: 'ARCHITECT', role: 'System Designer',
    description: 'Designs overall model architecture and pipeline structure.',
    icon: '⬡',
  },
  storyteller: {
    color: '#f9a8d4', glow: 'rgba(249,168,212,0.18)',
    label: 'STORYTELLER', role: 'Insight Narrator',
    description: 'Synthesises findings into coherent narratives and final reports.',
    icon: '✦',
  },
}

const DEFAULT_THEME = { color: '#6366f1', glow: 'rgba(99,102,241,0.18)', label: '', role: '', description: '', icon: '◌' }

function parsePhaseLabel(phase: string): string {
  const l = phase.toLowerCase()
  if (l.includes('understand') || l.includes('phase 1')) return 'DATA UNDERSTANDING'
  if (l.includes('design')     || l.includes('phase 2')) return 'MODEL DESIGN'
  if (l.includes('discovery'))                            return 'DISCOVERY'
  if (l.includes('initializ'))                            return 'INITIALISING'
  return phase.toUpperCase()
}

const lineColor = (line: string) => {
  if (line.includes('✅') || line.includes('SUCCESS')) return '#34d399'
  if (line.includes('❌') || line.includes('ERROR'))   return '#f87171'
  if (line.includes('📂') || line.includes('Phase'))   return '#a78bfa'
  if (line.includes('⚡') || line.includes('['))        return '#38bdf8'
  if (line.includes('===='))                            return '#facc15'
  return 'rgba(255,255,255,0.45)'
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [phase,        setPhase]        = useState('INITIALISING')
  const [activeAgent,  setActiveAgent]  = useState('')
  const [activeAgents, setActiveAgents] = useState<string[]>([])
  const [doneAgents,   setDoneAgents]   = useState<string[]>([])
  const [done,         setDone]         = useState(false)
  const [error,        setError]        = useState('')
  const [logLines,     setLogLines]     = useState<string[]>([])
  const [showLog,      setShowLog]      = useState(false)

  const cursorRef = useRef(0)
  const doneRef   = useRef(false)
  const timerRef  = useRef<NodeJS.Timeout | null>(null)
  const linesRef  = useRef<string[]>([])
  const feedRef   = useRef<HTMLDivElement>(null)

  const theme = AGENT_THEMES[activeAgent] ?? DEFAULT_THEME

  const poll = useCallback(async () => {
    if (doneRef.current) return
    try {
      const r = await fetch(`${API}/api/poll/${id}?cursor=${cursorRef.current}`)
      const d = await r.json()

      if (d.lines?.length) {
        linesRef.current = [...linesRef.current, ...d.lines].slice(-400)
        setLogLines([...linesRef.current])
      }
      cursorRef.current = d.cursor ?? cursorRef.current

      if (d.phase) setPhase(parsePhaseLabel(d.phase))
      if (d.agent) {
        const name = d.agent.toLowerCase().replace(/['\s]+/g, '_').replace(/[^a-z_]/g, '')
        setActiveAgent(name)
      }
      if (d.everActive?.length) {
        const names = (d.everActive as string[]).map((a: string) =>
          a.toLowerCase().replace(/['\s]+/g, '_').replace(/[^a-z_]/g, '')
        )
        setActiveAgents(names)
      }

      if (d.done) {
        doneRef.current = true
        setDone(true)
        if (d.error) {
          setError(d.error)
        } else {
          setPhase('COMPLETE')
          setDoneAgents(prev => [...new Set([...prev, ...activeAgents])])
          setTimeout(() => router.push(`/results/${id}`), 2800)
        }
      }
    } catch {}

    if (!doneRef.current) timerRef.current = setTimeout(poll, 1500)
  }, [id, router, activeAgents])

  useEffect(() => {
    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [poll])

  // Auto-scroll live feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [logLines])

  // Last 10 lines for the right feed panel
  const feedLines = logLines.slice(-10)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000008', overflow: 'hidden' }}>

      {/* 3D Agent Network */}
      <AgentOrbit3D
        activeAgents={activeAgents}
        doneAgents={doneAgents}
        activeAgent={activeAgent}
        done={done}
      />

      {/* ── HUD overlay ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }}>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(180deg, rgba(0,0,12,0.95) 0%, transparent 100%)`,
          borderBottom: `1px solid ${theme.color}22`,
          transition: 'border-color 0.6s ease',
        }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: `${theme.color}99`, letterSpacing: '0.35em', marginBottom: 5, transition: 'color 0.6s' }}>
              CURRENT PHASE
            </div>
            <motion.div key={phase} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(13px, 1.8vw, 19px)', fontWeight: 800,
              color: '#fff', letterSpacing: '0.12em',
              textShadow: `0 0 20px ${theme.glow}`,
              transition: 'text-shadow 0.6s',
            }}>
              {phase}
            </motion.div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.25em' }}>
              DS-AGENT-TEAM
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: `${theme.color}66`, letterSpacing: '0.2em', marginTop: 3, transition: 'color 0.6s' }}>
              RUN // {id}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: `${theme.color}99`, letterSpacing: '0.35em', marginBottom: 5, transition: 'color 0.6s' }}>STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              {!done ? (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.color, display: 'inline-block', boxShadow: `0 0 8px ${theme.color}`, transition: 'background 0.6s, box-shadow 0.6s' }} className="dot-pulse" />
                  <span className="pill pill-run" style={{ borderColor: `${theme.color}55`, color: theme.color, transition: 'all 0.6s' }}>RUNNING</span>
                </>
              ) : error ? (
                <span className="pill pill-error">FAILED</span>
              ) : (
                <span className="pill pill-done">COMPLETE</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Left agent card ── */}
        <AnimatePresence mode="wait">
          {activeAgent && !done && theme.label && (
            <motion.div
              key={activeAgent}
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '50%', left: 24,
                transform: 'translateY(-50%)',
                width: 200,
                background: `linear-gradient(135deg, rgba(0,0,12,0.92) 0%, ${theme.glow} 100%)`,
                border: `1px solid ${theme.color}44`,
                borderRadius: 12,
                padding: '20px 18px',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Icon */}
              <div style={{
                fontSize: 28,
                color: theme.color,
                marginBottom: 12,
                filter: `drop-shadow(0 0 12px ${theme.color})`,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {theme.icon}
              </div>

              {/* Agent name */}
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 15, fontWeight: 800,
                color: theme.color,
                letterSpacing: '0.1em',
                marginBottom: 4,
                textShadow: `0 0 16px ${theme.color}88`,
              }}>
                {theme.label}
              </div>

              {/* Role */}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, color: `${theme.color}99`,
                letterSpacing: '0.2em', marginBottom: 12,
                textTransform: 'uppercase',
              }}>
                {theme.role}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: `linear-gradient(90deg, ${theme.color}55, transparent)`, marginBottom: 12 }} />

              {/* Description */}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: 'rgba(255,255,255,0.45)',
                lineHeight: 1.7,
              }}>
                {theme.description}
              </div>

              {/* Pulse bar */}
              <div style={{ marginTop: 16, height: 2, borderRadius: 2, background: `${theme.color}22`, overflow: 'hidden', position: 'relative' }}>
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                  style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Right live feed ── */}
        <AnimatePresence>
          {feedLines.length > 0 && !done && (
            <motion.div
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                top: '50%', right: 24,
                transform: 'translateY(-50%)',
                width: 260,
                background: 'rgba(0,0,12,0.88)',
                border: `1px solid ${theme.color}33`,
                borderRadius: 12,
                backdropFilter: 'blur(20px)',
                overflow: 'hidden',
                transition: 'border-color 0.6s',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '10px 14px',
                borderBottom: `1px solid ${theme.color}22`,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, color: `${theme.color}88`,
                letterSpacing: '0.25em',
                transition: 'color 0.6s',
              }}>
                ▸ LIVE FEED
              </div>

              {/* Lines */}
              <div ref={feedRef} style={{ padding: '10px 14px', maxHeight: 240, overflow: 'hidden' }}>
                {feedLines.map((line, i) => (
                  <motion.div
                    key={logLines.length - feedLines.length + i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 9.5,
                      color: lineColor(line),
                      lineHeight: 1.7,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {line}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 24px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,12,0.95) 0%, transparent 100%)',
          borderTop: `1px solid ${theme.color}22`,
          transition: 'border-color 0.6s',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: '65%' }}>
            {activeAgents.map(ag => {
              const isDone = doneAgents.includes(ag)
              const agTheme = AGENT_THEMES[ag]
              return (
                <motion.span
                  key={ag}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, letterSpacing: '0.15em',
                    padding: '3px 8px', borderRadius: 4,
                    border: `1px solid ${isDone ? '#34d39955' : agTheme ? agTheme.color + '55' : '#6366f155'}`,
                    color: isDone ? '#34d399' : agTheme?.color ?? '#6366f1',
                    background: isDone ? 'rgba(52,211,153,0.06)' : agTheme ? agTheme.glow : 'rgba(99,102,241,0.06)',
                  }}
                >
                  {isDone ? '✓' : '◈'} {ag.replace(/_/g, ' ').toUpperCase()}
                </motion.span>
              )
            })}
          </div>
          <button
            onClick={() => setShowLog(v => !v)}
            className="hud-frame"
            style={{
              cursor: 'pointer', pointerEvents: 'auto',
              borderColor: showLog ? `${theme.color}bb` : `${theme.color}33`,
              color: theme.color,
              transition: 'border-color 0.6s, color 0.6s',
            }}
          >
            {showLog ? '▼ HIDE LOG' : '▲ LIVE LOG'}
          </button>
        </div>
      </div>

      {/* Log drawer */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20,
              height: '40vh',
              background: 'rgba(0,0,10,0.97)',
              borderTop: `1px solid ${theme.color}33`,
              backdropFilter: 'blur(24px)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              padding: '10px 20px', borderBottom: `1px solid ${theme.color}18`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: `${theme.color}88`, letterSpacing: '0.2em' }}>
                LIVE LOG — {logLines.length} LINES
              </span>
              <button onClick={() => setShowLog(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 20px' }}>
              {logLines.map((line, i) => (
                <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: lineColor(line), lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {line}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error modal */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
          }}>
            <div className="holo-panel" style={{ padding: '2rem', maxWidth: 540, width: '100%' }}>
              <div style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.2em', marginBottom: 14 }}>
                ❌ PIPELINE FAILURE
              </div>
              <pre style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
                color: 'rgba(255,255,255,0.45)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 240, overflow: 'auto',
                background: 'rgba(239,68,68,0.04)', borderRadius: 8, padding: 12,
                border: '1px solid rgba(239,68,68,0.12)',
              }}>
                {error}
              </pre>
              <button onClick={() => router.push('/')} className="btn-ghost" style={{ width: '100%', marginTop: 16 }}>
                ← RETURN HOME
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success overlay */}
      <AnimatePresence>
        {done && !error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 180 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{ fontSize: 56, marginBottom: 14, filter: 'drop-shadow(0 0 40px rgba(52,211,153,0.9))' }}>✦</div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 'clamp(18px, 3vw, 28px)', fontWeight: 800,
                color: '#34d399', letterSpacing: '0.18em',
                textShadow: '0 0 40px rgba(52,211,153,0.7)',
                marginBottom: 8,
              }}>ANALYSIS COMPLETE</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(52,211,153,0.45)', letterSpacing: '0.25em' }}>
                LOADING RESULTS…
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
