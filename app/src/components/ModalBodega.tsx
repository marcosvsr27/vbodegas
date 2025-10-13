import React from "react"
import type { Bodega } from "../types"

type ModalBodegaProps = {
  b: Bodega
  onClose: () => void
  onBuy: () => void
}

export default function ModalBodega({ b, onClose, onBuy }: ModalBodegaProps) {
  if (!b) return null; // 👈 evita renderizar modal vacío
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Bodega {b.number}</h2>

        <div className="space-y-2 text-sm">
          <p>
            <strong>Medidas:</strong> {b.medidas}
          </p>
          <p>
            <strong>Área:</strong> {b.metros} m²
          </p>
          <p>
  <strong>Precio renta:</strong> 
  {b.precio != null ? `$${b.precio.toLocaleString()}` : "N/D"}
</p>
          {b.cualitativos && (
            <p>
              <strong>Extras:</strong> {b.cualitativos}
            </p>
          )}
          <p>
            <strong>Estado:</strong>{" "}
            {b.estado === "disponible"
              ? "✅ Disponible"
              : b.estado === "apartada"
              ? "⏳ Apartada"
              : "❌ rentada"}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            onClick={onClose}
          >
            Cerrar
          </button>
          {b.estado === "disponible" && (
  <button
    className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
    onClick={() => {
      // verifica si hay sesión
      if (!document.cookie.includes("auth=")) {
        window.location.href = "/cliente/login"; // redirige a login
      } else {
        onBuy();
      }
    }}
  >
    Rentar ahora
  </button>
)}
        </div>
      </div>
    </div>
  )
}