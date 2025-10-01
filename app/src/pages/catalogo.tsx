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

// ⚡ Dimensiones originales del SVG
const SVG_W = 3456
const SVG_H = 2304

// 🔹 Helper para SSE
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
  const [activos, setActivos] = useState({ disponible: true, apartada: true, vendida: true })
  const [selected, setSelected] = useState<Bodega | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<Bodega[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitCanvasRef = useRef<HTMLCanvasElement>(null)
  const imageCache = useRef<{ [key: string]: HTMLImageElement }>({})
  const colorToPolyMap = useRef<Map<string, any>>(new Map())

  // 🔹 Traer bodegas + escuchar SSE
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
      // intentar reconexión en 5s
      setTimeout(() => {
        window.location.reload(); // o volver a abrir SSE
      }, 5000);
    };
  
    return () => es.close();
  }, []);

  // 🔹 Pre-cargar imágenes de fondo
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

  // 🔹 Normalizar polígonos
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

      // Generar color único invisible para el hit-test
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

  // 🔹 Dibujar en canvas principal
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

  // 🔹 Dibujar canvas de hit-testing
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

  // 🔹 Redibujar al cargar fondo o bodegas
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

  // 🔹 Buscar polígono por click
  const pointAt = useCallback((x: number, y: number) => {
    const hitCanvas = hitCanvasRef.current
    if (!hitCanvas) return null
    const hitCtx = hitCanvas.getContext("2d")!
    const pixelData = hitCtx.getImageData(x, y, 1, 1).data
    if (pixelData[3] === 0) return null // transparente → fuera
    const colorKey = `${pixelData[0]},${pixelData[1]},${pixelData[2]}`
    return colorToPolyMap.current.get(colorKey) || null
  }, [])

  // 🔹 Handler de click con escala corregida
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🔘 Toggle Planta */}
      <div className="flex gap-4 p-4">
        <button
          onClick={() => setPlanta("baja")}
          className={`px-4 py-2 rounded ${planta === "baja" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Planta Baja
        </button>
        <button
          onClick={() => setPlanta("alta")}
          className={`px-4 py-2 rounded ${planta === "alta" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
        >
          Planta Alta
        </button>
      </div>

      {/* Plano interactivo */}
      <div className="p-6">
        <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden relative">
          <canvas ref={hitCanvasRef} width={W} height={H} style={{ display: "none" }} />
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={onClick}
            className="w-full h-auto cursor-pointer block"
            style={{ maxWidth: "100%", height: "auto" }}
          />
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