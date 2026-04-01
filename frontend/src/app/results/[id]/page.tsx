'use client'

import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const AgentNetwork = dynamic(() => import('@/components/AgentNetwork'), { ssr: false })

const API = 'http://localhost:8000'

interface Entry {
  role:     string
  agent:    string
  content:  string
  metadata: Record<string, unknown>
}

interface Result {
  run_id:  string
  entries: Entry[]
  error?:  string
}

function buildReport(entries: Entry[]): string {
  const sections: Record<string, Entry[]> = {}
  for (const e of entries) {
    if (!sections[e.role]) sections[e.role] = []
    sections[e.role].push(e)
  }

  const roleMap: Record<string, string> = {
    dataset_context: '📊 Dataset Profile',
    meta:            '🔨 Builder',
    analysis:        '🔬 Agent Analysis',
    plan:            '📋 Plans',
    code:            '💻 Generated Code',
    result:          '✅ Results',
    error:           '❌ Errors',
    narrative:       '📖 Narrative',
  }

  let md = ''
  for (const [role, heading] of Object.entries(roleMap)) {
    const ents = sections[role]
    if (!ents?.length) continue
    md += `## ${heading}\n\n`
    for (const e of ents) {
      const title = e.agent.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      if (role === 'code') {
        md += `### ${title}\n\`\`\`python\n${e.content.slice(0, 4000)}\n\`\`\`\n\n`
      } else {
        md += `### ${title}\n\n${e.content}\n\n`
      }
    }
  }
  return md
}

function extractMetrics(entries: Entry[]) {
  const plans = entries.filter(e => e.role === 'plan' && e.agent.toLowerCase().includes('pragmatist'))
  for (const e of plans) {
    const tt = e.content.match(/TASK TYPE\s*:\s*(.+)/i)
    const rm = e.content.match(/RECOMMENDED METRIC\s*:\s*(.+)/i)
    const mj = e.content.match(/METRIC JUSTIFICATION\s*:\s*(.+)/i)
    if (tt || rm) {
      return {
        taskType:      tt?.[1].trim() ?? '',
        metric:        rm?.[1].trim() ?? '',
        justification: mj?.[1].trim() ?? '',
      }
    }
  }
  return { taskType: '', metric: '', justification: '' }
}

export default function ResultsPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [result,  setResult]  = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [report,  setReport]  = useState('')

  useEffect(() => {
    if (!id) return
    const poll = async () => {
      const r = await fetch(`${API}/api/result/${id}`)
      const d = await r.json()
      if (d.error && d.error === 'Still running') {
        setTimeout(poll, 1000)
        return
      }
      setResult(d)
      if (d.entries) setReport(buildReport(d.entries))
      setLoading(false)
    }
    poll()
  }, [id])

  if (loading) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-600">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm">Loading results…</p>
        </div>
      </main>
    )
  }

  const hasError  = !!result?.error
  const entries   = result?.entries ?? []
  const metrics   = extractMetrics(entries)
  const agentsDone= [...new Set(entries.map(e => {
    // Map agent keys to display names
    const map: Record<string, string> = {
      explorer: 'Explorer', skeptic: 'Skeptic', statistician: 'Statistician',
      feature_engineer: 'Feat.Eng', ethicist: 'Ethicist', pragmatist: 'Pragmatist',
      devil_advocate: "Devil's Adv", optimizer: 'Optimizer', diagnostic: 'Diagnostic',
      code_writer: 'CodeWriter', architect: 'Architect', storyteller: 'Storyteller',
    }
    return map[e.agent] ?? e.agent
  }))]
  const agentCount = new Set(entries.map(e => e.agent)).size

  return (
    <main className="min-h-screen bg-bg">

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-indigo-600/5 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-bg/80 backdrop-blur-md">
        <button
          onClick={() => router.push('/')}
          className="text-slate-600 hover:text-slate-400 text-sm transition-colors flex items-center gap-1.5"
        >
          ← new analysis
        </button>

        <div className="flex items-center gap-3">
          {hasError ? (
            <span className="pill pill-error">✗ Pipeline failed</span>
          ) : (
            <span className="pill pill-done">✓ Run {id} complete</span>
          )}
        </div>

        {!hasError && report && (
          <a
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(report)}`}
            download={`analysis_${id}.md`}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            ↓ download report
          </a>
        )}
      </header>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8 space-y-8">

        {hasError ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-6"
          >
            <h2 className="font-display text-lg text-red-400 mb-3">Pipeline encountered an error</h2>
            <pre className="text-xs text-slate-500 overflow-auto max-h-80 bg-black/40 rounded-lg p-4 whitespace-pre-wrap">
              {result?.error}
            </pre>
          </motion.div>
        ) : (
          <>
            {/* Mini 3D canvas */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="glass overflow-hidden"
              style={{ borderRadius: 16 }}
            >
              <AgentNetwork
                activeAgents={[]}
                doneAgents={agentsDone}
                done={true}
                height={280}
              />
            </motion.div>

            {/* Metric cards */}
            {(metrics.taskType || metrics.metric || agentCount > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-4"
              >
                <MetricCard
                  value={metrics.taskType || '—'}
                  label="Task Type"
                  color="#a78bfa"
                />
                <MetricCard
                  value={metrics.metric || '—'}
                  label="Primary Metric"
                  color="#38bdf8"
                />
                <MetricCard
                  value={String(agentCount)}
                  label="Agents Active"
                  color="#34d399"
                />
              </motion.div>
            )}

            {metrics.justification && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xs text-slate-600 px-1"
              >
                💡 {metrics.justification}
              </motion.p>
            )}

            {/* Report */}
            {report && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="glass p-6 report"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report}
                </ReactMarkdown>
              </motion.div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function MetricCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="glass p-4">
      <div className="font-display font-semibold text-lg truncate" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-slate-600 uppercase tracking-widest mt-1 font-display">
        {label}
      </div>
    </div>
  )
}
