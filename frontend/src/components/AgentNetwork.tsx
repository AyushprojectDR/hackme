'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Stars, Line } from '@react-three/drei'
import * as THREE from 'three'

// ── Agents ─────────────────────────────────────────────────────────────
const AGENTS = [
  { name: 'Explorer',    col: '#a78bfa' },
  { name: 'Skeptic',     col: '#f472b6' },
  { name: 'Statistician',col: '#38bdf8' },
  { name: 'Feat.Eng',    col: '#34d399' },
  { name: 'Ethicist',    col: '#fb923c' },
  { name: 'Pragmatist',  col: '#facc15' },
  { name: "Devil's Adv", col: '#f87171' },
  { name: 'Optimizer',   col: '#818cf8' },
  { name: 'Diagnostic',  col: '#22d3ee' },
  { name: 'CodeWriter',  col: '#4ade80' },
] as const

const EDGES: [number, number][] = [
  [0,1],[0,2],[1,5],[2,5],[3,7],[4,6],[5,9],[6,9],[7,9],[8,9],[5,8],[0,8],[2,3],
]

// Distribute on a tilted ellipse
function nodePos(i: number, total: number): THREE.Vector3 {
  const angle = (2 * Math.PI * i) / total - Math.PI / 2
  const rx = 4.8, ry = 4.8
  return new THREE.Vector3(
    rx * Math.cos(angle),
    ry * Math.sin(angle) * 0.5,
    rx * Math.sin(angle) * 0.38,
  )
}

// ── Expanding ring ──────────────────────────────────────────────────────
function Ring({ color, phase }: { color: string; phase: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef  = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = ((clock.getElapsedTime() * 1.4 + phase) % 1)
    meshRef.current.scale.setScalar(1 + t * 2.8)
    matRef.current.opacity = (1 - t) * 0.6
  })

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.42, 0.48, 64]} />
      <meshBasicMaterial ref={matRef} color={color} transparent side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Node ────────────────────────────────────────────────────────────────
function AgentNode({
  agent, pos, isActive, isDone,
}: {
  agent: typeof AGENTS[number]
  pos: THREE.Vector3
  isActive: boolean
  isDone: boolean
}) {
  const meshRef  = useRef<THREE.Mesh>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (isActive) {
      const p = Math.sin(t * 4) * 0.5 + 0.5
      meshRef.current.scale.setScalar(1 + p * 0.22)
      if (lightRef.current) lightRef.current.intensity = 3 + p * 5
    } else {
      // Slow idle breathe
      const p = Math.sin(t * 1.2 + meshRef.current.uuid.charCodeAt(0)) * 0.5 + 0.5
      meshRef.current.scale.setScalar(0.92 + p * 0.12)
    }
  })

  const emissive  = agent.col
  const emissiveI = isActive ? 8 : isDone ? 0.55 : 0.08
  const baseColor = isActive ? agent.col : isDone ? agent.col : '#0c1a3a'
  const labelCol  = isActive ? '#ffffff' : isDone ? '#64748b' : '#2a3a6a'

  return (
    <group position={pos}>
      {isActive && <pointLight ref={lightRef} color={agent.col} intensity={6} distance={4} />}
      {isActive && <Ring color={agent.col} phase={0} />}
      {isActive && <Ring color={agent.col} phase={0.5} />}

      {/* Fake glow halo (replaces postprocessing Bloom) */}
      <mesh>
        <sphereGeometry args={[isActive ? 0.85 : 0.58, 16, 16]} />
        <meshBasicMaterial color={agent.col} transparent opacity={isActive ? 0.10 : 0.04} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      <mesh ref={meshRef}>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissive}
          emissiveIntensity={emissiveI}
          roughness={0.1}
          metalness={0.95}
          toneMapped={false}
        />
      </mesh>

      <Text
        position={[0, -0.72, 0]}
        fontSize={0.19}
        color={labelCol}
        anchorX="center"
        anchorY="top"
        font="https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-guwFiEY7pl8nQ.woff2"
        renderOrder={1}
      >
        {agent.name}
      </Text>
    </group>
  )
}

// ── Orchestrator ────────────────────────────────────────────────────────
function Orchestrator({ hasActive }: { hasActive: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 1.8) * 0.06)
  })
  return (
    <group>
      <pointLight color="#6366f1" intensity={hasActive ? 4 : 2} distance={6} />
      <mesh ref={ref}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={hasActive ? 6 : 3} roughness={0.05} metalness={0.98} toneMapped={false} />
      </mesh>
      <Text
        position={[0, -0.56, 0]}
        fontSize={0.16}
        color="rgba(167,139,250,0.6)"
        anchorX="center"
        anchorY="top"
        font="https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-guwFiEY7pl8nQ.woff2"
      >
        ORCH
      </Text>
    </group>
  )
}

// ── Scene ───────────────────────────────────────────────────────────────
function Scene({ activeAgents, doneAgents, done }: {
  activeAgents: string[]
  doneAgents:   string[]
  done:         boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.0018
  })

  const positions = useMemo(() => AGENTS.map((_, i) => nodePos(i, AGENTS.length)), [])

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 12, 4]} intensity={1.2} color="#6366f1" />
      <pointLight position={[0, -8, 4]} intensity={0.4} color="#06b6d4" />
      <Stars radius={80} depth={60} count={4000} factor={1.8} fade speed={0.4} />

      <group ref={groupRef}>
        {/* Edges */}
        {EDGES.map(([a, b], i) => {
          const isActive = activeAgents.includes(AGENTS[a].name) || activeAgents.includes(AGENTS[b].name)
          const isDone   = doneAgents.includes(AGENTS[a].name)   && doneAgents.includes(AGENTS[b].name)
          return (
            <Line
              key={i}
              points={[positions[a], positions[b]]}
              color={isActive ? '#6366f1' : isDone ? '#2d3a6e' : '#1a2550'}
              lineWidth={isActive ? 1.2 : 0.6}
              transparent
              opacity={isActive ? 0.85 : isDone ? 0.35 : 0.28}
            />
          )
        })}

        {/* Orch → active lines */}
        {AGENTS.map((ag, i) =>
          activeAgents.includes(ag.name) ? (
            <Line
              key={`o-${i}`}
              points={[new THREE.Vector3(0, 0, 0), positions[i]]}
              color="#6366f1"
              lineWidth={0.8}
              transparent
              opacity={0.35}
              dashed
              dashSize={0.3}
              gapSize={0.2}
            />
          ) : null
        )}

        {/* Nodes */}
        {AGENTS.map((ag, i) => (
          <AgentNode
            key={ag.name}
            agent={ag}
            pos={positions[i]}
            isActive={activeAgents.includes(ag.name)}
            isDone={done || doneAgents.includes(ag.name)}
          />
        ))}
      </group>

      <Orchestrator hasActive={activeAgents.length > 0} />

    </>
  )
}

// ── Export ──────────────────────────────────────────────────────────────
export interface AgentNetworkProps {
  activeAgents: string[]
  doneAgents:   string[]
  done?:        boolean
  height?:      number | string
}

export default function AgentNetwork({ activeAgents, doneAgents, done = false, height = 560 }: AgentNetworkProps) {
  return (
    <div style={{ width: '100%', height, background: 'transparent' }}>
      <Canvas camera={{ position: [0, 2.5, 11], fov: 52 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <Scene activeAgents={activeAgents} doneAgents={doneAgents} done={done} />
      </Canvas>
    </div>
  )
}
