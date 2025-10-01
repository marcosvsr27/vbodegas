// app/src/pages/admin/Dashboard.tsx
import { useEffect, useState } from "react"
import { adminList } from "../../api"
import type { Bodega } from "../../types"
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts"

const ESTADOS = ["disponible", "apartada", "vendida"] as const
const COLORS = ["#10b981", "#f59e0b", "#ef4444"]

export default function Dashboard() {
  const [bodegas, setBodegas] = useState<Bodega[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await adminList()
        setBodegas(data)
      } catch (err) {
        console.error("❌ Error cargando bodegas", err)
      }
    }
    fetchData()
  }, [])

  // 🔹 Conteo por estado
  const conteoEstado = ESTADOS.map(e => ({
    name: e,
    value: bodegas.filter(b => b.estado === e).length
  }))

  // 🔹 Conteo por módulo
  const modulos = ["A", "B", "C", "D"]
  const conteoModulo = modulos.map(m => ({
    modulo: m,
    disponibles: bodegas.filter(b => b.number.startsWith(m) && b.estado === "disponible").length,
    apartadas: bodegas.filter(b => b.number.startsWith(m) && b.estado === "apartada").length,
    vendidas: bodegas.filter(b => b.number.startsWith(m) && b.estado === "vendida").length
  }))

  // 🔹 Total ocupación %
  const total = bodegas.length || 1
  const ocupacion = ((bodegas.filter(b => b.estado === "vendida").length / total) * 100).toFixed(1)

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">📊 Dashboard General</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-sm text-gray-500">Total de Bodegas</h2>
          <p className="text-2xl font-bold">{bodegas.length}</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-sm text-gray-500">Disponibles</h2>
          <p className="text-2xl font-bold text-green-600">
            {conteoEstado.find(c => c.name === "disponible")?.value || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-sm text-gray-500">Ocupación</h2>
          <p className="text-2xl font-bold text-red-600">{ocupacion}%</p>
        </div>
      </div>

      {/* Gráfica circular de estados */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Distribución por estado</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={conteoEstado}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              dataKey="value"
            >
              {conteoEstado.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfica de barras por módulo */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-lg font-semibold mb-4">Ocupación por módulo</h2>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={conteoModulo}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="modulo" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="disponibles" fill="#10b981" />
            <Bar dataKey="apartadas" fill="#f59e0b" />
            <Bar dataKey="vendidas" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}