// app/src/pages/catalogo.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { fetchBodegas } from "../api"
import type { Bodega } from "../types"
import ModalBodega from "../components/ModalBodega"
import CartDrawer from "../components/CartDrawer"
import CalculadoraVolumen from "../components/CalculadoraVolumen"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:10000';
const W = 1200, H = 800
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_TYooMQauvdEDq54NiTphI7jx"
)

const SVG_W = 3456
const SVG_H = 2304

function connectSSE(
  onMessage: (event: string, data: any) => void
): EventSource {
  const es = new EventSource(`${API_URL}/api/stream`);
  es.onmessage = (ev) => {
    try {
      const parsed = JSON.parse(ev.data)
      if (parsed.event && parsed.data) {
        onMessage(parsed.event, parsed.data)
      }
    } catch (err) {
      console.error("❌ Error parseando SSE:", err)
    }
  }
  es.onerror = (err) => {
    console.error("❌ Error en SSE:", err)
  }
  return es
}

export default function Catalogo() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [planta, setPlanta] = useState<"baja" | "alta">("baja")
  const [activos, setActivos] = useState({ disponible: true, apartada: true, rentada: true })
  const [selected, setSelected] = useState<Bodega | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<Bodega[]>([])
  const [calculadoraOpen, setCalculadoraOpen] = useState(false)
  const [filtroVolumen, setFiltroVolumen] = useState<number | null>(null)
  const [scrollY, setScrollY] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageCache = useRef<{ [key: string]: HTMLImageElement }>({})
  const colorToPolyMap = useRef<Map<string, any>>(new Map())

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    fetchBodegas().then(setBodegas);
  
    const es = new EventSource(`${API_URL}/api/stream`);
  
    es.addEventListener("bodegaUpdate", e => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        setBodegas(prev =>
          prev.map(b => (b.id === data.id ? { ...b, ...data } : b))
        );
      } catch (err) {
        console.error("❌ Error parseando SSE:", err);
      }
    });
  
    es.onerror = err => {
      console.warn("⚠️ SSE error (intentando reconectar)", err);
      es.close();
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };
  
    return () => es.close();
  }, []);

  useEffect(() => {
    const loadImage = (src: string) => {
      if (!imageCache.current[src]) {
        const img = new Image()
        img.src = src
        imageCache.current[src] = img
      }
    }
    loadImage("/baja.svg")
    loadImage("/alta.svg")
  }, [])

  const fondoSrc = planta === "baja" ? "/baja.svg" : "/alta.svg"

  const optimizedPolys = useMemo(() => {
    let polys = bodegas.filter(b => b.planta === planta && activos[b.estado])
    
    if (filtroVolumen !== null) {
      polys = polys.filter(b => b.metros >= filtroVolumen)
    }
    
    colorToPolyMap.current.clear()

    return polys.map((p, index) => {
      const rawPoints = Array.isArray(p.points)
        ? p.points
        : typeof p.points === "string"
        ? JSON.parse(p.points)
        : []

      const parsedPoints = rawPoints.map(([x, y]: [number, number]) => [
        x / SVG_W,
        y / SVG_H,
      ])

      const r = (index >> 16) & 0xff
      const g = (index >> 8) & 0xff
      const b = index & 0xff
      const color = { r, g, b, hex: `rgb(${r},${g},${b})` }
      const colorKey = `${color.r},${color.g},${color.b}`

      colorToPolyMap.current.set(colorKey, p)

      return {
        ...p,
        parsedPoints,
        color,
      }
    })
  }, [bodegas, planta, activos, filtroVolumen])

  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    const img = imageCache.current[fondoSrc]

    if (img && img.complete) {
      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(img, 0, 0, W, H)

      optimizedPolys.forEach(p => {
        if (!p.parsedPoints || p.parsedPoints.length === 0) return
        ctx.beginPath()
        p.parsedPoints.forEach(([x, y]: [number, number], i: number) => {
          const X = x * W
          const Y = y * H
          if (i === 0) ctx.moveTo(X, Y)
          else ctx.lineTo(X, Y)
        })
        ctx.closePath()

        const base =
          p.estado === "disponible"
            ? "#10b981"
            : p.estado === "apartada"
            ? "#f59e0b"
            : "#ef4444"

        ctx.fillStyle = base + "40"
        ctx.strokeStyle = base
        ctx.lineWidth = 1
        ctx.fill()
        ctx.stroke()
      })
    }
  }, [fondoSrc, optimizedPolys])

  const drawHitCanvas = useCallback(() => {
    const hitCanvas = hitCanvasRef.current
    if (!hitCanvas) return
    const hitCtx = hitCanvas.getContext("2d")!
    hitCtx.clearRect(0, 0, W, H)

    optimizedPolys.forEach(p => {
      if (!p.parsedPoints || p.parsedPoints.length === 0) return
      hitCtx.beginPath()
      p.parsedPoints.forEach(([x, y]: [number, number], i: number) => {
        const X = x * W
        const Y = y * H
        if (i === 0) hitCtx.moveTo(X, Y)
        else hitCtx.lineTo(X, Y)
      })
      hitCtx.closePath()
      hitCtx.fillStyle = p.color.hex
      hitCtx.fill()
    })
  }, [optimizedPolys])

  useEffect(() => {
    const img = imageCache.current[fondoSrc]
    if (img && img.complete) {
      drawMainCanvas()
      drawHitCanvas()
    } else if (img) {
      img.onload = () => {
        drawMainCanvas()
        drawHitCanvas()
      }
    }
  }, [drawMainCanvas, drawHitCanvas, fondoSrc])

  const pointAt = useCallback((x: number, y: number) => {
    const hitCanvas = hitCanvasRef.current
    if (!hitCanvas) return null
    const hitCtx = hitCanvas.getContext("2d")!
    const pixelData = hitCtx.getImageData(x, y, 1, 1).data
    if (pixelData[3] === 0) return null
    const colorKey = `${pixelData[0]},${pixelData[1]},${pixelData[2]}`
    return colorToPolyMap.current.get(colorKey) || null
  }, [])

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY
      const clickedPoly = pointAt(x, y)
      if (clickedPoly) {
        setSelected(clickedPoly)
      }
    },
    [pointAt]
  )

  const stats = useMemo(() => {
    let filtered = bodegas.filter(b => b.planta === planta)
    
    if (filtroVolumen !== null) {
      filtered = filtered.filter(b => b.metros >= filtroVolumen)
    }
    
    return {
      total: filtered.length,
      disponible: filtered.filter(b => b.estado === "disponible").length,
      apartada: filtered.filter(b => b.estado === "apartada").length,
      rentada: filtered.filter(b => b.estado === "rentada").length,
    }
  }, [bodegas, planta, filtroVolumen])

  const handleFiltrarPorVolumen = (volumenRequerido: number) => {
    setFiltroVolumen(volumenRequerido)
  }

  const limpiarFiltroVolumen = () => {
    setFiltroVolumen(null)
  }

  const bodegasParaCalculadora = useMemo(() => {
    return bodegas
      .filter(b => b.estado === "disponible")
      .map(b => ({
        id: b.id,
        number: b.number,
        metros: b.metros,
        medidas: b.medidas || "",
      }))
  }, [bodegas])

  const parallaxOffset = scrollY * 0.5
  const heroOpacity = Math.max(1 - scrollY / 300, 0.3)

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      <style>{`
        @keyframes cinematic-fade {
          0% { opacity: 0; transform: translateY(100px) scaleY(0.8); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes slide-in-left {
          0% { opacity: 0; transform: translateX(-60px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.2); }
          50% { box-shadow: 0 0 80px rgba(16, 185, 129, 0.4); }
        }
        @keyframes float-up {
          0% { opacity: 0; transform: translateY(60px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes text-reveal {
          0% { clip-path: inset(0 100% 0 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        .cinematic-fade { animation: cinematic-fade 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .slide-in-left { animation: slide-in-left 0.8s ease-out forwards; }
        .glow { animation: glow-pulse 3s ease-in-out infinite; }
        .float-up { animation: float-up 0.8s ease-out forwards; }
        .text-reveal { animation: text-reveal 1s ease-out forwards; }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
        .stagger-4 { animation-delay: 0.4s; }
      `}</style>

      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-2xl bg-white/80 border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center glow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-gray-900">V<span className="text-emerald-600">BODEGAS</span></h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCalculadoraOpen(true)}
              className="relative bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Calculadora
            </button>
            
            <button
              onClick={() => setCartOpen(true)}
              className="relative bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Carrito
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section - Cinematic */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20 bg-gradient-to-br from-white via-slate-50 to-emerald-50">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-200 rounded-full blur-3xl" style={{opacity: 0.15}} />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-200 rounded-full blur-3xl" style={{opacity: 0.1}} />
        </div>

        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.08) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          transform: `translateY(${parallaxOffset}px)`
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center" style={{opacity: heroOpacity}}>
          <div className="cinematic-fade">
            <div className="mb-8">
              <span className="inline-block px-4 py-2 bg-emerald-100 border border-emerald-400 rounded-full text-emerald-700 font-black text-sm uppercase tracking-widest">
                Catálogo 2024
              </span>
            </div>

            <h2 className="text-7xl md:text-8xl lg:text-9xl font-black leading-none mb-6 tracking-tighter text-gray-900">
              <span className="text-reveal">ESPACIO</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-600 bg-clip-text text-transparent text-reveal">INFINITO</span>
            </h2>

            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 font-light leading-relaxed">
              Experiencia inmersiva en búsqueda de espacios. Visualiza, compara, conquista.
            </p>

            <div className="flex justify-center gap-4">
              <button className="group px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-lg transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-600/40">
                EXPLORAR
              </button>
              <button className="px-8 py-4 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-900 font-bold rounded-lg transition-all">
                CATÁLOGO
              </button>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
            <div className="animate-bounce text-emerald-600 font-black text-sm">DESPLAZA</div>
          </div>
        </div>
      </section>

      {/* Divider Section */}
      <section className="relative h-40 flex items-center justify-center overflow-hidden border-t border-b border-gray-200 bg-white">
        <h3 className="text-5xl md:text-7xl font-black text-gray-100 absolute text-center pointer-events-none">
          PERSONALIZA
        </h3>
        <div className="relative z-10 text-center">
          <span className="inline-block px-6 py-3 bg-emerald-100 border border-emerald-400 rounded-full text-emerald-700 font-black text-lg uppercase tracking-widest">
            ↓ FILTROS AVANZADOS ↓
          </span>
        </div>
      </section>

      {/* Controls Section */}
      <section className="relative py-32 px-6 bg-gradient-to-b from-white via-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Plant Selector */}
            <div className="lg:col-span-2 border-2 border-emerald-200 rounded-2xl p-8 backdrop-blur-sm bg-emerald-50 hover:border-emerald-400 transition-all float-up stagger-1">
              <h4 className="text-sm font-black text-emerald-700 uppercase tracking-widest mb-6">Selecciona Nivel</h4>
              <div className="flex gap-4">
                {["baja", "alta"].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlanta(p)}
                    className={`flex-1 py-6 px-8 rounded-xl font-black text-xl transition-all ${
                      planta === p
                        ? "bg-emerald-600 text-white shadow-2xl shadow-emerald-600/30 scale-105"
                        : "bg-white text-gray-700 border-2 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    {p === "baja" ? "PLANTA BAJA" : "PLANTA ALTA"}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Box */}
            <div className="border-2 border-blue-200 rounded-2xl p-8 backdrop-blur-sm bg-blue-50 float-up stagger-2">
              <h4 className="text-sm font-black text-blue-700 uppercase tracking-widest mb-6">Disponibilidad</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-bold">Total:</span>
                  <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-700 font-bold">Disponibles:</span>
                  <span className="text-2xl font-black text-emerald-600">{stats.disponible}</span>
                </div>
              </div>
            </div>
          </div>

          {/* State Filters */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: "disponible", label: "DISPONIBLE", count: stats.disponible },
              { key: "apartada", label: "APARTADA", count: stats.apartada },
              { key: "rentada", label: "RENTADA", count: stats.rentada },
            ].map((s, i) => (
              <button
                key={s.key}
                onClick={() => setActivos({ ...activos, [s.key]: !activos[s.key] })}
                className={`group relative py-8 px-6 rounded-xl font-black text-lg uppercase tracking-wider transition-all overflow-hidden float-up ${
                  i === 0 ? "stagger-1" : i === 1 ? "stagger-2" : "stagger-3"
                } ${
                  activos[s.key]
                    ? s.key === "disponible" 
                      ? "bg-emerald-100 border-2 border-emerald-500 text-emerald-700 shadow-lg"
                      : s.key === "apartada"
                      ? "bg-amber-100 border-2 border-amber-500 text-amber-700 shadow-lg"
                      : "bg-red-100 border-2 border-red-500 text-red-700 shadow-lg"
                    : "bg-gray-50 border-2 border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                <div className="relative z-10">
                  <div className="text-3xl font-black mb-2">{s.count}</div>
                  <div className="text-xs">{s.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Canvas Section */}
      <section className="relative py-32 px-6 bg-white border-t-2 border-emerald-200">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-6xl font-black mb-4 text-gray-900 float-up">
            MAPA <span className="text-emerald-600">INTERACTIVO</span>
          </h3>
          <p className="text-lg text-gray-600 mb-12 font-light float-up stagger-1">Haz clic en cualquier espacio para explorar</p>

          {filtroVolumen !== null && (
            <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 float-up stagger-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-blue-900">Filtro de Volumen Activo</p>
                    <p className="text-sm text-blue-700">Mostrando bodegas con ≥ {filtroVolumen.toFixed(2)} m²</p>
                  </div>
                </div>
                <button
                  onClick={limpiarFiltroVolumen}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpiar
                </button>
              </div>
            </div>
          )}

          <div className="border-2 border-emerald-300 rounded-2xl overflow-hidden backdrop-blur-sm bg-gray-50 hover:border-emerald-500 transition-all duration-500 float-up stagger-3">
            <canvas ref={hitCanvasRef} width={W} height={H} style={{ display: "none" }} />
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onClick={onClick}
              className="w-full h-auto cursor-crosshair block"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>

          {/* Legend */}
          <div className="mt-12 flex justify-center gap-16 float-up stagger-4">
            {[
              { color: "emerald", label: "DISPONIBLE" },
              { color: "amber", label: "APARTADA" },
              { color: "red", label: "RENTADA" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  item.color === "emerald" ? "bg-emerald-600" :
                  item.color === "amber" ? "bg-amber-500" :
                  "bg-red-500"
                }`} />
                <span className="font-black text-sm text-gray-900 uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative py-32 px-6 bg-gradient-to-b from-white via-emerald-50 to-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-6xl md:text-7xl font-black text-center mb-20 text-gray-900 float-up">
            ¿POR QUÉ <span className="text-emerald-600">VBODEGAS</span>?
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "◆", title: "BÚSQUEDA INTELIGENTE", desc: "IA que entiende tus necesidades", delay: "stagger-1" },
              { icon: "◆", title: "VELOCIDAD", desc: "Reserva en segundos, no minutos", delay: "stagger-2" },
              { icon: "◆", title: "TRANSPARENCIA", desc: "Sin sorpresas, todo visible", delay: "stagger-3" },
            ].map((b, i) => (
              <div key={i} className={`group border-2 border-gray-200 rounded-xl p-8 hover:border-emerald-400 transition-all bg-white hover:bg-emerald-50/50 float-up ${b.delay}`}>
                <div className="text-4xl font-black text-emerald-600 mb-4">{b.icon}</div>
                <h4 className="text-lg font-black text-gray-900 mb-3 uppercase">{b.title}</h4>
                <p className="text-gray-600 font-medium">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-40 px-6 bg-gradient-to-r from-emerald-600 via-emerald-500 to-blue-600 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center text-white">
          <h3 className="text-7xl md:text-8xl font-black mb-8 float-up">
            ¿LISTO?
          </h3>
          <p className="text-2xl font-light mb-12 float-up stagger-1">Comienza tu viaje hacia el espacio perfecto</p>
          <button className="group px-12 py-6 bg-white text-emerald-600 font-black text-xl rounded-lg hover:bg-gray-100 transition-all hover:scale-105 shadow-2xl hover:shadow-emerald-900/30 float-up stagger-2 uppercase tracking-wider">
            EXPLORAR AHORA
          </button>
        </div>
      </section>

      {/* Modal */}
      {selected && (
        <ModalBodega
          b={selected}
          onClose={() => setSelected(null)}
          onBuy={() => setCart([...cart, selected])}
        />
      )}

      {/* Carrito */}
      <CartDrawer open={cartOpen} items={cart} onClose={() => setCartOpen(false)} />

      {/* Calculadora de Volumen */}
      <CalculadoraVolumen
        isOpen={calculadoraOpen}
        onClose={() => setCalculadoraOpen(false)}
        onFiltrar={handleFiltrarPorVolumen}
        bodegasDisponibles={bodegasParaCalculadora}
      />
    </div>
  )
}