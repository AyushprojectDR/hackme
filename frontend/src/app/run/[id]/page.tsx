'use client'

import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const AgentNetwork = dynamic(() => import('@/components/AgentNetwork'), {
  ssr: false,
  loading: () => (
    <div className="h-[560px] flex items-center justify-center text-slate-700 text-sm">
      Loading 3D scene…
    </div>
  ),
})

const WS_BASE = 'ws://localhost:8000'

export default function RunPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [canvasH,      setCanvasH]     = useState(560)
  const [phase,        setPhase]       = useState('Initializing…')
  const [activeAgent,  setActiveAgent] = useState('')
  const [activeAgents, setActiveAgents]= useState<string[]>([])
  const [doneAgents,   setDoneAgents]  = useState<string[]>([])
  const [done,         setDone]        = useState(false)
  const [error,        setError]       = useState('')
  const [logLines,     setLogLines]    = useState<string[]>([])
  const [showLog,      setShowLog]     = useState(false)

  const wsRef      = useRef<WebSocket | null>(null)
  const logEndRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    const ws = new WebSocket(`${WS_BASE}/ws/${id}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'log') {
        setLogLines(prev => {
          const lines = msg.text.split('\n').filter(Boolean)
          return [...prev, ...lines].slice(-200)
        })
      } else if (msg.type === 'phase') {
        setPhase(msg.phase)
      } else if (msg.type === 'agent') {
        setActiveAgent(msg.agent)
        setActiveAgents([msg.agent])
        setDoneAgents(msg.everActive.filter((a: string) => a !== msg.agent))
      } else if (msg.type === 'done') {
        setDone(true)
        setActiveAgents([])
        if (msg.error) {
          setError(msg.error)
        } else {
          setTimeout(() => router.push(`/results/${id}`), 1800)
        }
      } else if (msg.type === 'error') {
        setError(msg.message)
        setDone(true)
      }
    }

    ws.onerror = () => setError('WebSocket connection failed.')
    return () => ws.close()
  }, [id, router])

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLines])

  return (
    <main className="min-h-screen bg-bg flex flex-col overflow-hidden">

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-600/4 blur-[150px]" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <button
          onClick={() => router.push('/')}
          className="text-slate-600 hover:text-slate-400 text-sm transition-colors flex items-center gap-1.5"
        >
          ← back
        </button>

        <div className="flex items-center gap-3">
          {!done ? (
            <span className="pill pill-run">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              {phase}
            </span>
          ) : error ? (
            <span className="pill pill-error">✗ Failed</span>
          ) : (
            <span className="pill pill-done">✓ Complete — redirecting…</span>
          )}
        </div>

        <button
          onClick={() => setShowLog(!showLog)}
          className="text-slate-700 hover:text-slate-500 text-xs transition-colors"
        >
          {showLog ? 'hide log' : 'show log'}
        </button>
      </header>

      {/* 3D Canvas — main area */}
      <div className="flex-1 relative">
        <AgentNetwork
          activeAgents={activeAgents}
          doneAgents={doneAgents}
          done={done && !error}
          height={window?.innerHeight ? window.innerHeight - 130 : 560}
        />

        {/* Active agent HUD */}
        <AnimatePresence>
          {activeAgent && !done && (
            <motion.div
              key={activeAgent}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 glass px-5 py-3"
            >
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-sm text-slate-300 font-display font-medium">{activeAgent}</span>
              <span className="text-xs text-slate-600">is working…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Log drawer */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 200 }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t border-white/5 bg-black/40"
          >
            <div className="h-[200px] overflow-y-auto p-4 font-mono text-[11px] text-slate-600 leading-relaxed">
              {logLines.map((l, i) => (
                <div key={i} className={l.includes('❌') ? 'text-red-500' : l.includes('✅') ? 'text-emerald-500' : ''}>
                  {l}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error overlay */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          >
            <div className="glass max-w-xl w-full p-6 space-y-4">
              <h2 className="font-display text-lg text-red-400">Pipeline error</h2>
              <pre className="text-xs text-slate-500 overflow-auto max-h-60 bg-black/40 rounded-lg p-3 whitespace-pre-wrap">
                {error}
              </pre>
              <button
                onClick={() => router.push('/')}
                className="btn-primary w-full text-sm py-2.5"
              >
                ← Back to setup
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .btn-primary {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .btn-primary:hover { opacity: 0.85; }
      `}</style>
    </main>
  )
}
