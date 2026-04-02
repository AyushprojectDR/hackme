'use client'

import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import CanvasSafe from './CanvasSafe'
import { Stars, Text } from '@react-three/drei'
import * as THREE from 'three'

const AGENTS: { name: string; label: string; color: string }[] = [
  { name: 'explorer',        label: 'EXPLORER',     color: '#a78bfa' },
  { name: 'skeptic',         label: 'SKEPTIC',       color: '#f472b6' },
  { name: 'statistician',    label: 'STATISTICIAN',  color: '#38bdf8' },
  { name: 'feature_engineer',label: 'FEAT.ENG',      color: '#34d399' },
  { name: 'ethicist',        label: 'ETHICIST',      color: '#fb923c' },
  { name: 'pragmatist',      label: 'PRAGMATIST',    color: '#facc15' },
  { name: 'devil_advocate',  label: 'DEVIL ADV',     color: '#f87171' },
  { name: 'optimizer',       label: 'OPTIMIZER',     color: '#818cf8' },
  { name: 'architect',       label: 'ARCHITECT',     color: '#c084fc' },
  { name: 'storyteller',     label: 'STORYTELLER',   color: '#f9a8d4' },
]

const RADIUS = 6.0
const CONNECTIONS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[8,9],[0,9],[1,5],[2,6]
]

function agentPos(i: number): [number, number, number] {
  const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2
  const x = RADIUS * Math.cos(angle)
  const y = RADIUS * Math.sin(angle) * 0.65
  const z = Math.sin(angle * 2) * 1.8
  return [x, y, z]
}

// ── Orchestrator core ──────────────────────────────────────────────────────
function OrchestratorNode() {
  const ringA = useRef<THREE.Mesh>(null!)
  const ringB = useRef<THREE.Mesh>(null!)
  const ringC = useRef<THREE.Mesh>(null!)
  const glow  = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    ringA.current.rotation.z  = t * 0.6
    ringB.current.rotation.z  = -t * 0.4
    ringB.current.rotation.x  = t * 0.3
    ringC.current.rotation.y  = t * 0.5
    glow.current.scale.setScalar(1 + Math.sin(t * 2) * 0.06)
  })

  return (
    <group>
      {/* Core sphere */}
      <mesh>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial color="#ffffff" emissive="#8b9cf4" emissiveIntensity={1.2} roughness={0.1} metalness={0.9} />
      </mesh>
      {/* Glow pulse */}
      <mesh ref={glow}>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.08} />
      </mesh>
      {/* Rings */}
      <mesh ref={ringA}>
        <torusGeometry args={[1.6, 0.012, 8, 64]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[2.1, 0.008, 8, 64]} />
        <meshBasicMaterial color="#06b6d4" />
      </mesh>
      <mesh ref={ringC}>
        <torusGeometry args={[2.6, 0.006, 8, 64]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
      </mesh>
      {/* Point light */}
      <pointLight color="#6366f1" intensity={3} distance={12} />
      <Text
        position={[0, -1.0, 0]}
        fontSize={0.22}
        color="rgba(99,102,241,0.7)"
        font="/fonts/JetBrainsMono-Regular.ttf"
        anchorX="center"
        anchorY="top"
      >
        ORCHESTRATOR
      </Text>
    </group>
  )
}

// ── Agent node ─────────────────────────────────────────────────────────────
function AgentNode({ agent, position, isActive, isDone, isCurrentActive }: {
  agent: typeof AGENTS[0]
  position: [number, number, number]
  isActive: boolean
  isDone: boolean
  isCurrentActive: boolean
}) {
  const mesh   = useRef<THREE.Mesh>(null!)
  const ring   = useRef<THREE.Mesh>(null!)
  const ring2  = useRef<THREE.Mesh>(null!)
  const light  = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (isCurrentActive) {
      const scale = 1 + Math.sin(t * 3) * 0.12
      mesh.current.scale.setScalar(scale)
      ring.current.rotation.z = t * 1.4
      ring2.current.rotation.z = -t * 0.9
      ring2.current.rotation.x = t * 0.4
      if (light.current) light.current.intensity = 1.5 + Math.sin(t * 4) * 0.5
    } else if (isActive || isDone) {
      mesh.current.scale.setScalar(1)
      ring.current.rotation.z = t * 0.4
      ring2.current.rotation.z = -t * 0.3
    }
  })

  const emissiveIntensity = isCurrentActive ? 1.4 : isActive ? 0.6 : isDone ? 0.3 : 0.04
  const nodeColor = isDone ? '#34d399' : agent.color
  const opacity   = isActive || isDone ? 1 : 0.25

  return (
    <group position={position}>
      {/* Sphere */}
      <mesh ref={mesh}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial
          color={nodeColor}
          emissive={nodeColor}
          emissiveIntensity={emissiveIntensity}
          transparent
          opacity={opacity}
          roughness={0.2}
          metalness={0.7}
        />
      </mesh>

      {/* Ring 1 — only show for active/done */}
      <mesh ref={ring} visible={isActive || isDone}>
        <torusGeometry args={[0.52, 0.008, 8, 48]} />
        <meshBasicMaterial color={nodeColor} transparent opacity={isCurrentActive ? 0.9 : 0.4} />
      </mesh>

      {/* Ring 2 — extra ring for currently active */}
      <mesh ref={ring2} visible={isCurrentActive}>
        <torusGeometry args={[0.78, 0.005, 8, 48]} />
        <meshBasicMaterial color={nodeColor} transparent opacity={0.4} />
      </mesh>

      {/* Point light */}
      {(isActive || isDone) && (
        <pointLight ref={light} color={nodeColor} intensity={isCurrentActive ? 2 : 0.6} distance={4} />
      )}

      {/* Label */}
      <Text
        position={[0, -0.58, 0]}
        fontSize={0.14}
        color={isActive || isDone ? nodeColor : 'rgba(255,255,255,0.2)'}
        anchorX="center"
        anchorY="top"
      >
        {agent.label}
      </Text>
    </group>
  )
}

// ── Connection lines ────────────────────────────────────────────────────────
function ConnectionLines({ activeAgents, doneAgents }: { activeAgents: string[], doneAgents: string[] }) {
  const linesRef = useRef<THREE.LineSegments>(null!)
  const t = useRef(0)

  const { positions, colors } = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []

    // Orch → active agents
    AGENTS.forEach((ag, i) => {
      const isActive = activeAgents.includes(ag.name) || doneAgents.includes(ag.name)
      if (!isActive) return
      const p = agentPos(i)
      positions.push(0, 0, 0, ...p)
      const c = new THREE.Color(ag.color)
      colors.push(c.r, c.g, c.b, c.r * 0.5, c.g * 0.5, c.b * 0.5)
    })

    // Agent ↔ agent edges
    CONNECTIONS.forEach(([a, b]) => {
      const pa = agentPos(a)
      const pb = agentPos(b)
      positions.push(...pa, ...pb)
      const ca = new THREE.Color(AGENTS[a].color)
      const cb = new THREE.Color(AGENTS[b].color)
      const dim = 0.12
      colors.push(ca.r * dim, ca.g * dim, ca.b * dim, cb.r * dim, cb.g * dim, cb.b * dim)
    })

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
    }
  }, [activeAgents, doneAgents])

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.8} />
    </lineSegments>
  )
}

// ── Camera auto-pan ────────────────────────────────────────────────────────
function CameraRig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.08
    state.camera.position.x = Math.sin(t) * 1.5
    state.camera.position.y = 2.5 + Math.sin(t * 0.7) * 0.5
    state.camera.lookAt(0, 0, 0)
  })
  return null
}

// ── Main scene ─────────────────────────────────────────────────────────────
function Scene({ activeAgents, doneAgents, activeAgent }: {
  activeAgents: string[]
  doneAgents: string[]
  activeAgent: string
}) {
  return (
    <>
      <Stars radius={150} depth={80} count={6000} factor={5} saturation={0.1} fade speed={0.5} />
      <ambientLight intensity={0.05} />
      <OrchestratorNode />
      {AGENTS.map((ag, i) => (
        <AgentNode
          key={ag.name}
          agent={ag}
          position={agentPos(i)}
          isActive={activeAgents.includes(ag.name)}
          isDone={doneAgents.includes(ag.name)}
          isCurrentActive={activeAgent === ag.name}
        />
      ))}
      <ConnectionLines activeAgents={activeAgents} doneAgents={doneAgents} />
      <fog attach="fog" args={['#000008', 20, 60]} />
      <CameraRig />
    </>
  )
}

export default function AgentOrbit3D({ activeAgents, doneAgents, activeAgent, done }: {
  activeAgents: string[]
  doneAgents: string[]
  activeAgent: string
  done: boolean
}) {
  return (
    <CanvasSafe
      camera={{ position: [0, 2.5, 14], fov: 52 }}
      style={{ position: 'fixed', inset: 0 }}
      dpr={[1, 1.5]}
    >
      <Scene activeAgents={activeAgents} doneAgents={doneAgents} activeAgent={activeAgent} />
    </CanvasSafe>
  )
}
