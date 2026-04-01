'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'

// ── Agent definitions ────────────────────────────────────────────────
const AGENTS = [
  { name: 'Explorer',    color: '#a78bfa' },
  { name: 'Skeptic',     color: '#f472b6' },
  { name: 'Statistician',color: '#38bdf8' },
  { name: 'Feat.Eng',    color: '#34d399' },
  { name: 'Ethicist',    color: '#fb923c' },
  { name: 'Pragmatist',  color: '#facc15' },
  { name: "Devil's Adv", color: '#f87171' },
  { name: 'Optimizer',   color: '#818cf8' },
  { name: 'Diagnostic',  color: '#22d3ee' },
  { name: 'CodeWriter',  color: '#4ade80' },
] as const

const EDGES: [number, number][] = [
  [0,1],[0,2],[1,5],[2,5],[3,7],[4,6],[5,9],[6,9],[7,9],[8,9],[5,8],[0,8],[2,3],
]

// ── Helpers ──────────────────────────────────────────────────────────
function hexToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex)
  return new THREE.Vector3(c.r, c.g, c.b)
}

function ringPos(i: number, total: number, rx: number, ry: number, rotY: number) {
  const angle = (2 * Math.PI * i) / total - Math.PI / 2 + rotY
  return new THREE.Vector3(
    rx * Math.cos(angle),
    ry * Math.sin(angle) * 0.45,  // slight perspective tilt
    rx * Math.sin(angle) * 0.35,
  )
}

// ── Pulse ring ───────────────────────────────────────────────────────
function PulseRing({ radius, color, phase }: { radius: number; color: string; phase: number }) {
  const ref = useRef<THREE.Mesh>(null!)
  const mat  = useRef<THREE.MeshBasicMaterial>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = (Math.sin(t * 2.5 + phase) * 0.5 + 0.5)
    ref.current.scale.setScalar(1 + p * 0.9)
    mat.current.opacity = (1 - p) * 0.7
  })

  return (
    <mesh ref={ref}>
      <ringGeometry args={[radius, radius + 0.04, 48]} />
      <meshBasicMaterial ref={mat} color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Orbiting particle ────────────────────────────────────────────────
function OrbitParticle({ color, speed, orbitR, phase }: {
  color: string; speed: number; orbitR: number; phase: number
}) {
  const ref = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + phase
    ref.current.position.set(Math.cos(t) * orbitR, Math.sin(t) * orbitR * 0.5, Math.sin(t) * orbitR * 0.3)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// ── Single agent node ─────────────────────────────────────────────────
function AgentNode({
  agent, index, totalAgents, rotY, isActive, isDone,
}: {
  agent: typeof AGENTS[number]
  index: number
  totalAgents: number
  rotY: number
  isActive: boolean
  isDone: boolean
}) {
  const meshRef  = useRef<THREE.Mesh>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const position = ringPos(index, totalAgents, 4.2, 4.2, rotY)

  const emissiveIntensity = isActive ? 4.5 : isDone ? 0.6 : 0.04
  const nodeColor         = isActive ? agent.color : isDone ? agent.color : '#0a0f28'
  const emissiveColor     = isActive ? agent.color : isDone ? agent.color : '#000000'
  const labelColor        = isActive ? '#ffffff'  : isDone ? '#94a3b8' : '#1e2a4a'

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    if (isActive) {
      const p = Math.sin(clock.getElapsedTime() * 3.5 + index) * 0.5 + 0.5
      meshRef.current.scale.setScalar(1 + p * 0.18)
      if (lightRef.current) lightRef.current.intensity = 2 + p * 3
    } else {
      meshRef.current.scale.setScalar(1)
    }
  })

  return (
    <group position={position}>
      {/* Glow light */}
      {isActive && (
        <pointLight ref={lightRef} color={agent.color} intensity={4} distance={3} />
      )}

      {/* Pulse rings */}
      {isActive && (
        <>
          <PulseRing radius={0.55} color={agent.color} phase={0} />
          <PulseRing radius={0.55} color={agent.color} phase={Math.PI} />
        </>
      )}

      {/* Orbiting particles */}
      {isActive && [0, 1, 2].map(i => (
        <OrbitParticle
          key={i}
          color={agent.color}
          speed={1.2 + i * 0.4}
          orbitR={0.8}
          phase={(i * Math.PI * 2) / 3}
        />
      ))}

      {/* Main sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial
          color={nodeColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.15}
          metalness={0.9}
        />
      </mesh>

      {/* Label */}
      <Text
        position={[0, -0.7, 0]}
        fontSize={0.21}
        color={labelColor}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"
      >
        {agent.name}
      </Text>
    </group>
  )
}

// ── Orchestrator node ─────────────────────────────────────────────────
function OrchestratorNode({ hasActive }: { hasActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    meshRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.06)
  })
  return (
    <group>
      <pointLight color="#6366f1" intensity={hasActive ? 3 : 1.5} distance={5} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          color="#6366f1"
          emissive="#6366f1"
          emissiveIntensity={hasActive ? 3 : 1.5}
          roughness={0.1}
          metalness={0.95}
        />
      </mesh>
      <Text
        position={[0, -0.55, 0]}
        fontSize={0.17}
        color="#a78bfa"
        anchorX="center"
        anchorY="middle"
      >
        ORCH
      </Text>
    </group>
  )
}

// ── Edges ─────────────────────────────────────────────────────────────
function Edges({
  rotY, activeAgents, doneAgents,
}: {
  rotY: number
  activeAgents: string[]
  doneAgents: string[]
}) {
  const lineRefs = useRef<(THREE.Line | null)[]>([])

  useFrame(({ clock }) => {
    EDGES.forEach((_, i) => {
      const line = lineRefs.current[i]
      if (!line) return
      const mat = line.material as THREE.LineDashedMaterial
      mat.dashOffset = -clock.getElapsedTime() * 0.8
    })
  })

  return (
    <>
      {EDGES.map(([a, b], i) => {
        const pa = ringPos(a, AGENTS.length, 4.2, 4.2, rotY)
        const pb = ringPos(b, AGENTS.length, 4.2, 4.2, rotY)
        const isActive = activeAgents.includes(AGENTS[a].name) || activeAgents.includes(AGENTS[b].name)
        const isDone   = doneAgents.includes(AGENTS[a].name)   && doneAgents.includes(AGENTS[b].name)

        const color     = isActive ? '#6366f1' : isDone ? 'rgba(99,102,241,0.25)' : '#0d1240'
        const opacity   = isActive ? 0.8 : isDone ? 0.25 : 0.12
        const linewidth = isActive ? 1.5 : 1

        return (
          <line
            key={i}
            ref={el => { lineRefs.current[i] = el as THREE.Line | null }}
          >
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color={color} transparent opacity={opacity} linewidth={linewidth} />
          </line>
        )
      })}
    </>
  )
}

// ── Orch → active connections ─────────────────────────────────────────
function ActiveConnections({ rotY, activeAgents }: { rotY: number; activeAgents: string[] }) {
  return (
    <>
      {AGENTS.map((ag, i) => {
        if (!activeAgents.includes(ag.name)) return null
        const p = ringPos(i, AGENTS.length, 4.2, 4.2, rotY)
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([0, 0, 0, p.x, p.y, p.z]), 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#6366f1" transparent opacity={0.35} linewidth={1} />
          </line>
        )
      })}
    </>
  )
}

// ── Scene (all 3D content inside Canvas) ─────────────────────────────
function Scene({
  activeAgents, doneAgents, done,
}: {
  activeAgents: string[]
  doneAgents:   string[]
  done:         boolean
}) {
  const rotRef = useRef(0)
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    rotRef.current += 0.002
    if (groupRef.current) groupRef.current.rotation.y = rotRef.current
  })

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 10, 0]} intensity={0.5} color="#6366f1" />

      {/* Starfield background */}
      <Stars radius={60} depth={50} count={3000} factor={2} fade speed={0.5} />

      {/* Rotating group */}
      <group ref={groupRef}>
        <Edges rotY={0} activeAgents={activeAgents} doneAgents={doneAgents} />
        <ActiveConnections rotY={0} activeAgents={activeAgents} />

        {AGENTS.map((ag, i) => (
          <AgentNode
            key={ag.name}
            agent={ag}
            index={i}
            totalAgents={AGENTS.length}
            rotY={0}
            isActive={activeAgents.includes(ag.name)}
            isDone={done || doneAgents.includes(ag.name)}
          />
        ))}
      </group>

      {/* Orchestrator — fixed in center */}
      <OrchestratorNode hasActive={activeAgents.length > 0} />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          intensity={activeAgents.length > 0 ? 2.2 : 1.2}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.3} darkness={0.7} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </>
  )
}

// ── Public component ──────────────────────────────────────────────────
export interface AgentNetworkProps {
  activeAgents: string[]
  doneAgents:   string[]
  done?:        boolean
  height?:      number
}

export default function AgentNetwork({
  activeAgents,
  doneAgents,
  done = false,
  height = 560,
}: AgentNetworkProps) {
  return (
    <div style={{ height, width: '100%', background: 'transparent' }}>
      <Canvas
        camera={{ position: [0, 3, 10], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene activeAgents={activeAgents} doneAgents={doneAgents} done={done} />
      </Canvas>
    </div>
  )
}
