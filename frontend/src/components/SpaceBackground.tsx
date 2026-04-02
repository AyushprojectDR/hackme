'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import CanvasSafe from './CanvasSafe'
import { Stars } from '@react-three/drei'
import * as THREE from 'three'

function FloatingWireframe({ position, geometry, color, speed }: {
  position: [number, number, number]
  geometry: 'icosahedron' | 'octahedron' | 'tetrahedron' | 'dodecahedron'
  color: string
  speed: [number, number, number]
}) {
  const mesh = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    mesh.current.rotation.x += delta * speed[0]
    mesh.current.rotation.y += delta * speed[1]
    mesh.current.rotation.z += delta * speed[2]
  })

  const geo = {
    icosahedron:  <icosahedronGeometry args={[1, 0]} />,
    octahedron:   <octahedronGeometry args={[1, 0]} />,
    tetrahedron:  <tetrahedronGeometry args={[1, 0]} />,
    dodecahedron: <dodecahedronGeometry args={[1, 0]} />,
  }[geometry]

  return (
    <mesh ref={mesh} position={position}>
      {geo}
      <meshBasicMaterial color={color} wireframe opacity={0.35} transparent />
    </mesh>
  )
}

function HoloGrid() {
  return (
    <>
      <gridHelper args={[80, 40, '#1e1b4b', '#0f0a2a']} position={[0, -7, 0]} />
      <gridHelper args={[80, 20, '#6366f1', '#1e1b4b']} position={[0, -7.01, 0]} />
    </>
  )
}

function FloatingParticles() {
  const count = 120
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 40
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20
  }

  const geo = useRef<THREE.BufferGeometry>(null!)
  const mat = useRef<THREE.PointsMaterial>(null!)
  const t = useRef(0)

  useFrame((_, delta) => {
    t.current += delta * 0.2
    const pos = geo.current.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += Math.sin(t.current + i) * 0.002
    }
    geo.current.attributes.position.needsUpdate = true
    mat.current.opacity = 0.5 + Math.sin(t.current) * 0.1
  })

  return (
    <points>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} size={0.04} color="#6366f1" transparent opacity={0.5} sizeAttenuation />
    </points>
  )
}

function Scene() {
  return (
    <>
      <Stars radius={120} depth={60} count={5000} factor={5} saturation={0.1} fade speed={0.8} />
      <FloatingParticles />
      <FloatingWireframe position={[-9, 3, -8]}  geometry="icosahedron"  color="#6366f1" speed={[0.18, 0.22, 0.06]} />
      <FloatingWireframe position={[10, -2, -10]} geometry="octahedron"   color="#06b6d4" speed={[0.14, 0.10, 0.20]} />
      <FloatingWireframe position={[5,  7, -12]}  geometry="dodecahedron" color="#a855f7" speed={[0.08, 0.18, 0.12]} />
      <FloatingWireframe position={[-7, -4, -6]}  geometry="tetrahedron"  color="#f472b6" speed={[0.20, 0.08, 0.16]} />
      <FloatingWireframe position={[3, -6, -9]}   geometry="icosahedron"  color="#06b6d4" speed={[0.12, 0.24, 0.10]} />
      <HoloGrid />
      <fog attach="fog" args={['#000008', 30, 80]} />
    </>
  )
}

export default function SpaceBackground() {
  return (
    <CanvasSafe
      camera={{ position: [0, 2, 14], fov: 55 }}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      dpr={[1, 1.5]}
    >
      <Scene />
    </CanvasSafe>
  )
}
