'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Per-stage moon color + label
const STAGE_MOONS = [
  { color: 0x94a3b8, emissive: 0x1e293b, size: 0.16 },
  { color: 0x7dd3fc, emissive: 0x0c4a6e, size: 0.20 },
  { color: 0xc4b5fd, emissive: 0x2e1065, size: 0.23 },
  { color: 0x6ee7b7, emissive: 0x022c22, size: 0.19 },
  { color: 0xfed7aa, emissive: 0x431407, size: 0.18 },
  { color: 0xfda4af, emissive: 0x4c0519, size: 0.20 },
  { color: 0xfde68a, emissive: 0x451a03, size: 0.24 },
]

// ── Procedural Earth texture (canvas — no CDN) ───────────────────────
function makeEarthTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!

  // Ocean base
  const ocean = ctx.createLinearGradient(0, 0, 0, H)
  ocean.addColorStop(0,   '#0d3b8c')
  ocean.addColorStop(0.5, '#1a5296')
  ocean.addColorStop(1,   '#0a2563')
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, W, H)

  // Deep ocean shimmer
  ctx.fillStyle = 'rgba(30,90,180,0.3)'
  for (let i = 0; i < 60; i++) {
    ctx.beginPath()
    ctx.ellipse(Math.random()*W, Math.random()*H, 20+Math.random()*60, 10+Math.random()*30, Math.random()*Math.PI, 0, Math.PI*2)
    ctx.fill()
  }

  // Continents
  const landColors = ['#2d6a14','#3a7a1a','#4a8a22','#326012','#558826']
  const continents = [
    [220,170,75,95,-0.2],  // N America
    [255,320,42,72,0.1],   // S America
    [500,165,42,52,0],     // Europe
    [515,315,52,82,0],     // Africa
    [690,155,135,82,-0.1], // Asia
    [755,355,52,36,0.3],   // Australia
    [150,160,30,20,0],     // Greenland ish
  ]
  continents.forEach(([cx, cy, rx, ry, rot]) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.fillStyle = landColors[Math.floor(Math.random()*landColors.length)]
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2)
    ctx.fill()
    // Rough interior detail
    ctx.fillStyle = 'rgba(80,60,20,0.25)'
    ctx.beginPath()
    ctx.ellipse(rx*0.2, -ry*0.1, rx*0.4, ry*0.3, 0.3, 0, Math.PI*2)
    ctx.fill()
    ctx.restore()
  })

  // Mountain highlights
  ctx.fillStyle = 'rgba(180,160,100,0.18)'
  for (let i = 0; i < 20; i++) {
    ctx.beginPath()
    ctx.ellipse(Math.random()*W, 80+Math.random()*(H-160), 8+Math.random()*20, 4+Math.random()*10, Math.random()*Math.PI, 0, Math.PI*2)
    ctx.fill()
  }

  // Polar ice caps
  const northIce = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, 110)
  northIce.addColorStop(0,   'rgba(230,240,255,0.95)')
  northIce.addColorStop(0.6, 'rgba(200,220,255,0.5)')
  northIce.addColorStop(1,   'rgba(200,220,255,0)')
  ctx.fillStyle = northIce
  ctx.fillRect(0, 0, W, 110)

  const southIce = ctx.createRadialGradient(W/2, H, 0, W/2, H, 90)
  southIce.addColorStop(0,   'rgba(230,240,255,0.95)')
  southIce.addColorStop(0.6, 'rgba(200,220,255,0.5)')
  southIce.addColorStop(1,   'rgba(200,220,255,0)')
  ctx.fillStyle = southIce
  ctx.fillRect(0, H-90, W, 90)

  return new THREE.CanvasTexture(cv)
}

// ── Procedural cloud texture ─────────────────────────────────────────
function makeCloudTexture(): THREE.CanvasTexture {
  const W = 1024, H = 512
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * W
    const y = 30 + Math.random() * (H - 60)
    ctx.beginPath()
    ctx.ellipse(x, y, 15+Math.random()*50, 6+Math.random()*18, Math.random()*Math.PI, 0, Math.PI*2)
    ctx.fill()
  }
  return new THREE.CanvasTexture(cv)
}

// ── Procedural moon texture ──────────────────────────────────────────
function makeMoonTexture(): THREE.CanvasTexture {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S; cv.height = S
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, S, S)
  // Craters
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  for (let i = 0; i < 30; i++) {
    const r = 3 + Math.random() * 14
    ctx.beginPath()
    ctx.arc(Math.random()*S, Math.random()*S, r, 0, Math.PI*2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let i = 0; i < 20; i++) {
    ctx.beginPath()
    ctx.arc(Math.random()*S, Math.random()*S, 2+Math.random()*8, 0, Math.PI*2)
    ctx.fill()
  }
  return new THREE.CanvasTexture(cv)
}

interface Props {
  stageIdx: number
  done: boolean
}

export default function SolarProgress({ stageIdx, done }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current!
    let W = mount.offsetWidth  || 600
    let H = mount.offsetHeight || 600

    // ── Renderer ───────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    mount.appendChild(renderer.domElement)

    // ── Scene / Camera ─────────────────────────────────────────────
    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 100)
    camera.position.set(0, 4.5, 9)
    camera.lookAt(0, 0, 0)

    // ── Lighting ───────────────────────────────────────────────────
    const sunLight = new THREE.DirectionalLight(0xfff4e0, 4.0)
    sunLight.position.set(10, 6, 8)
    sunLight.castShadow = true
    scene.add(sunLight)

    // Rim light from opposite side (blue)
    const rimLight = new THREE.DirectionalLight(0x3366ff, 0.8)
    rimLight.position.set(-8, 2, -6)
    scene.add(rimLight)

    const ambientLight = new THREE.AmbientLight(0x111133, 0.7)
    scene.add(ambientLight)

    // ── Starfield ──────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(4000 * 3)
    for (let i = 0; i < 4000 * 3; i++) starPos[i] = (Math.random() - 0.5) * 120
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.7 })))

    // ── Procedural textures ────────────────────────────────────────
    const earthTex  = makeEarthTexture()
    const cloudTex  = makeCloudTexture()
    const moonTex   = makeMoonTexture()

    // ── Earth ──────────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(1.15, 64, 64)
    const earthMat = new THREE.MeshPhongMaterial({
      map:       earthTex,
      specular:  new THREE.Color(0x2255aa),
      shininess: 28,
    })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    earth.castShadow = true
    earth.receiveShadow = true
    scene.add(earth)

    // Cloud layer
    const cloudGeo = new THREE.SphereGeometry(1.17, 64, 64)
    const cloudMat = new THREE.MeshPhongMaterial({
      map:         cloudTex,
      transparent: true,
      opacity:     0.5,
      depthWrite:  false,
    })
    scene.add(new THREE.Mesh(cloudGeo, cloudMat))

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(1.25, 64, 64)
    const atmMat = new THREE.MeshPhongMaterial({
      color:       0x4488ff,
      transparent: true,
      opacity:     0.10,
      side:        THREE.FrontSide,
      depthWrite:  false,
    })
    scene.add(new THREE.Mesh(atmGeo, atmMat))

    // Additive outer glow
    const glowGeo = new THREE.SphereGeometry(1.38, 32, 32)
    const glowMat = new THREE.MeshBasicMaterial({
      color:       0x2255cc,
      transparent: true,
      opacity:     0.06,
      side:        THREE.BackSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    })
    scene.add(new THREE.Mesh(glowGeo, glowMat))

    // ── Orbital rings & Moons ──────────────────────────────────────
    const N = STAGE_MOONS.length
    // Tighter radii so all moons stay in frame
    const orbitRadii = STAGE_MOONS.map((_, i) => 1.65 + i * 0.50)

    orbitRadii.forEach((r, i) => {
      const isCurrent = i === stageIdx && !done
      const isPast    = i < stageIdx || done
      const geo = new THREE.TorusGeometry(r, isCurrent ? 0.007 : 0.003, 8, 200)
      const mat = new THREE.MeshBasicMaterial({
        color:       isCurrent ? 0x6366f1 : isPast ? 0x334155 : 0x1e293b,
        transparent: true,
        opacity:     isCurrent ? 0.6 : isPast ? 0.22 : 0.10,
      })
      const ring = new THREE.Mesh(geo, mat)
      ring.rotation.x = Math.PI / 2
      scene.add(ring)
    })

    const moonMeshes = STAGE_MOONS.map((sm, i) => {
      const isPast    = i < stageIdx || done
      const isCurrent = i === stageIdx && !done

      const geo = new THREE.SphereGeometry(sm.size, 40, 40)
      const mat = new THREE.MeshPhongMaterial({
        map:               moonTex,
        color:             new THREE.Color(sm.color),
        emissive:          isCurrent
          ? new THREE.Color(sm.color)
          : isPast
            ? new THREE.Color(sm.emissive)
            : new THREE.Color(0x000000),
        emissiveIntensity: isCurrent ? 0.7 : isPast ? 0.18 : 0,
        shininess:         isCurrent ? 60 : 20,
        transparent:       !isCurrent && !isPast,
        opacity:           isCurrent || isPast ? 1 : 0.22,
      })

      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true

      // Glow halo for active moon
      if (isCurrent) {
        const haloGeo = new THREE.SphereGeometry(sm.size * 2.4, 32, 32)
        const haloMat = new THREE.MeshBasicMaterial({
          color:       new THREE.Color(sm.color),
          transparent: true,
          opacity:     0.14,
          side:        THREE.BackSide,
          depthWrite:  false,
          blending:    THREE.AdditiveBlending,
        })
        mesh.add(new THREE.Mesh(haloGeo, haloMat))

        const ptLight = new THREE.PointLight(new THREE.Color(sm.color), 2.2, 4)
        mesh.add(ptLight)
      }

      scene.add(mesh)
      return {
        mesh,
        mat,
        orbitR: orbitRadii[i],
        angle:  (i * 2.39996) - Math.PI * 0.5,
        isCurrent,
      }
    })

    // ── Animate ────────────────────────────────────────────────────
    let t = 0
    let raf: number
    const clouds = scene.children.find(c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.SphereGeometry && (c as THREE.Mesh).geometry.parameters?.radius === 1.17) as THREE.Mesh | undefined

    const tick = () => {
      raf = requestAnimationFrame(tick)
      t += 0.008

      earth.rotation.y = t * 0.15
      if (clouds) clouds.rotation.y = t * 0.18

      moonMeshes.forEach((m, i) => {
        const isCurrent = i === stageIdx && !done
        if (isCurrent) {
          m.angle += 0.004
        } else {
          m.angle += 0.001 * (i % 2 === 0 ? 1 : -1)
        }

        m.mesh.position.set(
          Math.cos(m.angle) * m.orbitR,
          Math.sin(m.angle) * 0.10,
          Math.sin(m.angle) * m.orbitR,
        )
        m.mesh.rotation.y += 0.006

        // Pulse active moon glow
        if (isCurrent) {
          const pulse = Math.sin(t * 3) * 0.5 + 0.5
          m.mat.emissiveIntensity = 0.5 + pulse * 0.5
          const child = m.mesh.children[0] as THREE.Mesh | undefined
          if (child) {
            const s = 1 + pulse * 0.3
            child.scale.setScalar(s)
          }
        }
      })

      renderer.render(scene, camera)
    }
    tick()

    // ── Resize ─────────────────────────────────────────────────────
    const onResize = () => {
      W = mount.offsetWidth; H = mount.offsetHeight
      camera.aspect = W / H
      camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [stageIdx, done])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    />
  )
}
