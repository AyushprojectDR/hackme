'use client'

import React, { useState, useEffect } from 'react'
import { Canvas, CanvasProps } from '@react-three/fiber'

function checkWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    const ctx = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!ctx) return false
    const ext = (ctx as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    ext?.loseContext()
    return true
  } catch {
    return false
  }
}

interface Props extends CanvasProps { children: React.ReactNode }

/** Drop-in replacement for R3F <Canvas> that won't crash on WebGL context failure */
export default function CanvasSafe({ children, ...props }: Props) {
  const [ready,    setReady]   = useState(false)
  const [glError,  setGlError] = useState<string | null>(null)
  const [r3fError, setR3fError] = useState<string | null>(null)

  useEffect(() => {
    if (checkWebGL()) setReady(true)
    else              setGlError('WebGL not available in this browser/environment.')
  }, [])

  if (glError) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000008',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: '#f87171', textAlign: 'center', padding: 24,
          border: '1px solid #f8717133', borderRadius: 8,
        }}>
          ⚠ {glError}
        </div>
      </div>
    )
  }

  if (r3fError) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000008',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: '#f87171', textAlign: 'center', padding: 24,
          border: '1px solid #f8717133', borderRadius: 8, maxWidth: 480,
        }}>
          ⚠ 3D scene error:<br /><br />{r3fError}
        </div>
      </div>
    )
  }

  if (!ready) return null

  return (
    <Canvas
      {...props}
      gl={{
        powerPreference: 'high-performance',
        antialias: true,
        alpha: false,
        failIfMajorPerformanceCaveat: false,
        ...(props.gl as object | undefined),
      }}
      onCreated={(state) => {
        state.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      }}
      onError={(e) => setR3fError(String(e))}
    >
      {children}
    </Canvas>
  )
}
