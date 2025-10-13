// app/src/pages/admin/Clientes.tsx
import { useEffect, useMemo, useState } from "react";
import {
  getClientes,
  updateCliente,
  deleteCliente,
  createCliente,
  sendRecordatorio,
  adminList as fetchBodegas,
  generarContratoPDF as generarContratoPDFAPI,
} from "../../api";
import type { Cliente, Bodega } from "../../types";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import Papa from 'papaparse';

type SortOption = "alfabetico" | "fecha_contrato" | "vencimiento" | "fecha_registro";

function diasRestantes(inicio?: string, fin?: string) {
  if (!fin) return null;
  const d = dayjs(fin).diff(dayjs(), "day");
  return d;
}

function getEstadoContrato(diasRestantes: number | null) {
  if (diasRestantes === null) return "sin_contrato";
  if (diasRestantes < 0) return "vencido";
  if (diasRestantes <= 15) return "proximo_vencer";
  return "activo";
}

function getColorFila(estado: string) {
  switch (estado) {
    case "vencido": return "bg-red-50 border-red-200";
    case "proximo_vencer": return "bg-amber-50 border-amber-200";
    case "activo": return "bg-green-50 border-green-200";
    default: return "bg-gray-50 border-gray-200";
  }
}

// Función para abrir WhatsApp con mensaje predeterminado
function abrirWhatsApp(telefono: string, mensaje: string) {
  const tel = telefono.replace(/\D/g, '');
  const encoded = encodeURIComponent(mensaje);
  window.open(`https://wa.me/52${tel}?text=${encoded}`, '_blank');
}

// Función para abrir email con mensaje predeterminado
function abrirEmail(email: string, asunto: string, mensaje: string) {
  const encodedSubject = encodeURIComponent(asunto);
  const encodedBody = encodeURIComponent(mensaje);
  window.location.href = `mailto:${email}?subject=${encodedSubject}&body=${encodedBody}`;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Filtros y ordenamiento
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState("todos");
  const [planta, setPlanta] = useState<"todas" | "baja" | "alta">("todas");
  const [sortBy, setSortBy] = useState<SortOption>("alfabetico");

  // Modales
  const [modal, setModal] = useState<Cliente | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<Cliente | null>(null);
  const [recordatorioModal, setRecordatorioModal] = useState<Cliente | null>(null);
  const [contratoModal, setContratoModal] = useState<Cliente | null>(null);
  
  // 🆕 Estados para importación CSV
  const [importModal, setImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Form para crear cliente
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    apellidos: "",
    email: "",
    telefono: "",
    regimen_fiscal: "",
    bodega_id: "",
    fecha_inicio: "",
    duracion_meses: 1,
    pago_mensual: 0
  });

  async function load() {
    try {
      setLoading(true);
      const [clis, bods] = await Promise.all([getClientes(), fetchBodegas()]);
      setClientes(clis || []);
      setBodegas(bods || []);
    } catch (e: any) {
      setErr(e?.message || "Error cargando clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Actualizar precio automáticamente cuando se selecciona bodega
  useEffect(() => {
    if (nuevoCliente.bodega_id) {
      const bodega = bodegas.find(b => b.id === nuevoCliente.bodega_id);
      if (bodega && bodega.precio) {
        setNuevoCliente(prev => ({
          ...prev,
          pago_mensual: bodega.precio || 0
        }));
      }
    }
  }, [nuevoCliente.bodega_id, bodegas]);

  const modulosDisponibles = useMemo(() => {
    const set = new Set(
      bodegas.map((b) => (b.number || b.id).split("-")[0]).filter(Boolean)
    );
    return ["todos", ...Array.from(set)];
  }, [bodegas]);

  const filtrados = useMemo(() => {
    let resultado = clientes.filter((c) => {
      const lower = q.trim().toLowerCase();
      const hayQ = !lower || 
        c.nombre?.toLowerCase().includes(lower) ||
        c.apellidos?.toLowerCase().includes(lower) ||
        c.email?.toLowerCase().includes(lower) ||
        c.bodega_id?.toLowerCase().includes(lower);

      if (!hayQ) return false;
      if (modulo !== "todos" && c.modulo !== modulo) return false;
      if (planta !== "todas" && c.planta !== planta) return false;
      return true;
    });

    resultado.sort((a, b) => {
      switch (sortBy) {
        case "alfabetico":
          return (a.nombre || "").localeCompare(b.nombre || "");
        case "fecha_contrato":
          return dayjs(b.fecha_inicio || "").diff(dayjs(a.fecha_inicio || ""));
        case "vencimiento":
          const diasA = diasRestantes(a.fecha_inicio, a.fecha_expiracion);
          const diasB = diasRestantes(b.fecha_inicio, b.fecha_expiracion);
          return (diasA || 999) - (diasB || 999);
        case "fecha_registro":
          return dayjs(b.fecha_registro || "").diff(dayjs(a.fecha_registro || ""));
        default:
          return 0;
      }
    });

    return resultado;
  }, [clientes, q, modulo, planta, sortBy]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!nuevoCliente.nombre || !nuevoCliente.email) {
        return setErr("Nombre y email son obligatorios");
      }
      
      await createCliente(nuevoCliente);
      setNuevoCliente({
        nombre: "", apellidos: "", email: "", telefono: "", regimen_fiscal: "",
        bodega_id: "", fecha_inicio: "", duracion_meses: 1, pago_mensual: 0
      });
      setCreateModal(false);
      await load();
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Error creando cliente");
    }
  }

  async function onUpdate(cliente: Cliente) {
    try {
      await updateCliente(cliente.id, cliente);
      setEditModal(null);
      await load();
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Error actualizando cliente");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    try {
      await deleteCliente(id);
      await load();
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Error eliminando cliente");
    }
  }

  async function onRecordatorio(id: string) {
    try {
      await sendRecordatorio(id);
      alert("Recordatorio enviado");
    } catch (e: any) {
      setErr(e?.message || "Error enviando recordatorio");
    }
  }

  // 🆕 Función para manejar selección de archivo CSV
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      setErr("Por favor selecciona un archivo CSV");
      return;
    }
    
    setCsvFile(file);
    
    // Vista previa de las primeras 5 filas
    Papa.parse(file, {
      header: true,
      preview: 5,
      complete: (results) => {
        setCsvPreview(results.data);
      },
      error: (error) => {
        setErr("Error leyendo archivo: " + error.message);
      }
    });
  }

  // 🆕 Función para procesar el CSV completo
  async function procesarCSV() {
    if (!csvFile) return;
    
    setImporting(true);
    setErr("");
    setImportResult(null);
    
    try {
      // Leer archivo completo
      const text = await csvFile.text();
      
      // Enviar al servidor
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/admin/clientes/importar-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include',
        body: JSON.stringify({ csvData: text })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error importando CSV');
      }
      
      setImportResult(data.resultado);
      
      // Recargar lista de clientes
      await load();
      
      // Limpiar después de 3 segundos si fue exitoso
      if (data.resultado.errores === 0) {
        setTimeout(() => {
          setImportModal(false);
          setCsvFile(null);
          setCsvPreview([]);
          setImportResult(null);
        }, 3000);
      }
      
    } catch (error: any) {
      setErr(error.message || "Error importando CSV");
    } finally {
      setImporting(false);
    }
  }

  const bodegaSeleccionada = bodegas.find(b => b.id === nuevoCliente.bodega_id);

  // CONTINÚA EN PARTE 2...
  // CONTINUACIÓN DE Clientes.tsx - PARTE 2/2
  
  return (
    <div className="p-6 space-y-6">
      {/* Header con botón de importación */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Base de Datos de Clientes</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setImportModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
            title="Importar clientes desde CSV"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar CSV
          </button>
          <button
            onClick={() => setCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Agregar Cliente
          </button>
          <Link className="underline text-gray-500" to="/admin/panel">← Volver al Panel</Link>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {/* Filtros y ordenamiento */}
      <div className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Buscar por nombre, email o bodega"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={modulo}
          onChange={(e) => setModulo(e.target.value)}
        >
          {modulosDisponibles.map((m) => (
            <option key={m} value={m}>{m === "todos" ? "Todos los módulos" : `Módulo ${m}`}</option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2"
          value={planta}
          onChange={(e) => setPlanta(e.target.value as any)}
        >
          <option value="todas">Todas las plantas</option>
          <option value="baja">Planta baja</option>
          <option value="alta">Planta alta</option>
        </select>
        <select
          className="border rounded px-3 py-2"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
        >
          <option value="alfabetico">Orden alfabético</option>
          <option value="fecha_contrato">Fecha de contrato</option>
          <option value="vencimiento">Por vencimiento</option>
          <option value="fecha_registro">Fecha de registro</option>
        </select>
        <button
          className="border rounded px-3 py-2 hover:bg-gray-50"
          onClick={() => {
            setQ(""); setModulo("todos"); setPlanta("todas"); setSortBy("alfabetico");
          }}
        >
          Limpiar
        </button>
      </div>

      {/* Tabla de clientes */}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        {loading ? (
          <p className="p-2">Cargando...</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Bodega</th>
                <th className="text-left p-2">Contrato</th>
                <th className="text-left p-2">Estado</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const dias = diasRestantes(c.fecha_inicio, c.fecha_expiracion);
                const estado = getEstadoContrato(dias);
                const porcentajeTiempo = dias && c.duracion_meses ? 
                  Math.max(0, Math.min(100, (dias / (c.duracion_meses * 30)) * 100)) : 0;

                return (
                  <tr key={c.id} className={`border-b hover:bg-gray-50 ${getColorFila(estado)}`}>
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{c.nombre} {c.apellidos}</div>
                        <div className="text-xs text-gray-500">{c.telefono}</div>
                      </div>
                    </td>
                    <td className="p-2">{c.email}</td>
                    <td className="p-2">
                      {c.bodega_id ? (
                        <div>
                          <div className="font-medium">{c.bodega_id}</div>
                          <div className="text-xs text-gray-500">{c.planta} - {c.metros}m²</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="p-2">
                      {c.fecha_inicio && c.fecha_expiracion ? (
                        <div>
                          <div className="text-xs">
                            {dayjs(c.fecha_inicio).format("DD/MM/YY")} → {dayjs(c.fecha_expiracion).format("DD/MM/YY")}
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className={`h-2 rounded-full ${
                                estado === "vencido" ? "bg-red-500" :
                                estado === "proximo_vencer" ? "bg-amber-500" : "bg-green-500"
                              }`}
                              style={{ width: `${porcentajeTiempo}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {dias !== null ? `${dias} días` : "Vencido"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Sin contrato</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        estado === "vencido" ? "bg-red-100 text-red-800" :
                        estado === "proximo_vencer" ? "bg-amber-100 text-amber-800" :
                        estado === "activo" ? "bg-green-100 text-green-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {estado === "vencido" ? "Vencido" :
                         estado === "proximo_vencer" ? "Por vencer" :
                         estado === "activo" ? "Activo" : "Sin contrato"}
                      </span>
                    </td>
                    <td className="p-2 space-x-2">
                      <button
                        className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                        onClick={() => setModal(c)}
                      >
                        Ver
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                        onClick={() => setEditModal(c)}
                      >
                        Editar
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
                        onClick={() => setContratoModal(c)}
                        title="Generar/Ver contrato"
                      >
                        Contrato
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => setRecordatorioModal(c)}
                        title="Enviar recordatorio"
                      >
                        Recordar
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        onClick={() => onDelete(c.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtrados.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

     {/* Modal Ver Cliente */}
{modal && (
  <ClienteDetailModal
    cliente={modal} 
    onClose={() => setModal(null)} 
  />
)}

      {/* Modal Crear Cliente */}
      {createModal && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border w-full max-w-4xl p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Agregar Nuevo Cliente</h3>
              <button onClick={() => setCreateModal(false)} className="text-gray-500 hover:text-black">✕</button>
            </div>
            
            <form onSubmit={onCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nombre(s)</label>
                  <input
                    required
                    className="w-full border rounded px-3 py-2"
                    value={nuevoCliente.nombre}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, nombre: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Apellido(s)</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={nuevoCliente.apellidos}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, apellidos: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full border rounded px-3 py-2"
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Teléfono</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    value={nuevoCliente.telefono}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, telefono: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Régimen Fiscal</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={nuevoCliente.regimen_fiscal}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, regimen_fiscal: e.target.value})}
                >
                  <option value="">Seleccionar...</option>
                  <option value="fisica">Persona Física</option>
                  <option value="moral">Persona Moral</option>
                  <option value="actividad_empresarial">Actividad Empresarial</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Bodega Asignada</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={nuevoCliente.bodega_id}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, bodega_id: e.target.value})}
                >
                  <option value="">Sin asignar</option>
                  {bodegas.filter(b => b.estado === "disponible").map(b => (
                    <option key={b.id} value={b.id}>
                      {b.number} • {b.planta} • {b.metros}m² • ${b.precio?.toLocaleString()} MXN/mes
                    </option>
                  ))}
                </select>
              </div>

              {bodegaSeleccionada && (
                <div className="bg-gray-50 p-3 rounded border">
                  <h4 className="font-medium mb-2">Información de la Bodega Seleccionada</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div><strong>Módulo:</strong> {(bodegaSeleccionada.number || "").split("-")[0]}</div>
                    <div><strong>Planta:</strong> {bodegaSeleccionada.planta}</div>
                    <div><strong>Medidas:</strong> {bodegaSeleccionada.medidas}</div>
                    <div><strong>Metros:</strong> {bodegaSeleccionada.metros}m²</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    className="w-full border rounded px-3 py-2"
                    value={nuevoCliente.fecha_inicio}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, fecha_inicio: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duración (meses)</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={nuevoCliente.duracion_meses}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, duracion_meses: Number(e.target.value)})}
                  >
                    {[1,2,3,6,12,24].map(m => (
                      <option key={m} value={m}>{m} mes{m > 1 ? "es" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Pago Mensual (MXN)</label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2 bg-gray-50"
                    value={nuevoCliente.pago_mensual}
                    onChange={(e) => setNuevoCliente({...nuevoCliente, pago_mensual: Number(e.target.value)})}
                    readOnly={!!bodegaSeleccionada}
                    title={bodegaSeleccionada ? "Se llenó automáticamente desde la bodega" : ""}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {editModal && (
        <EditClienteModal
          cliente={editModal}
          bodegas={bodegas}
          onSave={onUpdate}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* Modal Contrato */}
      {contratoModal && (
        <ContratoModal
          cliente={contratoModal}
          bodega={bodegas.find(b => b.id === contratoModal.bodega_id)}
          onClose={() => setContratoModal(null)}
        />
      )}
// ============================================================
// COPIAR DESDE AQUÍ HASTA EL FINAL DEL ARCHIVO
// Reemplaza todo después de la línea que dice:
// {/* Modal Recordatorio */}
// ============================================================

      {/* Modal Recordatorio */}
      {recordatorioModal && (
        <RecordatorioModal
          cliente={recordatorioModal}
          onClose={() => setRecordatorioModal(null)}
        />
      )}

      {/* 🆕 Modal de Importación CSV */}
      <ImportCSVModal
        isOpen={importModal}
        onClose={() => {
          setImportModal(false);
          setCsvFile(null);
          setCsvPreview([]);
          setImportResult(null);
          setErr("");
        }}
        csvFile={csvFile}
        csvPreview={csvPreview}
        importing={importing}
        importResult={importResult}
        onFileSelect={handleFileSelect}
        onProcess={procesarCSV}
        error={err}
      />
    </div>
  );
}

// ============================================================
// COMPONENTES AUXILIARES - TODOS AL MISMO NIVEL
// ============================================================

// Componente Modal de Edición
function EditClienteModal({ 
  cliente, 
  bodegas, 
  onSave, 
  onClose 
}: { 
  cliente: Cliente; 
  bodegas: Bodega[]; 
  onSave: (cliente: Cliente) => void; 
  onClose: () => void; 
}) {
  const [editData, setEditData] = useState({ ...cliente });
  const bodegaSeleccionada = bodegas.find(b => b.id === editData.bodega_id);

  useEffect(() => {
    if (editData.bodega_id && editData.bodega_id !== cliente.bodega_id) {
      const bodega = bodegas.find(b => b.id === editData.bodega_id);
      if (bodega && bodega.precio) {
        setEditData(prev => ({
          ...prev,
          pago_mensual: bodega.precio || 0
        }));
      }
    }
  }, [editData.bodega_id, bodegas, cliente.bodega_id]);

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl border w-full max-w-4xl p-6 space-y-4 my-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Editar Cliente</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre(s)</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editData.nombre}
                onChange={(e) => setEditData({...editData, nombre: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Apellido(s)</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editData.apellidos || ""}
                onChange={(e) => setEditData({...editData, apellidos: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                className="w-full border rounded px-3 py-2"
                value={editData.email}
                onChange={(e) => setEditData({...editData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={editData.telefono || ""}
                onChange={(e) => setEditData({...editData, telefono: e.target.value})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bodega Asignada</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={editData.bodega_id || ""}
              onChange={(e) => setEditData({...editData, bodega_id: e.target.value})}
            >
              <option value="">Sin asignar</option>
              {bodegas.filter(b => b.estado === "disponible" || b.id === editData.bodega_id).map(b => (
                <option key={b.id} value={b.id}>
                  {b.number} • {b.planta} • {b.metros}m² • ${b.precio?.toLocaleString()} MXN/mes
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Fecha de Inicio</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={editData.fecha_inicio || ""}
                onChange={(e) => setEditData({...editData, fecha_inicio: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duración (meses)</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={editData.duracion_meses || 1}
                onChange={(e) => setEditData({...editData, duracion_meses: Number(e.target.value)})}
              >
                {[1,2,3,6,12,24].map(m => (
                  <option key={m} value={m}>{m} mes{m > 1 ? "es" : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Pago Mensual (MXN)</label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2 bg-gray-50"
                value={editData.pago_mensual || 0}
                onChange={(e) => setEditData({...editData, pago_mensual: Number(e.target.value)})}
                readOnly={!!bodegaSeleccionada && editData.bodega_id !== cliente.bodega_id}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => onSave(editData)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de Contrato
function ContratoModal({ cliente, bodega, onClose }: { cliente: Cliente; bodega?: Bodega; onClose: () => void }) {
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.type !== 'application/pdf') {
        setError("Solo se permiten archivos PDF");
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        setError("El archivo no debe superar 10MB");
        return;
      }
      
      setContratoFile(file);
      setError("");
      setSuccess(`Archivo seleccionado: ${file.name}`);
    }
  };

  const generarContrato = async () => {
    if (!bodega) {
      setError("No se puede generar el contrato sin una bodega asignada");
      return;
    }

    try {
      setGenerando(true);
      setError("");
      
      await generarContratoPDFAPI(cliente.id);
      
      setSuccess("Contrato generado y descargado exitosamente");
      
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err: any) {
      console.error("Error generando contrato:", err);
      setError(err.message || "Error al generar el contrato. Por favor intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <div className="bg-white rounded-xl border w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gestión de Contrato</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>

        <div className="bg-blue-50 p-4 rounded border border-blue-200">
          <h4 className="font-medium mb-2">Cliente: {cliente.nombre} {cliente.apellidos}</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Bodega:</span> {cliente.bodega_id || "Sin asignar"}
            </div>
            {bodega && (
              <>
                <div>
                  <span className="font-medium">Superficie:</span> {bodega.metros}m²
                </div>
                <div>
                  <span className="font-medium">Renta mensual:</span> ${bodega.precio?.toLocaleString()} MXN
                </div>
                <div>
                  <span className="font-medium">Ubicación:</span> {bodega.planta}
                </div>
              </>
            )}
            {!bodega && (
              <div className="col-span-2">
                <p className="text-red-600 text-sm">⚠️ Debe asignar una bodega antes de generar el contrato</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            ✓ {success}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={generarContrato}
            disabled={!bodega || generando}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generando ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generando contrato...
              </>
            ) : (
              <>📄 Generar Contrato PDF (con Anexos)</>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">o</span>
            </div>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            <label className="block text-sm font-medium mb-2">
              Subir contrato firmado (opcional)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
                cursor-pointer"
            />
            {contratoFile && (
              <p className="text-sm text-green-600 mt-2">
                ✓ Archivo seleccionado: {contratoFile.name}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Máximo 10MB. Solo archivos PDF.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de Recordatorio
function RecordatorioModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const [tipoRecordatorio, setTipoRecordatorio] = useState<"pago" | "renovacion">("pago");
  const [metodo, setMetodo] = useState<"whatsapp" | "email">("whatsapp");

  const diasRestantes = cliente.fecha_expiracion ? 
    dayjs(cliente.fecha_expiracion).diff(dayjs(), "day") : null;

  const mensajePago = `Hola ${cliente.nombre},\n\nTe recordamos que tu pago mensual de la bodega ${cliente.bodega_id} vence en 5 días.\n\nMonto: $${cliente.pago_mensual?.toLocaleString()} MXN\n\n¡Gracias por tu preferencia!\nVBODEGAS - PROYECTO Y ESPACIOS RADA`;

  const mensajeRenovacion = `Hola ${cliente.nombre},\n\nTu contrato de la bodega ${cliente.bodega_id} vence el ${dayjs(cliente.fecha_expiracion).format("DD/MM/YYYY")}.\n\n¿Te gustaría renovarlo? Contáctanos para conocer las opciones disponibles.\n\nVBODEGAS - PROYECTO Y ESPACIOS RADA`;

  const enviarRecordatorio = () => {
    const mensaje = tipoRecordatorio === "pago" ? mensajePago : mensajeRenovacion;
    
    if (metodo === "whatsapp" && cliente.telefono) {
      abrirWhatsApp(cliente.telefono, mensaje);
    } else if (metodo === "email") {
      const asunto = tipoRecordatorio === "pago" ? "Recordatorio de Pago - VBODEGAS" : "Renovación de Contrato - VBODEGAS";
      abrirEmail(cliente.email, asunto, mensaje);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
      <div className="bg-white rounded-xl border w-full max-w-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Enviar Recordatorio</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-medium">Cliente: {cliente.nombre} {cliente.apellidos}</h4>
            <p className="text-sm">Email: {cliente.email}</p>
            <p className="text-sm">Teléfono: {cliente.telefono || "No registrado"}</p>
            {diasRestantes !== null && (
              <p className="text-sm font-medium mt-2">
                Días restantes del contrato: {diasRestantes} días
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tipo de recordatorio</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={tipoRecordatorio}
              onChange={(e) => setTipoRecordatorio(e.target.value as any)}
            >
              <option value="pago">Recordatorio de pago (5 días antes)</option>
              <option value="renovacion">Renovación de contrato (30 días antes)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Método de envío</label>
            <div className="flex gap-3">
              <button
                onClick={() => setMetodo("whatsapp")}
                className={`flex-1 px-4 py-3 rounded border-2 ${
                  metodo === "whatsapp" 
                    ? "border-green-600 bg-green-50 text-green-700" 
                    : "border-gray-300"
                }`}
                disabled={!cliente.telefono}
              >
                📱 WhatsApp
                {!cliente.telefono && <span className="block text-xs text-red-600">Sin teléfono</span>}
              </button>
              <button
                onClick={() => setMetodo("email")}
                className={`flex-1 px-4 py-3 rounded border-2 ${
                  metodo === "email" 
                    ? "border-blue-600 bg-blue-50 text-blue-700" 
                    : "border-gray-300"
                }`}
              >
                📧 Email
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm font-medium mb-2">Vista previa del mensaje:</p>
            <p className="text-sm whitespace-pre-line">
              {tipoRecordatorio === "pago" ? mensajePago : mensajeRenovacion}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded">
            Cancelar
          </button>
          <button
            onClick={enviarRecordatorio}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={metodo === "whatsapp" && !cliente.telefono}
          >
            Enviar Recordatorio
          </button>
        </div>
      </div>
    </div>
  );
}

// 🆕 Modal de Importación CSV
function ImportCSVModal({ 
  isOpen, 
  onClose, 
  csvFile, 
  csvPreview, 
  importing, 
  importResult, 
  onFileSelect, 
  onProcess,
  error 
}: { 
  isOpen: boolean;
  onClose: () => void;
  csvFile: File | null;
  csvPreview: any[];
  importing: boolean;
  importResult: any;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onProcess: () => void;
  error: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50">
      <div className="bg-white rounded-xl border w-full max-w-4xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">📊 Importar Clientes desde CSV</h3>
            <p className="text-sm text-gray-500 mt-1">Sube el archivo infobodegas.csv para actualizar la base de datos</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-black text-2xl">✕</button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            ⚠️ {error}
          </div>
        )}

        {!csvFile && !importResult && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <label className="cursor-pointer">
                  <span className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">
                    Seleccionar Archivo CSV
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={onFileSelect}
                    className="hidden"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">o arrastra el archivo aquí</p>
              </div>
            </div>
          </div>
        )}

        {csvFile && csvPreview.length > 0 && !importResult && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{csvFile.name}</h4>
                  <p className="text-sm text-gray-600">{(csvFile.size / 1024).toFixed(2)} KB</p>
                </div>
                <button 
                  onClick={() => { onFileSelect({ target: { files: null } } as any); }}
                  className="text-red-600 hover:text-red-800"
                >
                  Cambiar
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Vista Previa (primeras 5 filas):</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(csvPreview[0] || {}).map(key => (
                        <th key={key} className="px-4 py-2 text-left font-medium text-gray-700 border-b">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-4 py-2 text-gray-600">
                            {String(val).substring(0, 50)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={importing}
                className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={onProcess}
                disabled={importing}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? "Procesando..." : "Importar Clientes"}
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <h4 className="text-xl font-semibold text-green-900 mb-2">¡Importación Completada!</h4>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-3xl font-bold text-green-600">{importResult.exitosos}</div>
                  <div className="text-sm text-gray-600">Creados</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-3xl font-bold text-blue-600">{importResult.actualizados || 0}</div>
                  <div className="text-sm text-gray-600">Actualizados</div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-3xl font-bold text-red-600">{importResult.errores}</div>
                  <div className="text-sm text-gray-600">Errores</div>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== COMPONENTE DE DETALLE MEJORADO ==========
function ClienteDetailModal({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'general' | 'contrato' | 'pagos' | 'documentos'>('general');

  const totalContrato = cliente.cargos || 0;
  const pagado = cliente.abonos || 0;
  const porVencer = cliente.saldo || 0;
  const vencido = cliente.vencido_hoy || 0;
  
  const porcentajePagado = totalContrato > 0 ? (pagado / totalContrato) * 100 : 0;
  const porcentajeVencido = totalContrato > 0 ? (vencido / totalContrato) * 100 : 0;
  const porcentajePorVencer = totalContrato > 0 ? (porVencer / totalContrato) * 100 : 0;

  const diasTranscurridos = cliente.fecha_inicio && cliente.fecha_expiracion ? 
    dayjs().diff(dayjs(cliente.fecha_inicio), 'day') : 0;
  const diasTotales = cliente.fecha_inicio && cliente.fecha_expiracion ?
    dayjs(cliente.fecha_expiracion).diff(dayjs(cliente.fecha_inicio), 'day') : 0;
  const porcentajeTiempo = diasTotales > 0 ? (diasTranscurridos / diasTotales) * 100 : 0;

  const diasRestantes = cliente.fecha_expiracion ? 
    dayjs(cliente.fecha_expiracion).diff(dayjs(), 'day') : null;

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-6xl my-8 shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl font-bold">
                  {cliente.nombre?.charAt(0)}{cliente.apellidos?.charAt(0)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{cliente.nombre} {cliente.apellidos}</h2>
                  <p className="text-blue-100 text-sm">{cliente.email}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white text-3xl font-light"
            >
              ×
            </button>
          </div>

          <div className="flex gap-2 mt-6 border-t border-white/20 pt-4">
            {[
              { id: 'general' as const, label: 'General', icon: '👤' },
              { id: 'contrato' as const, label: 'Contrato', icon: '📄' },
              { id: 'pagos' as const, label: 'Pagos', icon: '💰' },
              { id: 'documentos' as const, label: 'Documentos', icon: '📁' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 font-semibold'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="text-center py-8 text-gray-500">
              <p>Contenido de la pestaña General</p>
            </div>
          )}
          {activeTab === 'contrato' && (
            <div className="text-center py-8 text-gray-500">
              <p>Contenido de la pestaña Contrato</p>
            </div>
          )}
          {activeTab === 'pagos' && (
            <div className="text-center py-8 text-gray-500">
              <p>Contenido de la pestaña Pagos</p>
            </div>
          )}
          {activeTab === 'documentos' && (
            <div className="text-center py-8 text-gray-500">
              <p>Contenido de la pestaña Documentos</p>
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-100 font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}