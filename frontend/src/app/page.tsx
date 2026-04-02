'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const SpaceBackground = dynamic(() => import('@/components/SpaceBackground'), { ssr: false, loading: () => null })

const API = 'http://localhost:8000'

const PROVIDERS = [
  { id: 'claude', label: 'CLAUDE',     icon: '◈', color: '#a78bfa' },
  { id: 'openai', label: 'OPENAI',     icon: '◉', color: '#38bdf8' },
  { id: 'local',  label: 'LOCAL vLLM', icon: '◎', color: '#34d399' },
]

export default function SetupPage() {
  const router = useRouter()

  const [provider,    setProvider]    = useState('claude')
  const [apiKey,      setApiKey]      = useState('')
  const [serverUrl,   setServerUrl]   = useState('')
  const [modelName,   setModelName]   = useState('')
  const [hasKey,      setHasKey]      = useState(false)
  const [datasetPath, setDatasetPath] = useState('')
  const [datasetName, setDatasetName] = useState('')
  const [task,        setTask]        = useState('')
  const [launching,   setLaunching]   = useState(false)
  const [errors,      setErrors]      = useState<string[]>([])
  const [showCreds,   setShowCreds]   = useState(false)
  const [ovKey,       setOvKey]       = useState('')
  const [tilt,        setTilt]        = useState({ x: 0, y: 0 })

  const runIdRef   = useRef('')
  const canNavRef  = useRef(false)
  const cardRef    = useRef<HTMLDivElement>(null)

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
        setModelName(d.model ?? '')
      })
      .catch(() => {})
  }, [])

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top  + rect.height / 2
    setTilt({
      x: ((e.clientY - cy) / rect.height) * -10,
      y: ((e.clientX - cx) / rect.width)  *  10,
    })
  }

  const browse = async (dir: boolean) => {
    try {
      const r = await fetch(`${API}/api/browse?dir=${dir}`)
      const d = await r.json()
      if (d.path) { setDatasetPath(d.path); setDatasetName(d.path.split('/').pop() ?? d.path) }
    } catch { setErrors(['Cannot reach server. Run: python server.py']) }
  }

  const saveCreds = async () => {
    await fetch(`${API}/api/creds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: ovKey, server_url: serverUrl, model: modelName }),
    })
    setHasKey(!!ovKey)
    setShowCreds(false)
  }

  const launch = async () => {
    const errs: string[] = []
    if (!datasetPath)                               errs.push('Select a dataset.')
    if (provider !== 'local' && !apiKey && !hasKey) errs.push('API key required.')
    if (provider === 'local' && !serverUrl)          errs.push('vLLM URL required.')
    if (provider === 'local' && !modelName)          errs.push('Model name required.')
    if (errs.length) { setErrors(errs); return }

    setErrors([])
    setLaunching(true)

    try {
      if (provider === 'local' || apiKey) {
        await fetch(`${API}/api/creds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, api_key: apiKey, server_url: serverUrl, model: modelName }),
        })
      }
      const r = await fetch(`${API}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: apiKey, server_url: serverUrl, model: modelName, dataset_path: datasetPath, task_description: task }),
      })
      const d = await r.json()
      if (d.runId) {
        runIdRef.current = d.runId
        tryNavigate()
      } else {
        setLaunching(false)
        setErrors([d.detail ?? 'Failed to start.'])
      }
    } catch {
      setLaunching(false)
      setErrors(['Cannot reach server at localhost:8000'])
    }
  }

  const providerColor = PROVIDERS.find(p => p.id === provider)?.color ?? '#6366f1'

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>

      {/* 3D Space Background */}
      <SpaceBackground />

      {/* Scan line sweep */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(6,182,212,0.4), transparent)',
          animation: 'scan-line 8s linear infinite',
        }} />
      </div>

      {/* Corner HUD decorations */}
      <div style={{ position: 'fixed', top: 20, left: 24, zIndex: 5, pointerEvents: 'none' }}>
        <div className="hud-frame">SYS // DS-AGENT-TEAM v2.0</div>
      </div>
      <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 5, pointerEvents: 'none' }}>
        <div className="hud-frame">API // localhost:8000</div>
      </div>
      <div style={{ position: 'fixed', bottom: 20, left: 24, zIndex: 5, pointerEvents: 'none' }}>
        <div className="hud-frame">MODE // ANALYSIS ONLY</div>
      </div>
      <div style={{ position: 'fixed', bottom: 20, right: 24, zIndex: 5, pointerEvents: 'none' }}>
        <div className="hud-frame">STATUS // STANDBY</div>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={launching
          ? { opacity: 0, y: -160, scale: 0.8, filter: 'blur(10px)' }
          : { opacity: 1, y: 0,    scale: 1,   filter: 'blur(0px)' }
        }
        transition={launching
          ? { duration: 0.7, ease: [0.25, 0, 0.55, 1] }
          : { duration: 0.8, ease: [0.16, 1, 0.3,  1] }
        }
        onAnimationComplete={() => {
          if (launching) { canNavRef.current = true; tryNavigate() }
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        style={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: 460,
          perspective: 1000,
        }}
      >
        <div
          ref={cardRef}
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.12s ease-out',
          }}
        >
          {/* Outer glow border */}
          <div style={{
            position: 'absolute', inset: -2, borderRadius: 24,
            background: `linear-gradient(135deg, ${providerColor}44, #06b6d444, #a855f744)`,
            filter: 'blur(8px)',
          }} />

          <div className="holo-panel" style={{ padding: '2rem' }}>

            {/* Header */}
            <div style={{ marginBottom: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="fade-up">
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(6,182,212,0.6)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12 }}>
                  ◈ MULTI-AGENT DATASET ANALYSIS
                </div>
                <h1 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 'clamp(26px, 5vw, 36px)',
                  fontWeight: 800,
                  lineHeight: 1.1,
                  background: `linear-gradient(135deg, #fff 0%, ${providerColor} 50%, #06b6d4 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '-0.02em',
                  transition: 'background 0.4s',
                }}>
                  Analyse any<br />dataset.
                </h1>
              </div>
              <button
                onClick={() => setShowCreds(!showCreds)}
                style={{
                  marginTop: 4, width: 36, height: 36, borderRadius: 10,
                  background: showCreds ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${showCreds ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  color: showCreds ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer', fontSize: 15,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >⚙</button>
            </div>

            {/* Credentials override */}
            <AnimatePresence>
              {showCreds && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden', marginBottom: '1.2rem' }}
                >
                  <div style={{
                    padding: '1rem', marginBottom: 2, borderRadius: 12,
                    background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                  }}>
                    <div className="label" style={{ marginBottom: '0.6rem' }}>OVERRIDE SAVED KEY</div>
                    <input
                      className="field"
                      type="password"
                      placeholder="Paste new API key…"
                      value={ovKey}
                      onChange={e => setOvKey(e.target.value)}
                      style={{ marginBottom: '0.6rem' }}
                    />
                    <button className="btn-ghost" style={{ width: '100%' }} onClick={saveCreds}>
                      SAVE CREDENTIALS
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>

              {/* Provider */}
              <div>
                <div className="label" style={{ marginBottom: '0.6rem' }}>PROVIDER</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      style={{
                        flex: 1, padding: '10px 4px',
                        borderRadius: 11,
                        border: `1px solid ${provider === p.id ? p.color + '66' : 'rgba(255,255,255,0.06)'}`,
                        background: provider === p.id ? p.color + '18' : 'rgba(0,0,0,0.3)',
                        color: provider === p.id ? p.color : 'rgba(255,255,255,0.25)',
                        fontSize: 10, fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        letterSpacing: '0.06em',
                        boxShadow: provider === p.id ? `0 0 16px ${p.color}33` : 'none',
                      }}
                    >
                      <div style={{ fontSize: 14, marginBottom: 3 }}>{p.icon}</div>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* API key / Server URL */}
              <div>
                {provider === 'local' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="label" style={{ marginBottom: 2 }}>SERVER URL</div>
                    <input
                      className="field"
                      placeholder="http://localhost:8001"
                      value={serverUrl}
                      onChange={e => setServerUrl(e.target.value)}
                    />
                    <input
                      className="field"
                      placeholder="Model name (e.g. mistral-7b-instruct)"
                      value={modelName}
                      onChange={e => setModelName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <div className="label" style={{ marginBottom: '0.5rem' }}>API KEY</div>
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
                        <span style={{
                          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          fontSize: 10, color: '#34d399', fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 600, letterSpacing: '0.05em',
                        }}>✓ SAVED</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="holo-divider" />

              {/* Dataset */}
              <div>
                <div className="label" style={{ marginBottom: '0.6rem' }}>DATASET</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: datasetPath ? 10 : 0 }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => browse(false)}>
                    ◈ FILE
                  </button>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={() => browse(true)}>
                    ◈ FOLDER
                  </button>
                </div>
                <AnimatePresence>
                  {datasetPath && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 12px', borderRadius: 9,
                        background: 'rgba(52,211,153,0.07)',
                        border: '1px solid rgba(52,211,153,0.2)',
                      }}
                    >
                      <span style={{ color: '#34d399', fontSize: 12 }}>✓</span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11, color: 'rgba(52,211,153,0.8)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {datasetName}
                      </span>
                    </motion.div>
                  )}
                  {!datasetPath && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ fontSize: 11, color: 'rgba(255,255,255,0.1)', paddingTop: 2, fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      NO FILE SELECTED
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Task */}
              <div>
                <div className="label" style={{ marginBottom: '0.5rem' }}>
                  GOAL
                  <span style={{ color: 'rgba(255,255,255,0.2)', textTransform: 'none', letterSpacing: 0, fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 10, marginLeft: 8 }}>optional</span>
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
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(239,68,68,0.06)',
                      border: '1px solid rgba(239,68,68,0.25)',
                    }}
                  >
                    {errors.map((e, i) => (
                      <p key={i} style={{ fontSize: 12, color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>
                        ✗ {e}
                      </p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Launch */}
              <button className="btn-primary" onClick={launch} disabled={launching}>
                {launching ? '◈  INITIALISING…' : '◈  LAUNCH ANALYSIS'}
              </button>

            </div>
          </div>
        </div>
      </motion.div>
    </main>
  )
}
