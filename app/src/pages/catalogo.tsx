// app/src/pages/catalogo.tsx
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

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-hidden">
      <style>{`
        @keyframes cinematic-fade {
          0% { opacity: 0; transform: translateY(100px) scaleY(0.8); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.2); }
          50% { box-shadow: 0 0 80px rgba(16, 185, 129, 0.4); }
        }
        .cinematic-fade { animation: cinematic-fade 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .glow { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 backdrop-blur-2xl bg-white/80 border-b border-gray-200">
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

      <div className="max-w-7xl mx-auto px-6 py-8 pt-24">
        {/* Filtro de Volumen Activo */}
        {filtroVolumen !== null && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-blue-900">Filtro de Volumen Activo</p>
                  <p className="text-sm text-blue-700">
                    Mostrando bodegas con ≥ {filtroVolumen.toFixed(2)} m²
                  </p>
                </div>
              </div>
              <button
                onClick={limpiarFiltroVolumen}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpiar Filtro
              </button>
            </div>
          </div>
        )}

        {/* Panel de Control */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Selector de Planta */}
            <div className="lg:col-span-2 border-2 border-emerald-200 rounded-2xl p-8 bg-emerald-50 hover:border-emerald-400 transition-all">
              <h3 className="text-sm font-semibold text-emerald-700 mb-3 uppercase tracking-wide font-black">Selecciona Planta</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => setPlanta("baja")}
                  className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    planta === "baja"
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                      : "bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200"
                  }`}
                >
                  Planta Baja
                </button>
                <button
                  onClick={() => setPlanta("alta")}
                  className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                    planta === "alta"
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                      : "bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200"
                  }`}
                >
                  Planta Alta
                </button>
              </div>
            </div>

            {/* Stats Box */}
            <div className="border-2 border-blue-200 rounded-2xl p-8 bg-blue-50">
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

          {/* Filtros de Estado */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide font-black">Filtrar por Estado</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setActivos({ ...activos, disponible: !activos.disponible })}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activos.disponible
                    ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-500 shadow-md"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${activos.disponible ? "bg-emerald-500" : "bg-gray-300"}`} />
                Disponible
                <span className="text-xs font-black">{stats.disponible}</span>
              </button>
              <button
                onClick={() => setActivos({ ...activos, apartada: !activos.apartada })}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activos.apartada
                    ? "bg-amber-100 text-amber-700 border-2 border-amber-500 shadow-md"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${activos.apartada ? "bg-amber-500" : "bg-gray-300"}`} />
                Apartada
                <span className="text-xs font-black">{stats.apartada}</span>
              </button>
              <button
                onClick={() => setActivos({ ...activos, rentada: !activos.rentada })}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activos.rentada
                    ? "bg-red-100 text-red-700 border-2 border-red-500 shadow-md"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${activos.rentada ? "bg-red-500" : "bg-gray-300"}`} />
                Rentada
                <span className="text-xs font-black">{stats.rentada}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Plano Interactivo */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Plano Interactivo</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Haz clic en una bodega para más información
            </span>
          </div>
          
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-emerald-200 overflow-hidden relative shadow-inner">
            <canvas ref={hitCanvasRef} width={W} height={H} style={{ display: "none" }} />
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onClick={onClick}
              className="w-full h-auto cursor-pointer block transition-transform hover:scale-[1.01] duration-300"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>

          {/* Leyenda */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span className="text-gray-700 font-medium">Disponible</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-amber-500 rounded"></div>
              <span className="text-gray-700 font-medium">Apartada</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-gray-700 font-medium">Rentada</span>
            </div>
          </div>
        </div>
      </div>

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