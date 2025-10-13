// app/src/pages/admin/AdminPanel.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { adminList as fetchAll, adminPatch, me, getClientes, adminStatsReal, updateCliente } from "./../api";
import type { Bodega, Cliente, EstadisticasAdmin } from "./../types";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useNavigate, Link } from "react-router-dom";
import dayjs from "dayjs";
import * as XLSX from 'xlsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const W = 1200, H = 800;
const SVG_W = 3456, SVG_H = 2304;
const COLORS = { disponible: "#10b981", apartada: "#f59e0b", vendida: "#ef4444" };
const FILL_ALPHA = "40";
type Estado = "disponible" | "apartada" | "vendida";

function diasRestantes(inicio?: string, fin?: string) {
  if (!fin) return null;
  const d = dayjs(fin).diff(dayjs(), "day");
  return d;
}

export default function AdminPanel() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function checkAuth() {
      const data = await me();
      const rolesValidos = ["admin", "superadmin", "editor", "viewer"];
      if (!data || !rolesValidos.includes(data.rol)) {
        navigate("/admin/login");
      } else {
        setUser(data);
      }
      setLoading(false);
    }
    checkAuth();
  }, [navigate]);

  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [stats, setStats] = useState<EstadisticasAdmin | null>(null);
  const [planta, setPlanta] = useState<"baja" | "alta">("baja");
  
  // Filtros mejorados con selección múltiple
  const [estadoFilter, setEstadoFilter] = useState<Estado[]>([]);
  const [moduloFilter, setModuloFilter] = useState<string[]>([]);
  const [precioMin, setPrecioMin] = useState<number | "">("");
  const [precioMax, setPrecioMax] = useState<number | "">("");
  const [medidaFilter, setMedidaFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Bodega | null>(null);

  const [clienteModal, setClienteModal] = useState<Cliente | null>(null);
  const [asignarModal, setAsignarModal] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const colorToPolyMap = useRef<Map<string, Bodega>>(new Map());
  const tableRefs = useRef<Record<string, HTMLTableRowElement>>({});

  const [drafts, setDrafts] = useState<Record<string, Partial<Bodega>>>({});
  function updateDraft(id: string, patch: Partial<Bodega>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }
  async function saveDraft(id: string) {
    if (!drafts[id]) return;
    await onSave(bodegas.find((b) => b.id === id)!, drafts[id]);
    setDrafts((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  // Cargar datos
  useEffect(() => {
    let closed = false;
    async function load() {
      try {
        const [allBodegas, allClientes, estadisticas] = await Promise.all([
          fetchAll(),
          getClientes(),
          adminStatsReal()
        ]);
        if (!closed) {
          setBodegas(allBodegas);
          setClientes(allClientes);
          setStats(estadisticas);
        }
      } catch (e) {
        console.error("⚠ Error cargando datos:", e);
      } finally {
        setStatsLoading(false);
      }
    }
    load();

    const es = new EventSource(`${API_URL}/api/stream`, {
      withCredentials: true,
    });
    es.addEventListener("bodegaUpdate", (e) => {
      try {
        const b = JSON.parse((e as MessageEvent).data) as Bodega;
        setBodegas((prev) => {
          const index = prev.findIndex(x => x.id === b.id);
          if (index === -1) return prev;
          
          const newArray = [...prev];
          newArray[index] = { ...newArray[index], ...b };
          return newArray;
        });
      } catch {}
    });
    es.addEventListener("log", (e) => {
      console.log("📋 Log admin:", (e as MessageEvent).data);
    });
    es.onerror = (ev) => console.warn("SSE error", ev);

    return () => {
      closed = true;
      es.close();
    };
  }, []);

  useEffect(() => {
    const preload = (src: string) => {
      if (!imageCache.current[src]) {
        const i = new Image();
        i.src = src;
        imageCache.current[src] = i;
      }
    };
    preload("/baja.svg");
    preload("/alta.svg");
  }, []);

  const fondoSrc = planta === "baja" ? "/baja.svg" : "/alta.svg";

  const modulosDisponibles = useMemo(() => {
    const set = new Set(
      bodegas.map((b) => (b.number || b.id).split("-")[0] || "")
    );
    return Array.from(set).filter(Boolean).sort();
  }, [bodegas]);

  const medidasDisponibles = useMemo(() => {
    const set = new Set(bodegas.map((b) => b.medidas || ""));
    return Array.from(set).filter(Boolean);
  }, [bodegas]);

  // Filtros con selección múltiple
  const filtradas = useMemo(() => {
    return bodegas.filter((b) => {
      if (b.planta !== planta) return false;
      if (estadoFilter.length > 0 && !estadoFilter.includes(b.estado)) return false;
      if (moduloFilter.length > 0) {
        const pref = (b.number || b.id).split("-")[0];
        if (!moduloFilter.includes(pref)) return false;
      }
      if (medidaFilter.length > 0 && !medidaFilter.includes(b.medidas || "")) return false;
      if (precioMin !== "" && (b.precio ?? 0) < Number(precioMin)) return false;
      if (precioMax !== "" && (b.precio ?? 0) > Number(precioMax)) return false;
      return true;
    });
  }, [bodegas, planta, estadoFilter, moduloFilter, medidaFilter, precioMin, precioMax]);

  // Función para exportar a Excel
  const exportarAExcel = () => {
    const datosParaExportar = filtradas.map(b => {
      const clienteAsignado = getClienteAsignado(b.id);
      const dias = clienteAsignado ? diasRestantes(clienteAsignado.fecha_inicio, clienteAsignado.fecha_expiracion) : null;
      
      return {
        "Número": b.number,
        "Planta": b.planta,
        "Medidas": b.medidas,
        "Metros": b.metros,
        "Precio": b.precio,
        "Estado": b.estado,
        "Cualitativos": b.cualitativos || "",
        "Cliente": clienteAsignado ? `${clienteAsignado.nombre} ${clienteAsignado.apellidos}` : "",
        "Email Cliente": clienteAsignado?.email || "",
        "Teléfono Cliente": clienteAsignado?.telefono || "",
        "Pago Mensual": clienteAsignado?.pago_mensual || "",
        "Días Restantes": dias !== null ? dias : "",
        "Estado Contrato": dias !== null ? (dias < 0 ? "Vencido" : dias <= 15 ? "Por vencer" : "Activo") : ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(datosParaExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bodegas");
    
    const fecha = dayjs().format("YYYY-MM-DD_HH-mm");
    XLSX.writeFile(wb, `Reporte_Bodegas_${fecha}.xlsx`);
  };

  const optimizedPolys = useMemo(() => {
    const polys = filtradas;
    colorToPolyMap.current.clear();
    return polys.map((p, index) => {
      const raw = Array.isArray(p.points)
        ? p.points
        : typeof p.points === "string"
        ? JSON.parse(p.points)
        : [];
      const parsedPoints = raw.map(([x, y]: [number, number]) => [
        x / SVG_W,
        y / SVG_H,
      ]);
      const r = (index >> 16) & 0xff;
      const g = (index >> 8) & 0xff;
      const b = index & 0xff;
      const colorKey = `${r},${g},${b}`;
      colorToPolyMap.current.set(colorKey, p);
      return { ...p, parsedPoints, colorKey, color: `rgb(${r},${g},${b})` };
    });
  }, [filtradas]);

  const drawMain = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const img = imageCache.current[fondoSrc];
    if (!(img && img.complete)) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    optimizedPolys.forEach((p) => {
      if (!p.parsedPoints?.length) return;
      ctx.beginPath();
      p.parsedPoints.forEach(([x, y]: [number, number], i: number) => {
        const X = x * W;
        const Y = y * H;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
      ctx.closePath();
      const base =
        p.estado === "disponible"
          ? COLORS.disponible
          : p.estado === "apartada"
          ? COLORS.apartada
          : COLORS.vendida;
      ctx.fillStyle = base + FILL_ALPHA;
      ctx.strokeStyle = base;
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    });
  }, [fondoSrc, optimizedPolys]);

  const drawHit = useCallback(() => {
    const hit = hitCanvasRef.current;
    if (!hit) return;
    const hctx = hit.getContext("2d")!;
    hctx.clearRect(0, 0, W, H);
    optimizedPolys.forEach((p) => {
      if (!p.parsedPoints?.length) return;
      hctx.beginPath();
      p.parsedPoints.forEach(([x, y]: [number, number], i: number) => {
        const X = x * W;
        const Y = y * H;
        if (i === 0) hctx.moveTo(X, Y);
        else hctx.lineTo(X, Y);
      });
      hctx.closePath();
      hctx.fillStyle = p.color;
      hctx.fill();
      hctx.strokeStyle = p.color;
      hctx.lineWidth = 2;
      hctx.stroke();
    });
  }, [optimizedPolys]);

  useEffect(() => {
    const img = imageCache.current[fondoSrc];
    if (img && img.complete) {
      drawMain();
      drawHit();
    } else if (img) {
      img.onload = () => {
        drawMain();
        drawHit();
      };
    }
  }, [drawMain, drawHit, fondoSrc]);

  const pointAt = (x: number, y: number) => {
    const hit = hitCanvasRef.current;
    if (!hit) return null;
    const ctx = hit.getContext("2d")!;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] === 0) return null;
    return colorToPolyMap.current.get(
      `${pixel[0]},${pixel[1]},${pixel[2]}`
    ) || null;
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const b = pointAt(x, y);
    if (b) {
      setSelected(b);
      const row = tableRefs.current[b.id];
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.classList.add("bg-yellow-100");
        setTimeout(() => row.classList.remove("bg-yellow-100"), 1500);
      }
    }
  };

  async function onSave(b: Bodega, patch: Partial<Bodega>) {
    try {
      const body: any = {
        precio: patch.precio ?? b.precio,
        estado: patch.estado ?? b.estado,
        cualitativos: patch.cualitativos ?? b.cualitativos,
      };
      const res = await adminPatch(b.id, body);
      if (res?.data) {
        // ✅ Actualizar SIN reordenar - mantener índice exacto
        setBodegas((prev) => {
          const index = prev.findIndex(x => x.id === b.id);
          if (index === -1) return prev;
          
          const newArray = [...prev];
          newArray[index] = { ...newArray[index], ...res.data };
          return newArray;
        });
      }
    } catch (e) {
      console.error("⚠ adminPatch", e);
      alert("Error guardando cambios: " + (e.message || ""));
    }
  }

  const countsGeneral = useMemo(() => {
    const all = bodegas;
    return [
      {
        name: "Disponibles",
        value: all.filter((b) => b.estado === "disponible").length,
        color: COLORS.disponible,
      },
      {
        name: "Apartadas", 
        value: all.filter((b) => b.estado === "apartada").length,
        color: COLORS.apartada,
      },
      {
        name: "Vendidas",
        value: all.filter((b) => b.estado === "vendida").length,
        color: COLORS.vendida,
      },
    ];
  }, [bodegas]);

  const barData = useMemo(() => {
    const filtered = filtradas;
    const groupedByModule = modulosDisponibles.map(mod => {
      const bodegas = filtered.filter(b => (b.number || b.id).split("-")[0] === mod);
      return {
        modulo: mod,
        disponibles: bodegas.filter(b => b.estado === "disponible").length,
        apartadas: bodegas.filter(b => b.estado === "apartada").length,
        vendidas: bodegas.filter(b => b.estado === "vendida").length,
      };
    });
    return groupedByModule;
  }, [filtradas, modulosDisponibles]);

  function openClienteModal(cliente: Cliente) {
    setClienteModal(cliente);
  }
  
  function openAsignarClienteModal(bodegaId: string) {
    setAsignarModal(bodegaId);
  }

  function getClienteAsignado(bodegaId: string) {
    return clientes.find(c => c.bodega_id === bodegaId);
  }

  // Estados para controlar dropdowns abiertos
  const [estadoDropdownOpen, setEstadoDropdownOpen] = useState(false);
  const [moduloDropdownOpen, setModuloDropdownOpen] = useState(false);
  const [medidaDropdownOpen, setMedidaDropdownOpen] = useState(false);

  // Funciones para manejar filtros múltiples
  const toggleEstadoFilter = (estado: Estado) => {
    setEstadoFilter(prev => 
      prev.includes(estado) 
        ? prev.filter(e => e !== estado)
        : [...prev, estado]
    );
  };

  const toggleModuloFilter = (modulo: string) => {
    setModuloFilter(prev => 
      prev.includes(modulo)
        ? prev.filter(m => m !== modulo)
        : [...prev, modulo]
    );
  };

  const toggleMedidaFilter = (medida: string) => {
    setMedidaFilter(prev =>
      prev.includes(medida)
        ? prev.filter(m => m !== medida)
        : [...prev, medida]
    );
  };

  // Funciones para limpiar filtros
  const limpiarFiltros = () => {
    setEstadoFilter([]);
    setModuloFilter([]);
    setMedidaFilter([]);
    setPrecioMin("");
    setPrecioMax("");
  };

  if (loading) return <p className="p-6">Cargando...</p>;
  if (!user) return null;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Panel Administrativo</h1>

      {/* Dashboard de métricas REALES */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded border">
            <h3 className="text-sm font-medium text-gray-500">Tasa de conversión</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.tasaConversion}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <h3 className="text-sm font-medium text-gray-500">Tiempo promedio de renta</h3>
            <p className="text-2xl font-bold text-green-600">{stats.tiempoPromedio}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <h3 className="text-sm font-medium text-gray-500">Ingresos mensuales</h3>
            <p className="text-2xl font-bold text-purple-600">{stats.ingresosMensuales}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <h3 className="text-sm font-medium text-gray-500">Ocupación</h3>
            <p className="text-2xl font-bold text-orange-600">{stats.ocupacion}</p>
          </div>
        </div>
      )}

      {/* Enlaces de navegación */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Herramientas de Administración</h2>
        <div className="flex space-x-4">
          <Link
            to="/admin/users"
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Gestionar Administradores
          </Link>
          <Link
            to="/admin/clientes"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Base de Datos de Clientes
          </Link>
          <button
            onClick={exportarAExcel}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            📊 Exportar a Excel
          </button>
        </div>
      </div>

      {/* Filtros mejorados con selección múltiple */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Filtros</h3>
          <button
            onClick={limpiarFiltros}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Selector de planta */}
          <div>
            <label className="block text-sm font-medium mb-2">Planta</label>
            <select
              value={planta}
              onChange={(e) => setPlanta(e.target.value as any)}
              className="w-full border p-2 rounded"
            >
              <option value="baja">Planta Baja</option>
              <option value="alta">Planta Alta</option>
            </select>
          </div>

          {/* Rango de precios */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Precio Min</label>
              <input
                type="number"
                placeholder="Min"
                value={precioMin}
                onChange={(e) => setPrecioMin(e.target.value ? Number(e.target.value) : "")}
                className="w-full border p-2 rounded"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Precio Max</label>
              <input
                type="number"
                placeholder="Max"
                value={precioMax}
                onChange={(e) => setPrecioMax(e.target.value ? Number(e.target.value) : "")}
                className="w-full border p-2 rounded"
              />
            </div>
          </div>
        </div>

        {/* Estados (dropdown personalizado) */}
        <div className="relative">
          <label className="block text-sm font-medium mb-2">
            Estados ({estadoFilter.length > 0 ? estadoFilter.length : "todos"})
          </label>
          <button
            onClick={() => {
              setEstadoDropdownOpen(!estadoDropdownOpen);
              setModuloDropdownOpen(false);
              setMedidaDropdownOpen(false);
            }}
            className="w-full border p-2 rounded text-left flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-gray-700">
              {estadoFilter.length === 0 
                ? "Seleccionar estados..." 
                : estadoFilter.map(e => e.charAt(0).toUpperCase() + e.slice(1)).join(", ")}
            </span>
            <span className="text-gray-400">{estadoDropdownOpen ? "▲" : "▼"}</span>
          </button>
          {estadoDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
              {(["disponible", "apartada", "vendida"] as Estado[]).map(estado => (
                <label
                  key={estado}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={estadoFilter.includes(estado)}
                    onChange={() => toggleEstadoFilter(estado)}
                    className="mr-2"
                  />
                  <span className="capitalize">{estado}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Módulos (dropdown personalizado) */}
        <div className="relative">
          <label className="block text-sm font-medium mb-2">
            Módulos ({moduloFilter.length > 0 ? moduloFilter.length : "todos"})
          </label>
          <button
            onClick={() => {
              setModuloDropdownOpen(!moduloDropdownOpen);
              setEstadoDropdownOpen(false);
              setMedidaDropdownOpen(false);
            }}
            className="w-full border p-2 rounded text-left flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-gray-700">
              {moduloFilter.length === 0 
                ? "Seleccionar módulos..." 
                : moduloFilter.join(", ")}
            </span>
            <span className="text-gray-400">{moduloDropdownOpen ? "▲" : "▼"}</span>
          </button>
          {moduloDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
              {modulosDisponibles.map(mod => (
                <label
                  key={mod}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={moduloFilter.includes(mod)}
                    onChange={() => toggleModuloFilter(mod)}
                    className="mr-2"
                  />
                  <span>Módulo {mod}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Medidas (dropdown personalizado) */}
        <div className="relative">
          <label className="block text-sm font-medium mb-2">
            Medidas ({medidaFilter.length > 0 ? medidaFilter.length : "todas"})
          </label>
          <button
            onClick={() => {
              setMedidaDropdownOpen(!medidaDropdownOpen);
              setEstadoDropdownOpen(false);
              setModuloDropdownOpen(false);
            }}
            className="w-full border p-2 rounded text-left flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-gray-700">
              {medidaFilter.length === 0 
                ? "Seleccionar medidas..." 
                : medidaFilter.join(", ")}
            </span>
            <span className="text-gray-400">{medidaDropdownOpen ? "▲" : "▼"}</span>
          </button>
          {medidaDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-y-auto">
              {medidasDisponibles.map(med => (
                <label
                  key={med}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={medidaFilter.includes(med)}
                    onChange={() => toggleMedidaFilter(med)}
                    className="mr-2"
                  />
                  <span>{med}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600 flex items-center justify-between">
          <span>Mostrando {filtradas.length} de {bodegas.filter(b => b.planta === planta).length} bodegas</span>
          {(estadoFilter.length > 0 || moduloFilter.length > 0 || medidaFilter.length > 0) && (
            <span className="text-blue-600 font-medium">
              {estadoFilter.length + moduloFilter.length + medidaFilter.length} filtros activos
            </span>
          )}
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-4 h-64">
          <h3 className="text-lg font-semibold mb-2">Disponibilidad General</h3>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={countsGeneral} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {countsGeneral.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-4 h-64">
          <h3 className="text-lg font-semibold mb-2">Por Módulo ({planta === "baja" ? "Planta Baja" : "Planta Alta"})</h3>
          <ResponsiveContainer>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="modulo" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="disponibles" fill={COLORS.disponible} />
              <Bar dataKey="apartadas" fill={COLORS.apartada} />
              <Bar dataKey="vendidas" fill={COLORS.vendida} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plano */}
      <div className="lg:col-span-2 bg-white rounded-xl border p-4">
        <div className="relative">
          <canvas ref={hitCanvasRef} width={W} height={H} style={{ display: "none" }} />
          <canvas ref={canvasRef} width={W} height={H} onClick={onClick} className="w-full h-auto block cursor-pointer" />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-100">
            <tr className="border-b">
              <th className="text-left p-2">Número</th>
              <th className="text-left p-2">Planta</th>
              <th className="text-left p-2">Medidas</th>
              <th className="text-left p-2">Metros</th>
              <th className="text-left p-2">Precio</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">Cualitativos</th>
              <th className="text-left p-2">Cliente Asignado</th>
              <th className="text-left p-2">Tiempo Restante</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((b, idx) => {
              const clienteAsignado = getClienteAsignado(b.id);
              const dias = clienteAsignado ? diasRestantes(clienteAsignado.fecha_inicio, clienteAsignado.fecha_expiracion) : null;
              const porcentaje = dias && clienteAsignado?.duracion_meses ? 
                Math.max(0, Math.min(100, (dias / (clienteAsignado.duracion_meses * 30)) * 100)) : 0;

              return (
                <tr key={b.id} ref={(el) => { if (el) tableRefs.current[b.id] = el; }} className={`border-b ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}>
                  <td className="p-2">{b.number}</td>
                  <td className="p-2">{b.planta}</td>
                  <td className="p-2">{b.medidas}</td>
                  <td className="p-2">{b.metros ?? "-"}</td>
                  <td className="p-2">
                    <input type="number" value={drafts[b.id]?.precio ?? b.precio ?? ""} onChange={(e) => updateDraft(b.id, { precio: Number(e.target.value) })} className="border px-2 py-1 rounded w-24" />
                  </td>
                  <td className="p-2">
                    <select value={drafts[b.id]?.estado ?? b.estado} onChange={(e) => updateDraft(b.id, { estado: e.target.value as Estado })} className="border px-2 py-1 rounded">
                      <option value="disponible">disponible</option>
                      <option value="apartada">apartada</option>
                      <option value="vendida">vendida</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input value={drafts[b.id]?.cualitativos ?? b.cualitativos ?? ""} onChange={(e) => updateDraft(b.id, { cualitativos: e.target.value })} className="border px-2 py-1 rounded w-40" />
                  </td>
                  <td className="p-2">
                    {clienteAsignado ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openClienteModal(clienteAsignado)}
                          className="text-blue-600 underline text-xs hover:text-blue-800"
                          title="Ver información del cliente"
                        >
                          {clienteAsignado.nombre} {clienteAsignado.apellidos}
                        </button>
                        <button
                          onClick={() => openAsignarClienteModal(b.id)}
                          className="text-green-600 underline text-xs hover:text-green-800"
                          title="Cambiar cliente"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => openAsignarClienteModal(b.id)} 
                        className="text-blue-600 underline text-xs hover:text-blue-800" 
                        title="Asignar cliente"
                      >
                        Asignar Cliente
                      </button>
                    )}
                  </td>
                  <td className="p-2">
                    {clienteAsignado && dias !== null ? (
                      <div className="w-full">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              dias < 0 ? "bg-red-500" :
                              dias <= 15 ? "bg-amber-500" : "bg-green-500"
                            }`}
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {dias >= 0 ? `${dias} días` : "Vencido"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Sin contrato</span>
                    )}
                  </td>
                  <td className="p-2">
                    {drafts[b.id] && (
                      <button onClick={() => saveDraft(b.id)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">Guardar</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modales */}
      {clienteModal && <ClienteInfoModal cliente={clienteModal} onClose={() => setClienteModal(null)} />}
      {asignarModal && (
        <AsignarClienteModal 
          bodegaId={asignarModal} 
          clientes={clientes} 
          bodegas={bodegas}
          onClose={() => setAsignarModal(null)} 
          onAssign={async (clienteId) => {
            const bodegaId = asignarModal;
            const bodega = bodegas.find(b => b.id === bodegaId);
            if (!bodega) return;

            try {
              const clienteExistente = clientes.find(c => c.id === clienteId);
              if (!clienteExistente) return;

              // Crear objeto actualizado con tipos correctos
              const clienteActualizado: Cliente = {
                ...clienteExistente,
                bodega_id: bodegaId,
                modulo: (bodega.number || "").split("-")[0] || "",
                planta: bodega.planta || "baja",
                medidas: bodega.medidas || "",
                metros: bodega.metros || 0,
                pago_mensual: bodega.precio || 0,
                nombre: clienteExistente.nombre || "",
                apellidos: clienteExistente.apellidos || "",
                email: clienteExistente.email || "",
                telefono: clienteExistente.telefono || "",
                id: clienteExistente.id
              };

              await updateCliente(clienteId, clienteActualizado);
              
              // Actualizar bodega a apartada
              await onSave(bodega, { estado: "apartada" });
              
              // Actualizar estados locales
              setClientes(prev => prev.map(c => c.id === clienteId ? clienteActualizado : c));
              setBodegas(prev => prev.map(b => b.id === bodegaId ? { ...b, estado: "apartada" as Estado } : b));
              
              setAsignarModal(null);
            } catch (error) {
              console.error("Error al asignar cliente:", error);
              alert("Error al asignar cliente. Por favor intenta de nuevo.");
            }
          }}
        />
      )}
    </div>
  );
}

/* -------------------- Componentes Modales -------------------- */

function ClienteInfoModal({ cliente, onClose }: { cliente: Cliente, onClose: () => void }) {
  const dias = diasRestantes(cliente.fecha_inicio, cliente.fecha_expiracion);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[600px] relative max-h-[80vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black">✕</button>
        <h2 className="text-xl font-semibold mb-4">Información Completa del Cliente</h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800">Datos Personales</h3>
            <div><strong>Nombre:</strong> {cliente.nombre} {cliente.apellidos}</div>
            <div><strong>Email:</strong> {cliente.email}</div>
            <div><strong>Teléfono:</strong> {cliente.telefono || "–"}</div>
            <div><strong>Régimen Fiscal:</strong> {cliente.regimen_fiscal || "–"}</div>
          </div>
          
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800">Contrato</h3>
            <div><strong>Bodega:</strong> {cliente.bodega_id || "–"}</div>
            <div><strong>Módulo:</strong> {cliente.modulo || "–"}</div>
            <div><strong>Planta:</strong> {cliente.planta || "–"}</div>
            <div><strong>Metros:</strong> {cliente.metros}m²</div>
            <div><strong>Pago Mensual:</strong> ${cliente.pago_mensual?.toLocaleString()} MXN</div>
            {dias !== null && (
              <div className={`font-medium ${dias < 0 ? "text-red-600" : dias <= 15 ? "text-amber-600" : "text-green-600"}`}>
                <strong>Tiempo restante:</strong> {dias >= 0 ? `${dias} días` : "Vencido"}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-right mt-6">
          <button className="px-4 py-2 border rounded hover:bg-gray-50" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function AsignarClienteModal({ bodegaId, clientes, bodegas, onClose, onAssign }: { 
  bodegaId: string, 
  clientes: Cliente[],
  bodegas: Bodega[],
  onClose: () => void,
  onAssign: (clienteId: string) => Promise<void>
}) {
  const [selectedCliente, setSelectedCliente] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAssign() {
    if (!selectedCliente) return;
    
    try {
      setLoading(true);
      await onAssign(selectedCliente);
    } catch (error) {
      console.error("Error asignando cliente:", error);
      alert("Error al asignar cliente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[500px] relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-black">✕</button>
        <h2 className="text-xl font-semibold mb-4">Asignar Cliente a Bodega {bodegaId}</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Seleccionar Cliente</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.filter(c => !c.bodega_id).map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.apellidos} - {c.email}
                </option>
              ))}
            </select>
          </div>
          
          {selectedCliente && (
            <div className="bg-gray-50 p-3 rounded">
              <h4 className="font-medium mb-2">Cliente Seleccionado</h4>
              {(() => {
                const cliente = clientes.find(c => c.id === selectedCliente);
                return cliente ? (
                  <div className="text-sm space-y-1">
                    <div><strong>Nombre:</strong> {cliente.nombre} {cliente.apellidos}</div>
                    <div><strong>Email:</strong> {cliente.email}</div>
                    <div><strong>Teléfono:</strong> {cliente.telefono || "–"}</div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button 
            className="px-4 py-2 border rounded hover:bg-gray-50" 
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            disabled={!selectedCliente || loading}
            onClick={handleAssign}
          >
            {loading ? "Asignando..." : "Asignar Cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}