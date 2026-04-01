'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const ParticleField = dynamic(() => import('@/components/ParticleField'), { ssr: false, loading: () => null })

const API = 'http://localhost:8000'

const PROVIDERS = [
  { id: 'claude', label: 'Claude' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'local',  label: 'Local vLLM' },
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
  const [launching,   setLaunching]   = useState(false)
  const [errors,      setErrors]      = useState<string[]>([])
  const [showCreds,   setShowCreds]   = useState(false)
  const [ovKey,       setOvKey]       = useState('')

  // Coordinate card-exit animation with API response
  const runIdRef   = useRef('')
  const canNavRef  = useRef(false)
  const tryNavigate = useCallback(() => {
    if (runIdRef.current && canNavRef.current) router.push(`/run/${runIdRef.current}`)
  }, [router])

  useEffect(() => {
    fetch(`${API}/api/creds`)
      .then(r => r.json())
      .then(d => {
        setProvider(d.provider ?? 'claude')
        setHasKey(d.hasKey)
        setServerUrl(d.serverUrl ?? '')
      })
      .catch(() => {})
  }, [])

  const browse = async (dir: boolean) => {
    try {
      const r = await fetch(`${API}/api/browse?dir=${dir}`)
      const d = await r.json()
      if (d.path) {
        setDatasetPath(d.path)
        setDatasetName(d.path.split('/').pop() ?? d.path)
      }
    } catch {
      setErrors(['Cannot reach server. Run: python server.py'])
    }
  }

  const saveCreds = async () => {
    await fetch(`${API}/api/creds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: ovKey, server_url: serverUrl }),
    })
    setHasKey(!!ovKey)
    setShowCreds(false)
  }

  const launch = async () => {
    const errs: string[] = []
    if (!datasetPath)                               errs.push('Select a dataset.')
    if (provider !== 'local' && !apiKey && !hasKey) errs.push('API key required.')
    if (provider === 'local' && !serverUrl)          errs.push('vLLM URL required.')
    if (errs.length) { setErrors(errs); return }

    setErrors([])
    setLaunching(true) // ← card starts flying up immediately

    try {
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
        body: JSON.stringify({ provider, api_key: apiKey, server_url: serverUrl, dataset_path: datasetPath, task_description: task }),
      })
      const d = await r.json()
      if (d.runId) {
        runIdRef.current = d.runId
        tryNavigate() // navigate now if animation already finished
      } else {
        setLaunching(false)
        setErrors([d.detail ?? 'Failed to start.'])
      }
    } catch {
      setLaunching(false)
      setErrors(['Cannot reach server at localhost:8000'])
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>

      {/* 3D particle background */}
      <ParticleField launching={launching} />

      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: '20%', left: '15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* Form panel */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={launching
          ? { opacity: 0, y: -120, scale: 0.88 }
          : { opacity: 1, y: 0,    scale: 1    }
        }
        transition={launching
          ? { duration: 0.65, ease: [0.25, 0, 0.55, 1] }
          : { duration: 0.6,  ease: [0.16, 1, 0.3,  1] }
        }
        onAnimationComplete={() => {
          if (launching) {
            canNavRef.current = true
            tryNavigate() // navigate now if API already responded
          }
        }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 440 }}
      >

        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="fade-up">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(99,102,241,0.7)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
              Multi-Agent DS Team
            </div>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(28px, 5vw, 38px)',
              fontWeight: 700,
              lineHeight: 1.15,
              background: 'linear-gradient(135deg, #fff 0%, #a78bfa 45%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Analyse any<br />dataset.
            </h1>
          </div>
          <button
            onClick={() => setShowCreds(!showCreds)}
            style={{ marginTop: 4, width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Saved credentials"
          >
            ⚙
          </button>
        </div>

        {/* Credentials override */}
        <AnimatePresence>
          {showCreds && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: '1rem' }}
            >
              <div className="glass" style={{ padding: '1rem', marginBottom: 2 }}>
                <div className="label" style={{ marginBottom: '0.6rem' }}>Override saved key</div>
                <input
                  className="field"
                  type="password"
                  placeholder="Paste new API key…"
                  value={ovKey}
                  onChange={e => setOvKey(e.target.value)}
                  style={{ marginBottom: '0.6rem' }}
                />
                <button className="btn-ghost" style={{ width: '100%' }} onClick={saveCreds}>
                  Save
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass fade-up-d1" style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

          {/* Provider */}
          <div>
            <div className="label" style={{ marginBottom: '0.55rem' }}>Provider</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  style={{
                    flex: 1,
                    padding: '8px 6px',
                    borderRadius: 9,
                    border: `1px solid ${provider === p.id ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.07)'}`,
                    background: provider === p.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                    color: provider === p.id ? '#c4b5fd' : 'rgba(255,255,255,0.3)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'Space Grotesk', sans-serif",
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    letterSpacing: '0.03em',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* API key / Server URL */}
          <div>
            {provider === 'local' ? (
              <input
                className="field"
                placeholder="http://localhost:8000/v1"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
              />
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  className="field"
                  type="password"
                  placeholder={provider === 'claude' ? 'sk-ant-…  Anthropic key' : 'sk-…  OpenAI key'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  style={{ paddingRight: hasKey && !apiKey ? 80 : 16 }}
                />
                {hasKey && !apiKey && (
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#4ade80', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                    ✓ saved
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Dataset */}
          <div>
            <div className="label" style={{ marginBottom: '0.55rem' }}>Dataset</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: datasetPath ? 8 : 0 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => browse(false)}>
                📄 File
              </button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => browse(true)}>
                📁 Folder
              </button>
            </div>
            {datasetPath && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(34,197,94,0.07)',
                  border: '1px solid rgba(34,197,94,0.2)',
                }}
              >
                <span style={{ color: '#4ade80', fontSize: 12 }}>✓</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {datasetName}
                </span>
              </motion.div>
            )}
            {!datasetPath && (
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.12)', paddingTop: 2 }}>No file selected</p>
            )}
          </div>

          {/* Task */}
          <div>
            <div className="label" style={{ marginBottom: '0.55rem' }}>
              Goal
              <span style={{ color: 'rgba(255,255,255,0.15)', textTransform: 'none', letterSpacing: 0, fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 10, marginLeft: 6 }}>optional</span>
            </div>
            <textarea
              className="field"
              rows={2}
              placeholder="e.g. Predict house prices. Metric: RMSE."
              value={task}
              onChange={e => setTask(e.target.value)}
              style={{ resize: 'none', lineHeight: 1.5 }}
            />
          </div>

          {/* Errors */}
          <AnimatePresence>
            {errors.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                {errors.map((e, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: '#f87171' }}>✗ {e}</p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Launch */}
          <button className="btn-primary" onClick={launch} disabled={launching}>
            Launch Analysis →
          </button>

        </div>

        {/* Footer status */}
        <div className="fade-up-d5" style={{ marginTop: '1.2rem', textAlign: 'center' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.08em' }}>
            localhost:8000 · localhost:3000
          </span>
        </div>

      </motion.div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}
