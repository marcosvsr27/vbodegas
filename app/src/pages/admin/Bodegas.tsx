// app/src/pages/admin/Bodegas.tsx
import { useEffect, useState, useMemo, useRef } from "react"
import { adminList, adminPatch } from "../../api"
import type { Bodega } from "../../types"

const W = 1200, H = 800
const SVG_W = 3456, SVG_H = 2304

export default function AdminBodegas() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])
  const [planta, setPlanta] = useState<"baja" | "alta">("baja")
  const [edit, setEdit] = useState<Bodega | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Cargar bodegas al inicio
  useEffect(() => {
    load()
  }, [])

  async function load() {
    const all = await adminList()
    setBodegas(all)
  }

  const polys = useMemo(() => {
    return bodegas
      .filter(b => b.planta === planta)
      .map(b => ({
        ...b,
        parsedPoints: b.points.map(([x, y]) => [x / SVG_W * W, y / SVG_H * H])
      }))
  }, [bodegas, planta])

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Gestión de Bodegas</h2>
      <button
        onClick={() => setPlanta(planta === "baja" ? "alta" : "baja")}
        className="mb-4 px-3 py-1 rounded bg-gray-200"
      >
        Cambiar a planta {planta === "baja" ? "alta" : "baja"}
      </button>

      {/* Canvas plano */}
      <canvas ref={canvasRef} width={W} height={H} className="border" />

      {/* Tabla rápida */}
      <table className="mt-6 w-full text-sm border">
        <thead>
          <tr className="bg-gray-100">
            <th>ID</th>
            <th>Metros</th>
            <th>Precio</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {bodegas.map(b => (
            <tr key={b.id} className="border-t">
              <td>{b.number}</td>
              <td>{b.metros} m²</td>
              <td>${b.precio?.toLocaleString()}</td>
              <td>{b.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}