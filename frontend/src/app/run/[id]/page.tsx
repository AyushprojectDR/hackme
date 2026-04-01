'use client'

import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AgentTheme from '@/components/AgentTheme'

const AgentCanvas = dynamic(() => import('@/components/AgentCanvas'), { ssr: false, loading: () => null })

const API = 'http://localhost:8000'
const POLL_MS = 1500

// Stages in order — visual progress only, no text label shown
const STAGES = [
  { key: 'init',        label: 'Init',          match: ['initializing'] },
  { key: 'discovery',   label: 'Discovery',     match: ['scanning', 'discovery', 'dataset'] },
  { key: 'understand',  label: 'Understanding', match: ['phase 1', 'data understanding', 'eda', 'explorer', 'skeptic', 'statistician'] },
  { key: 'design',      label: 'Design',        match: ['phase 2', 'model design', 'pragmatist', 'architect', 'optimizer'] },
  { key: 'generation',  label: 'Generation',    match: ['phase 3', 'code generation', 'code_writer', 'codewriter'] },
  { key: 'validation',  label: 'Validation',    match: ['phase 4', 'validation'] },
  { key: 'inference',   label: 'Inference',     match: ['phase 5', 'inference', 'storyteller'] },
  { key: 'done',        label: 'Done',          match: ['complete', 'done'] },
]

function detectStageIndex(phase: string, logLines: string[]): number {
  const haystack = (phase + ' ' + logLines.slice(-20).join(' ')).toLowerCase()
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (STAGES[i].match.some(m => haystack.includes(m))) return i
  }
  return 0
}

export default function RunPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [phase,        setPhase]       = useState('Initializing…')
  const [activeAgent,  setActiveAgent] = useState('')
  const [activeAgents, setActiveAgents]= useState<string[]>([])
  const [doneAgents,   setDoneAgents]  = useState<string[]>([])
  const [done,         setDone]        = useState(false)
  const [error,        setError]       = useState('')
  const [logLines,     setLogLines]    = useState<string[]>([])
  const [showLog,      setShowLog]     = useState(false)

  const cursorRef = useRef(0)
  const doneRef   = useRef(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const linesRef  = useRef<string[]>([])


  useEffect(() => {
    if (!id) return

    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/poll/${id}?cursor=${cursorRef.current}`)
        const d = await r.json()

        if (d.error && d.error !== 'Still running') {
          setError(d.error); setDone(true); doneRef.current = true; return
        }

        if (d.lines?.length) {
          const newLines = [...linesRef.current, ...d.lines].slice(-300)
          linesRef.current = newLines
          setLogLines(newLines)
          cursorRef.current = d.cursor
        }

        if (d.phase) {
          setPhase(d.phase)

        }
        if (d.agent) {
          setActiveAgent(d.agent)
          setActiveAgents([d.agent])
        }
        if (d.everActive?.length) {
          setDoneAgents((d.everActive as string[]).filter((a: string) => a !== d.agent))
        }

        if (d.done) {
          doneRef.current = true
          setDone(true); setActiveAgents([]); setActiveAgent('')

          if (d.error) setError(d.error)
          else setTimeout(() => router.push(`/results/${id}`), 2200)
          return
        }
      } catch { /* network blip — retry */ }

      if (!doneRef.current) {
        timerRef.current = setTimeout(poll, POLL_MS)
      }
    }

    timerRef.current = setTimeout(poll, 500)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      doneRef.current = true
    }
  }, [id, router])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logLines])

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>

      {/* Agent network canvas */}
      <AgentCanvas activeAgents={activeAgents} doneAgents={doneAgents} done={done && !error} />

      {/* Per-agent theme layer (ambient glow + animation + card) */}
      {activeAgent && !done && <AgentTheme agentName={activeAgent} />}

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 60, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem' }}>

        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)', fontSize: 12, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.18)')}
        >
          ← back
        </button>

        <button
          onClick={() => setShowLog(v => !v)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.12)', fontSize: 11, cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.12)')}
        >
          {showLog ? 'hide log' : 'log'}
        </button>
      </div>
      </div>

      {/* ── Bottom ──────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20 }}>

        {/* Log drawer */}
        <AnimatePresence>
          {showLog && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 180, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}
            >
              <div style={{ height: 180, overflowY: 'auto', padding: '0.75rem 1.5rem', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.65 }}>
                {logLines.map((line, i) => (
                  <div key={i} style={{ color: line.includes('❌') ? '#f87171' : line.includes('✅') || line.includes('✓') ? '#4ade80' : line.includes('📂') || line.includes('🔍') ? '#a78bfa' : 'rgba(255,255,255,0.22)' }}>
                    {line}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Completion message */}
        <AnimatePresence>
          {done && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ padding: '1rem 1.5rem 1.8rem', display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: '#4ade80' }}>
                Analysis complete — loading results…
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error overlay */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', padding: '2rem' }}>
            <div className="glass" style={{ maxWidth: 520, width: '100%', padding: '2rem' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: '#f87171', marginBottom: '1rem' }}>Pipeline error</h2>
              <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '1rem', overflow: 'auto', maxHeight: 260, whiteSpace: 'pre-wrap', marginBottom: '1.2rem' }}>{error}</pre>
              <button className="btn-primary" onClick={() => router.push('/')}>← Back to setup</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
