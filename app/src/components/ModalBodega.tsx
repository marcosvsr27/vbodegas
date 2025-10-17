// ModalBodega.tsx 
import React from "react"
import type { Bodega } from "../types"

type ModalBodegaProps = {
  b: Bodega
  onClose: () => void
  onBuy: () => void
}

export default function ModalBodega({ b, onClose, onBuy }: ModalBodegaProps) {
  if (!b) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <style>{`
        @keyframes modal-slide-up {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-enter { animation: modal-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
      
      <div className="modal-enter bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-gray-100">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-blue-600 px-8 py-12 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <span className="inline-block text-emerald-100 text-sm font-black uppercase tracking-widest mb-3">Bodega</span>
            <h2 className="text-5xl font-black text-white">{b.number}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <div className="space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-4 border border-emerald-200">
                <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2">Medidas</p>
                <p className="text-lg font-black text-gray-900">{b.medidas}</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-4 border border-blue-200">
                <p className="text-xs font-black text-blue-600 uppercase tracking-wider mb-2">Área</p>
                <p className="text-lg font-black text-gray-900">{b.metros} m²</p>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-5 border-2 border-amber-200">
              <p className="text-xs font-black text-amber-700 uppercase tracking-wider mb-2">Precio de Renta</p>
              <p className="text-3xl font-black text-amber-900">
                {b.precio != null ? `$${b.precio.toLocaleString()}` : "N/D"}
              </p>
            </div>

            {/* Extras */}
            {b.cualitativos && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200">
                <p className="text-xs font-black text-purple-600 uppercase tracking-wider mb-2">Características Extras</p>
                <p className="text-sm font-semibold text-gray-700">{b.cualitativos}</p>
              </div>
            )}

            {/* Estado */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <div className={`w-3 h-3 rounded-full ${
                b.estado === "disponible" ? "bg-emerald-500" :
                b.estado === "apartada" ? "bg-amber-500" :
                "bg-red-500"
              }`} />
              <p className="font-bold text-gray-900">
                {b.estado === "disponible"
                  ? "✓ Disponible"
                  : b.estado === "apartada"
                  ? "⏱ Apartada"
                  : "✕ Rentada"}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            className="flex-1 px-6 py-3 rounded-xl bg-white hover:bg-gray-100 border-2 border-gray-300 text-gray-900 font-black transition-all duration-300"
            onClick={onClose}
          >
            CERRAR
          </button>
          {b.estado === "disponible" && (
            <button
              className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:scale-105"
              onClick={() => {
                if (!document.cookie.includes("auth=")) {
                  window.location.href = "/cliente/login";
                } else {
                  onBuy();
                }
              }}
            >
              RENTAR AHORA
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

