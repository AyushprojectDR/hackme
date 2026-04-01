'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const API = 'http://localhost:8000'

const PROVIDERS = [
  { id: 'claude', label: 'Claude',      hint: 'sk-ant-...' },
  { id: 'openai', label: 'OpenAI',      hint: 'sk-...' },
  { id: 'local',  label: 'Local vLLM',  hint: 'http://localhost:8000/v1' },
]

export default function SetupPage() {
  const router = useRouter()

  const [provider,    setProvider]    = useState('claude')
  const [apiKey,      setApiKey]      = useState('')
  const [serverUrl,   setServerUrl]   = useState('')
  const [hasKey,      setHasKey]      = useState(false)
  const [datasetPath, setDatasetPath] = useState('')
  const [datasetName, setDatasetName] = useState('')
  const [task,        setTask]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [errors,      setErrors]      = useState<string[]>([])
  const [showSettings,setShowSettings]= useState(false)
  const [ovKey,       setOvKey]       = useState('')
  const [ovUrl,       setOvUrl]       = useState('')

  // Load saved credentials on mount
  useEffect(() => {
    fetch(`${API}/api/creds`)
      .then(r => r.json())
      .then(d => {
        setProvider(d.provider || 'claude')
        setHasKey(d.hasKey)
        setServerUrl(d.serverUrl || '')
        setOvUrl(d.serverUrl || '')
      })
      .catch(() => {})
  }, [])

  const browse = async (dir: boolean) => {
    try {
      const r = await fetch(`${API}/api/browse?dir=${dir}`)
      const d = await r.json()
      if (d.path) {
        setDatasetPath(d.path)
        setDatasetName(d.path.split('/').pop() || d.path)
      }
    } catch {
      setErrors(['Could not open file picker. Is the server running?'])
    }
  }

  const saveSettings = async () => {
    await fetch(`${API}/api/creds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: ovKey, server_url: ovUrl }),
    })
    setHasKey(!!ovKey)
    setServerUrl(ovUrl)
    setShowSettings(false)
  }

  const launch = async () => {
    const errs: string[] = []
    if (!datasetPath)           errs.push('Select a dataset first.')
    if (provider !== 'local' && !apiKey && !hasKey) errs.push('API key required.')
    if (provider === 'local' && !serverUrl)          errs.push('vLLM server URL required.')
    if (errs.length) { setErrors(errs); return }

    setErrors([])
    setLoading(true)

    try {
      // Save credentials
      if (provider !== 'local' && apiKey) {
        await fetch(`${API}/api/creds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, api_key: apiKey, server_url: '' }),
        })
      }

      const r = await fetch(`${API}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          api_key:          apiKey,
          server_url:       serverUrl,
          dataset_path:     datasetPath,
          task_description: task,
          mode:             'phases',
        }),
      })
      const d = await r.json()
      if (d.runId) router.push(`/run/${d.runId}`)
      else         setErrors([d.detail || 'Failed to start pipeline.'])
    } catch (e) {
      setErrors(['Cannot reach server at localhost:8000. Is it running?'])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg dot-grid flex flex-col items-center justify-center px-4 py-12">

      {/* Ambient glow blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full bg-sky-600/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[480px] relative z-10"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="glow-text font-display text-3xl font-bold leading-tight">
              ⬡ DS Agent Team
            </h1>
            <p className="text-slate-600 text-xs tracking-[0.15em] uppercase mt-1">
              Autonomous · Adaptive · Intelligent
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="mt-1 w-8 h-8 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all text-slate-500 hover:text-slate-300 text-sm flex items-center justify-center"
            title="Saved credentials"
          >
            ⚙
          </button>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-5"
            >
              <div className="glass p-4 space-y-3">
                <p className="text-xs font-display font-semibold text-indigo-400 uppercase tracking-widest">
                  Override saved credentials
                </p>
                <input
                  className="input-field"
                  type="password"
                  placeholder="API Key"
                  value={ovKey}
                  onChange={e => setOvKey(e.target.value)}
                />
                <input
                  className="input-field"
                  type="text"
                  placeholder="vLLM URL (optional)"
                  value={ovUrl}
                  onChange={e => setOvUrl(e.target.value)}
                />
                <button onClick={saveSettings} className="btn-secondary w-full text-xs py-2">
                  Save credentials
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-5">

          {/* 1 — Provider */}
          <section className="glass p-5">
            <SectionLabel>Provider</SectionLabel>
            <div className="flex gap-2 mb-4">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold font-display border transition-all ${
                    provider === p.id
                      ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                      : 'bg-transparent border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {provider === 'local' ? (
              <input
                className="input-field"
                placeholder="http://localhost:8000/v1"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
              />
            ) : (
              <div className="relative">
                <input
                  className="input-field pr-24"
                  type="password"
                  placeholder={PROVIDERS.find(p => p.id === provider)?.hint}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
                {hasKey && !apiKey && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 font-semibold tracking-wide">
                    ✓ saved
                  </span>
                )}
              </div>
            )}
          </section>

          {/* 2 — Dataset */}
          <section className="glass p-5">
            <SectionLabel>Dataset</SectionLabel>
            <div className="flex gap-2 mb-3">
              <button onClick={() => browse(false)} className="btn-secondary flex-1">
                <span className="mr-1.5">📄</span> File
              </button>
              <button onClick={() => browse(true)} className="btn-secondary flex-1">
                <span className="mr-1.5">📁</span> Folder
              </button>
            </div>
            {datasetPath ? (
              <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400 flex items-center gap-2">
                <span className="opacity-60">✓</span>
                <span className="truncate font-mono">{datasetName}</span>
              </div>
            ) : (
              <p className="text-xs text-slate-700 pl-0.5">No file selected</p>
            )}
          </section>

          {/* 3 — Task (optional) */}
          <section className="glass p-5">
            <SectionLabel optional>What to analyse?</SectionLabel>
            <textarea
              className="input-field resize-none text-sm"
              rows={3}
              placeholder="e.g. Predict house prices. Metric: RMSE."
              value={task}
              onChange={e => setTask(e.target.value)}
            />
          </section>

          {/* Errors */}
          <AnimatePresence>
            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-400 space-y-1"
              >
                {errors.map((e, i) => <p key={i}>✗ {e}</p>)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Launch */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={launch}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-display font-semibold text-sm tracking-wide
              bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 background-animate
              text-white shadow-[0_0_32px_rgba(99,102,241,0.4)]
              hover:shadow-[0_0_55px_rgba(99,102,241,0.65)] transition-shadow
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting…
              </span>
            ) : (
              'Launch Analysis →'
            )}
          </motion.button>

        </div>
      </motion.div>

      <style jsx global>{`
        .input-field {
          width: 100%;
          background: rgba(10, 14, 38, 0.8);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 10px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-size: 0.875rem;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .input-field::placeholder { color: #334155; }
        .input-field:focus {
          border-color: rgba(99,102,241,0.6);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .btn-secondary {
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 10px;
          padding: 9px 14px;
          color: #94a3b8;
          font-size: 0.8rem;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-secondary:hover {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.1);
          color: #c4b5fd;
        }
        .background-animate {
          background-size: 200% 200%;
          animation: shimmer 4s ease infinite;
        }
        @keyframes shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </main>
  )
}

function SectionLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="text-[10px] font-display font-semibold text-indigo-400 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
      {children}
      {optional && <span className="text-slate-700 normal-case tracking-normal font-sans font-normal">optional</span>}
    </p>
  )
}
