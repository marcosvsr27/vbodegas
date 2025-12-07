// CalculadoraVolumen.tsx 
import { useState, useMemo } from "react";

interface Item {
  id: string;
  nombre: string;
  cantidad: number;
  largo: number;
  ancho: number;
  alto: number;
}

interface CalculadoraVolumenProps {
  isOpen: boolean;
  onClose: () => void;
  onFiltrar: (volumenRequerido: number) => void;
  bodegasDisponibles?: Array<{
    id: string;
    number: string;
    metros: number;
    medidas: string;
  }>;
}

const itemsPreestablecidos = [
  { nombre: "Caja pequeña", largo: 40, ancho: 30, alto: 30 },
  { nombre: "Caja mediana", largo: 60, ancho: 40, alto: 40 },
  { nombre: "Caja grande", largo: 80, ancho: 60, alto: 50 },
  { nombre: "Electrodoméstico pequeño", largo: 50, ancho: 50, alto: 60 },
  { nombre: "Electrodoméstico grande", largo: 80, ancho: 70, alto: 90 },
  { nombre: "Mueble pequeño", largo: 100, ancho: 60, alto: 80 },
  { nombre: "Mueble mediano", largo: 150, ancho: 80, alto: 100 },
  { nombre: "Mueble grande", largo: 200, ancho: 100, alto: 120 },
  { nombre: "Colchón individual", largo: 190, ancho: 90, alto: 20 },
  { nombre: "Colchón matrimonial", largo: 190, ancho: 135, alto: 25 },
  { nombre: "Bicicleta", largo: 180, ancho: 60, alto: 110 },
  { nombre: "Llanta de auto", largo: 65, ancho: 65, alto: 20 },
  { nombre: "Personalizado", largo: 0, ancho: 0, alto: 0 },
];

export default function CalculadoraVolumen({
  isOpen,
  onClose,
  onFiltrar,
  bodegasDisponibles = [],
}: CalculadoraVolumenProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [itemSeleccionado, setItemSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [medidaPersonalizada, setMedidaPersonalizada] = useState({
    nombre: "",
    largo: 0,
    ancho: 0,
    alto: 0,
  });
  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false);

  const volumenTotal = useMemo(() => {
    return items.reduce((acc, item) => {
      const volumenItem = (item.largo * item.ancho * item.alto) / 1000000;
      return acc + volumenItem * item.cantidad;
    }, 0);
  }, [items]);

  const espacioRecomendado = useMemo(() => {
    return volumenTotal * 1.3;
  }, [volumenTotal]);

  const bodegasRecomendadas = useMemo(() => {
    return bodegasDisponibles
      .filter((b) => b.metros >= espacioRecomendado)
      .sort((a, b) => a.metros - b.metros)
      .slice(0, 5);
  }, [bodegasDisponibles, espacioRecomendado]);

  const agregarItem = () => {
    if (mostrarPersonalizado) {
      if (!medidaPersonalizada.nombre || medidaPersonalizada.largo <= 0 || medidaPersonalizada.ancho <= 0 || medidaPersonalizada.alto <= 0) {
        alert("Por favor complete todas las medidas personalizadas");
        return;
      }
      const nuevoItem: Item = {
        id: Date.now().toString(),
        nombre: medidaPersonalizada.nombre,
        cantidad,
        largo: medidaPersonalizada.largo,
        ancho: medidaPersonalizada.ancho,
        alto: medidaPersonalizada.alto,
      };
      setItems([...items, nuevoItem]);
      setMedidaPersonalizada({ nombre: "", largo: 0, ancho: 0, alto: 0 });
      setMostrarPersonalizado(false);
    } else {
      if (!itemSeleccionado) return;
      const itemTemplate = itemsPreestablecidos.find((i) => i.nombre === itemSeleccionado);
      if (!itemTemplate) return;

      const nuevoItem: Item = {
        id: Date.now().toString(),
        nombre: itemTemplate.nombre,
        cantidad,
        largo: itemTemplate.largo,
        ancho: itemTemplate.ancho,
        alto: itemTemplate.alto,
      };
      setItems([...items, nuevoItem]);
    }
    
    setCantidad(1);
    setItemSeleccionado("");
  };

  const eliminarItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const limpiarTodo = () => {
    setItems([]);
    setItemSeleccionado("");
    setCantidad(1);
    setMedidaPersonalizada({ nombre: "", largo: 0, ancho: 0, alto: 0 });
    setMostrarPersonalizado(false);
  };

  const handleFiltrar = () => {
    onFiltrar(espacioRecomendado);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-blue-600 px-8 py-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Calculadora de Volumen</h2>
              <p className="text-emerald-100 text-xs font-semibold">Encuentra el tamaño perfecto</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border-2 border-emerald-200 p-6">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar Artículos
                </h3>

                <div className="mb-4">
                  <button
                    onClick={() => setMostrarPersonalizado(!mostrarPersonalizado)}
                    className={`w-full py-3 px-4 rounded-xl font-black transition-all duration-300 flex items-center justify-center gap-2 text-sm uppercase tracking-wider ${
                      mostrarPersonalizado
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {mostrarPersonalizado ? "← Predefinidos" : "Personalizado →"}
                  </button>
                </div>

                {!mostrarPersonalizado ? (
                  <>
                    <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Tipo</label>
                    <select
                      value={itemSeleccionado}
                      onChange={(e) => setItemSeleccionado(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 bg-white mb-4 font-semibold"
                    >
                      <option value="">Seleccione un artículo...</option>
                      {itemsPreestablecidos.filter(i => i.nombre !== "Personalizado").map((item) => (
                        <option key={item.nombre} value={item.nombre}>
                          {item.nombre} ({item.largo}×{item.ancho}×{item.alto} cm)
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Nombre</label>
                      <input
                        type="text"
                        value={medidaPersonalizada.nombre}
                        onChange={(e) => setMedidaPersonalizada({ ...medidaPersonalizada, nombre: e.target.value })}
                        placeholder="Ej: Mueble especial"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Largo</label>
                        <input
                          type="number"
                          value={medidaPersonalizada.largo || ""}
                          onChange={(e) => setMedidaPersonalizada({ ...medidaPersonalizada, largo: Number(e.target.value) })}
                          placeholder="cm"
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Ancho</label>
                        <input
                          type="number"
                          value={medidaPersonalizada.ancho || ""}
                          onChange={(e) => setMedidaPersonalizada({ ...medidaPersonalizada, ancho: Number(e.target.value) })}
                          placeholder="cm"
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Alto</label>
                        <input
                          type="number"
                          value={medidaPersonalizada.alto || ""}
                          onChange={(e) => setMedidaPersonalizada({ ...medidaPersonalizada, alto: Number(e.target.value) })}
                          placeholder="cm"
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <label className="block text-xs font-black text-gray-700 mb-2 mt-4 uppercase tracking-wider">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all duration-200 mb-4 font-semibold"
                />

                <button
                  onClick={agregarItem}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-3 px-6 rounded-xl font-black hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 flex items-center justify-center gap-2 uppercase tracking-wider text-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar
                </button>
              </div>

              {items.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-gray-900">Artículos ({items.length})</h3>
                    <button
                      onClick={limpiarTodo}
                      className="text-red-600 hover:text-red-700 text-xs font-black uppercase tracking-wider flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Limpiar
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 transition-colors duration-200 border border-gray-200">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-900 text-sm">{item.nombre}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {item.largo}×{item.ancho}×{item.alto} cm | Qty: {item.cantidad}
                          </p>
                          <p className="text-xs text-emerald-600 font-black mt-1">
                            {((item.largo * item.ancho * item.alto * item.cantidad) / 1000000).toFixed(2)} m³
                          </p>
                        </div>
                        <button
                          onClick={() => eliminarItem(item.id)}
                          className="ml-4 w-8 h-8 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Results */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl border border-emerald-400">
                <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Resumen
                </h3>
                <div className="space-y-3">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <p className="text-emerald-100 text-xs font-black uppercase tracking-wider mb-1">Volumen Total</p>
                    <p className="text-3xl font-black">{volumenTotal.toFixed(2)} m³</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <p className="text-emerald-100 text-xs font-black uppercase tracking-wider mb-1">Espacio (+30%)</p>
                    <p className="text-3xl font-black">{espacioRecomendado.toFixed(2)} m²</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <p className="text-emerald-100 text-xs font-black uppercase tracking-wider mb-1">Artículos</p>
                    <p className="text-2xl font-black">{items.reduce((acc, item) => acc + item.cantidad, 0)} unidades</p>
                  </div>
                </div>
              </div>

              {/* Recommended Warehouses */}
              {bodegasRecomendadas.length > 0 && items.length > 0 && (
                <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
                  <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Recomendadas
                  </h3>
                  <div className="space-y-2">
                    {bodegasRecomendadas.map((bodega) => (
                      <div key={bodega.id} className="bg-emerald-50 rounded-xl p-4 border-2 border-emerald-200 hover:border-emerald-400 transition-colors duration-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-black text-emerald-900">Bodega {bodega.number}</p>
                            <p className="text-xs text-emerald-700">{bodega.medidas}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-600">{bodega.metros}m²</p>
                            <p className="text-xs text-emerald-600 font-semibold">
                              +{((bodega.metros / espacioRecomendado - 1) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {items.length === 0 && (
                <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 p-8 text-center">
                  <svg className="w-14 h-14 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-600 font-black text-sm">Agrega artículos para empezar</p>
                  <p className="text-xs text-gray-500 mt-1">Predefinidos o personalizado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-black text-gray-700 bg-white hover:bg-gray-100 border-2 border-gray-300 transition-all duration-200 uppercase text-sm tracking-wider"
          >
            Cerrar
          </button>
          {items.length > 0 && (
            <button
              onClick={handleFiltrar}
              className="px-8 py-3 rounded-xl font-black text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300 flex items-center gap-2 uppercase text-sm tracking-wider"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filtrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}