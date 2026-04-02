'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useFrame, useThree } from '@react-three/fiber'
import CanvasSafe from '@/components/CanvasSafe'
import { Stars, Text } from '@react-three/drei'
import * as THREE from 'three'

const API = 'http://localhost:8000'

// ─────────────────────────────────────────────────────────────────────────
// Agent config
// ─────────────────────────────────────────────────────────────────────────

interface Entry { role: string; agent: string; content: string; metadata: Record<string,unknown> }
interface AgentNode { id: string; label: string; color: string; pos: [number,number,number]; content: string }

const AGENT_META: Record<string, { color: string; label: string }> = {
  explorer:         { color: '#a78bfa', label: 'Explorer' },
  skeptic:          { color: '#f472b6', label: 'Skeptic' },
  statistician:     { color: '#38bdf8', label: 'Statistician' },
  feature_engineer: { color: '#34d399', label: 'Feat.Eng' },
  ethicist:         { color: '#fb923c', label: 'Ethicist' },
  pragmatist:       { color: '#facc15', label: 'Pragmatist' },
  devil_advocate:   { color: '#f87171', label: 'Devil Adv' },
  optimizer:        { color: '#818cf8', label: 'Optimizer' },
  architect:        { color: '#c084fc', label: 'Architect' },
  storyteller:      { color: '#f9a8d4', label: 'Storyteller' },
  data_profiler:    { color: '#22d3ee', label: 'Profiler' },
}

// Positions in 3D space — arranged in concentric rings
const POSITIONS: [number,number,number][] = [
  [-4,  2.5, 0], [0,  3.5, 1], [4,  2.5, 0],  // top ring: analysis
  [-4.5, 0, -1], [4.5, 0, -1],                  // sides: ethics + feat
  [-3, -2, 1],  [0, -3, 0],  [3, -2, 1],        // middle: planning
  [-1.5, -4.5, -1], [1.5, -4.5, -1],            // bottom: storyteller + optimizer
  [0, 0.5, 3],                                   // front: profiler
]

// ─────────────────────────────────────────────────────────────────────────
// 3D Graph components
// ─────────────────────────────────────────────────────────────────────────

function NodeSphere({ node, selected, onClick }: {
  node: AgentNode
  selected: boolean
  onClick: () => void
}) {
  const mesh  = useRef<THREE.Mesh>(null!)
  const ring  = useRef<THREE.Mesh>(null!)
  const glow  = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    if (!mesh.current || !ring.current || !glow.current) return
    const t = state.clock.elapsedTime
    mesh.current.rotation.y = t * 0.4
    if (selected) {
      mesh.current.scale.setScalar(1.2 + Math.sin(t * 3) * 0.05)
      ring.current.rotation.z = t * 2
      ring.current.rotation.x = t * 0.5
      glow.current.scale.setScalar(1.5 + Math.sin(t * 2) * 0.2)
    } else {
      mesh.current.scale.setScalar(1)
      ring.current.rotation.z = t * 0.5
    }
  })

  return (
    <group position={node.pos} onClick={(e) => { e.stopPropagation(); onClick() }}>
      {/* Glow halo */}
      <mesh ref={glow}>
        <sphereGeometry args={[0.52, 12, 12]} />
        <meshBasicMaterial color={node.color} transparent opacity={selected ? 0.12 : 0.04} />
      </mesh>

      {/* Main sphere */}
      <mesh ref={mesh}>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={selected ? 1.2 : 0.4}
          roughness={0.2} metalness={0.8}
        />
      </mesh>

      {/* Rotating ring */}
      <mesh ref={ring}>
        <torusGeometry args={[0.58, selected ? 0.014 : 0.008, 8, 48]} />
        <meshBasicMaterial color={node.color} transparent opacity={selected ? 0.9 : 0.35} />
      </mesh>

      {/* Second ring (selected only) */}
      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.75, 0.006, 8, 48]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Point light */}
      <pointLight color={node.color} intensity={selected ? 2.5 : 0.6} distance={4} />

      {/* Label */}
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.16}
        color={selected ? node.color : 'rgba(255,255,255,0.4)'}
        anchorX="center" anchorY="top"
      >
        {node.label}
      </Text>
    </group>
  )
}

function GraphEdges({ nodes }: { nodes: AgentNode[] }) {
  const positions = useMemo(() => {
    const pts: number[] = []
    const cols: number[] = []
    // Edges between consecutive nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1]
      pts.push(...a.pos, ...b.pos)
      const ca = new THREE.Color(a.color), cb = new THREE.Color(b.color)
      const dim = 0.18
      cols.push(ca.r * dim, ca.g * dim, ca.b * dim, cb.r * dim, cb.g * dim, cb.b * dim)
    }
    return { positions: new Float32Array(pts), colors: new Float32Array(cols) }
  }, [nodes])

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[positions.colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.7} />
    </lineSegments>
  )
}

function CameraOrbit() {
  const { camera } = useThree()
  const autoAngle = useRef(0)

  useFrame((_, delta) => {
    autoAngle.current += delta * 0.06
    const base = new THREE.Vector3(
      Math.sin(autoAngle.current) * 12,
      3,
      Math.cos(autoAngle.current) * 12,
    )
    camera.position.lerp(base, 0.02)
    camera.lookAt(0, 0, 0)
  })

  return null
}

function Scene3D({ nodes, selectedId, onSelect }: {
  nodes: AgentNode[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <Stars radius={120} depth={60} count={5000} factor={5} saturation={0.1} fade speed={0.6} />
      <ambientLight intensity={0.06} />
      {nodes.map(n => (
        <NodeSphere
          key={n.id}
          node={n}
          selected={n.id === selectedId}
          onClick={() => onSelect(n.id)}
        />
      ))}
      <GraphEdges nodes={nodes} />
      <fog attach="fog" args={['#000008', 18, 55]} />
      <CameraOrbit />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [result,    setResult]    = useState<{ run_id: string; entries: Entry[]; error?: string } | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)

  // Fetch results
  useEffect(() => {
    let attempts = 0
    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/result/${id}`)
        const d = await r.json()
        if (d.run_id || d.error) { setResult(d); setLoading(false); return }
      } catch {}
      if (++attempts < 20) setTimeout(poll, 2000)
      else setLoading(false)
    }
    poll()
  }, [id])

  // Build 3D nodes from entries
  const nodes = useMemo<AgentNode[]>(() => {
    if (!result?.entries) return []
    const seen = new Map<string, string>()
    result.entries.forEach(e => {
      const key = e.agent?.toLowerCase().replace(/[\s']+/g, '_').replace(/[^a-z_]/g, '') ?? 'unknown'
      if (!seen.has(key) && e.content) seen.set(key, e.content)
    })
    return Array.from(seen.entries()).map(([key, content], i) => ({
      id: key,
      label: AGENT_META[key]?.label ?? key.replace(/_/g, ' '),
      color: AGENT_META[key]?.color ?? '#6366f1',
      pos: POSITIONS[i % POSITIONS.length],
      content,
    }))
  }, [result])

  // Build markdown report
  const report = useMemo(() => {
    if (!result?.entries) return ''
    return result.entries
      .filter(e => e.content && e.role !== 'meta' && e.role !== 'task')
      .map(e => {
        const label = AGENT_META[e.agent?.toLowerCase().replace(/[\s']+/g, '_') ?? '']?.label ?? e.agent
        return `## ${label}\n\n${e.content}`
      })
      .join('\n\n---\n\n')
  }, [result])

  const selectedNode = nodes.find(n => n.id === selectedId) ?? null

  const downloadReport = useCallback(() => {
    const blob = new Blob([report], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `analysis_${id}.md`; a.click()
    URL.revokeObjectURL(url)
  }, [report, id])

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000008', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 16, animation: 'float 2s ease-in-out infinite' }}>◈</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'rgba(6,182,212,0.6)', letterSpacing: '0.3em' }}>
            LOADING RESULTS…
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (result?.error) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000008', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="holo-panel" style={{ padding: '2rem', maxWidth: 500 }}>
          <div style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.2em', marginBottom: 12 }}>❌ PIPELINE ERROR</div>
          <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
            {result.error}
          </pre>
          <button onClick={() => router.push('/')} className="btn-ghost" style={{ width: '100%', marginTop: 16 }}>← HOME</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000008', overflow: 'hidden' }}>

      {/* 3D Graph */}
      <CanvasSafe
        camera={{ position: [0, 3, 14], fov: 52 }}
        style={{ position: 'absolute', inset: 0 }}
        dpr={[1, 1.5]}
      >
        <Scene3D nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} />
      </CanvasSafe>

      {/* Deselect click */}
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        onClick={() => setSelectedId(null)}
      />

      {/* ── HUD ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10 }}>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(0,0,12,0.92) 0%, transparent 100%)',
          pointerEvents: 'auto',
        }}>
          <button onClick={() => router.push('/')} className="hud-frame" style={{ cursor: 'pointer' }}>
            ← HOME
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.25em' }}>
              ANALYSIS RESULTS
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8.5, color: 'rgba(99,102,241,0.4)', letterSpacing: '0.2em', marginTop: 3 }}>
              RUN // {id}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setShowReport(true); setSelectedId(null) }} className="hud-frame" style={{ cursor: 'pointer' }}>
              ◈ FULL REPORT
            </button>
            <button onClick={downloadReport} className="hud-frame" style={{ cursor: 'pointer' }}>
              ↓ EXPORT .MD
            </button>
          </div>
        </div>

        {/* Node count */}
        <div style={{
          position: 'absolute', bottom: 24, left: 24,
        }}>
          <div className="hud-frame">
            {nodes.length} AGENTS · CLICK NODE TO INSPECT
          </div>
        </div>
      </div>

      {/* ── Selected node detail panel ── */}
      <AnimatePresence>
        {selectedNode && !showReport && (
          <motion.div
            key={selectedNode.id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 15,
              width: 'min(480px, 100vw)',
              display: 'flex', flexDirection: 'column',
              background: 'rgba(0,0,10,0.92)',
              borderLeft: `1px solid ${selectedNode.color}33`,
              backdropFilter: 'blur(32px)',
            }}
          >
            {/* Panel top accent */}
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${selectedNode.color}, transparent)` }} />

            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: `1px solid ${selectedNode.color}20`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: selectedNode.color,
                  boxShadow: `0 0 12px ${selectedNode.color}`,
                }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: selectedNode.color, letterSpacing: '0.3em' }}>
                  AGENT OUTPUT
                </span>
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 20, fontWeight: 800, color: '#fff',
                textShadow: `0 0 20px ${selectedNode.color}60`,
              }}>
                {selectedNode.label}
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
              <div className="report">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedNode.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Close */}
            <div style={{ padding: '14px 24px', borderTop: `1px solid ${selectedNode.color}15` }}>
              <button
                onClick={() => setSelectedId(null)}
                className="btn-ghost"
                style={{ width: '100%', borderColor: `${selectedNode.color}33`, color: selectedNode.color }}
              >
                ✕ CLOSE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full report panel ── */}
      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 20,
              background: 'rgba(0,0,8,0.97)',
              backdropFilter: 'blur(32px)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 28px',
              borderBottom: '1px solid rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(180deg, rgba(0,0,20,0.8) 0%, transparent 100%)',
            }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'rgba(6,182,212,0.5)', letterSpacing: '0.3em', marginBottom: 4 }}>
                  FULL ANALYSIS REPORT
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  Run {id}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={downloadReport} className="btn-ghost" style={{ fontSize: 12 }}>↓ EXPORT</button>
                <button onClick={() => setShowReport(false)} className="btn-ghost" style={{ fontSize: 12 }}>✕ CLOSE</button>
              </div>
            </div>

            {/* Top accent line */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), rgba(6,182,212,0.5), transparent)' }} />

            {/* Report body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '32px', maxWidth: 880, margin: '0 auto', width: '100%' }}>
              <div className="report">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
