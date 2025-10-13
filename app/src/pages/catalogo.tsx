
// app/src/pages/catalogo.tsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { fetchBodegas } from "../api"
import type { Bodega } from "../types"
import ModalBodega from "../components/ModalBodega"
import CartDrawer from "../components/CartDrawer"

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
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

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageCache = useRef<{ [key: string]: HTMLImageElement }>({})
  const colorToPolyMap = useRef<Map<string, any>>(new Map())

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
    const polys = bodegas.filter(b => b.planta === planta && activos[b.estado])
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
  }, [bodegas, planta, activos])

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
    const filtered = bodegas.filter(b => b.planta === planta)
    return {
      total: filtered.length,
      disponible: filtered.filter(b => b.estado === "disponible").length,
      apartada: filtered.filter(b => b.estado === "apartada").length,
      rentada: filtered.filter(b => b.estado === "rentada").length,
    }
  }, [bodegas, planta])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50">
      {/* Header Premium */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40 backdrop-blur-lg bg-white/95">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Catálogo de Bodegas</h1>
                <p className="text-sm text-gray-500 mt-0.5">Seleccione su espacio ideal</p>
              </div>
            </div>
            
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Panel de Control */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 mb-8 backdrop-blur-sm bg-white/95">
          {/* Selector de Planta */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Seleccionar Planta</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setPlanta("baja")}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  planta === "baja"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Planta Baja
                </div>
              </button>
              <button
                onClick={() => setPlanta("alta")}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
                  planta === "alta"
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-2 border-gray-200"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Planta Alta
                </div>
              </button>
            </div>
          </div>

          {/* Filtros de Estado */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Filtrar por Estado</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setActivos({ ...activos, disponible: !activos.disponible })}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activos.disponible
                    ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-500 shadow-md"
                    : "bg-gray-50 text-gray-400 border-2 border-gray-200"
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${activos.disponible ? "bg-emerald-500" : "bg-gray-300"}`} />
                Disponible
                <span className="text-xs bg-white px-2 py-0.5 rounded-full font-bold">{stats.disponible}</span>
              </button>
              <button
                onClick={() => setActivos({ ...activos, apartada: !activos.apartada })}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activos.apartada
                    ? "bg-amber-50 text-amber-700 border-2 border-amber-500 shadow-md"
                    : "bg-gray-50 text-gray-400 border-2 border-gray-200"
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${activos.apartada ? "bg-amber-500" : "bg-gray-300"}`} />
                Apartada
                <span className="text-xs bg-white px-2 py-0.5 rounded-full font-bold">{stats.apartada}</span>
              </button>
              <button
                onClick={() => setActivos({ ...activos, rentada: !activos.rentada })}
                className={`py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  activos.rentada
                    ? "bg-red-50 text-red-700 border-2 border-red-500 shadow-md"
                    : "bg-gray-50 text-gray-400 border-2 border-gray-200"
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${activos.rentada ? "bg-red-500" : "bg-gray-300"}`} />
                rentada
                <span className="text-xs bg-white px-2 py-0.5 rounded-full font-bold">{stats.rentada}</span>
              </button>
            </div>
          </div>

          {/* Estadísticas Rápidas */}
          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.disponible}</p>
              <p className="text-xs text-gray-500 mt-1">Disponibles</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.apartada}</p>
              <p className="text-xs text-gray-500 mt-1">Apartadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rentada}</p>
              <p className="text-xs text-gray-500 mt-1">rentadas</p>
            </div>
          </div>
        </div>

        {/* Plano Interactivo */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Plano Interactivo</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              Haga clic en una bodega para ver detalles
            </div>
          </div>
          
          <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-emerald-100 overflow-hidden shadow-inner">
            <canvas ref={hitCanvasRef} width={W} height={H} style={{ display: "none" }} />
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onClick={onClick}
              className="w-full h-auto cursor-pointer block transition-transform duration-300 hover:scale-[1.01]"
              style={{ maxWidth: "100%", height: "auto" }}
            />
            
            {/* Indicador de interactividad */}
            <div className="absolute top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              <span className="text-sm font-semibold">Interactivo</span>
            </div>
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-6 bg-white rounded-xl shadow-lg border border-gray-100 p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Leyenda</h4>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded border-2 border-emerald-600"></div>
              <span className="text-sm text-gray-700 font-medium">Disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded border-2 border-amber-600"></div>
              <span className="text-sm text-gray-700 font-medium">Apartada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded border-2 border-red-600"></div>
              <span className="text-sm text-gray-700 font-medium">rentada</span>
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
    </div>
  )
}