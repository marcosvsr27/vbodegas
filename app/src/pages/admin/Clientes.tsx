// app/src/pages/admin/Clientes.tsx 2222222
import { useEffect, useMemo, useState } from "react";
import {
  getClientes,
  updateCliente,
  deleteCliente,
  createCliente,
  sendRecordatorio,
  adminList as fetchBodegas,
} from "../../api";
import type { Cliente, Bodega } from "../../types";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import { generarContratoPDF } from "../../utils/generarContratoPDF";

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

  const bodegaSeleccionada = bodegas.find(b => b.id === nuevoCliente.bodega_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Base de Datos de Clientes</h1>
        <div className="flex items-center gap-4">
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
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
          <div className="bg-white rounded-xl border w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Información Completa del Cliente</h3>
              <button onClick={() => setModal(null)} className="text-gray-500 hover:text-black">✕</button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Datos Personales</h4>
                <div><span className="font-medium">Nombre:</span> {modal.nombre} {modal.apellidos}</div>
                <div><span className="font-medium">Email:</span> {modal.email}</div>
                <div><span className="font-medium">Teléfono:</span> {modal.telefono || "–"}</div>
                <div><span className="font-medium">Régimen Fiscal:</span> {modal.regimen_fiscal || "–"}</div>
                <div><span className="font-medium">Fecha de Registro:</span> {modal.fecha_registro ? dayjs(modal.fecha_registro).format("DD/MM/YYYY") : "–"}</div>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Información del Contrato</h4>
                {modal.bodega_id ? (
                  <>
                    <div><span className="font-medium">Bodega:</span> {modal.bodega_id}</div>
                    <div><span className="font-medium">Módulo:</span> {modal.modulo}</div>
                    <div><span className="font-medium">Planta:</span> {modal.planta}</div>
                    <div><span className="font-medium">Medidas:</span> {modal.medidas}</div>
                    <div><span className="font-medium">Metros:</span> {modal.metros}m²</div>
                    <div><span className="font-medium">Fecha Inicio:</span> {modal.fecha_inicio ? dayjs(modal.fecha_inicio).format("DD/MM/YYYY") : "–"}</div>
                    <div><span className="font-medium">Duración:</span> {modal.duracion_meses} meses</div>
                    <div><span className="font-medium">Fecha Vencimiento:</span> {modal.fecha_expiracion ? dayjs(modal.fecha_expiracion).format("DD/MM/YYYY") : "–"}</div>
                    <div><span className="font-medium">Pago Mensual:</span> ${modal.pago_mensual?.toLocaleString()} MXN</div>
                  </>
                ) : (
                  <div className="text-gray-500">Sin contrato asignado</div>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <button className="px-4 py-2 border rounded" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
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

      {/* Modal Recordatorio */}
      {recordatorioModal && (
        <RecordatorioModal
          cliente={recordatorioModal}
          onClose={() => setRecordatorioModal(null)}
        />
      )}
    </div>
  );
}

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

  // Actualizar precio automáticamente cuando se selecciona bodega
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
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setContratoFile(e.target.files[0]);
      // Aquí subirías el archivo al servidor
      alert("Archivo listo para subir. Implementar upload al servidor.");
    }
  };

  const generarContrato = async () => {
    if (!bodega) {
      alert("No se puede generar el contrato sin una bodega asignada");
      return;
    }

    try {
      setGenerando(true);
      // Usar la función de generación de PDF
      generarContratoPDF(cliente, bodega);
      alert("Contrato generado exitosamente. El PDF se ha descargado.");
    } catch (error) {
      console.error("Error generando contrato:", error);
      alert("Error al generar el contrato. Por favor intenta de nuevo.");
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

        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded">
            <h4 className="font-medium mb-2">Cliente: {cliente.nombre} {cliente.apellidos}</h4>
            <p className="text-sm">Bodega: {cliente.bodega_id || "Sin asignar"}</p>
            {bodega && <p className="text-sm">Renta mensual: ${bodega.precio?.toLocaleString()} MXN</p>}
            {!bodega && <p className="text-sm text-red-600">⚠️ Debe asignar una bodega antes de generar el contrato</p>}
          </div>

          <div className="space-y-3">
            <button
              onClick={generarContrato}
              disabled={!bodega || generando}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generando ? "Generando..." : "📄 Generar Contrato PDF (con anexos)"}
            </button>

            <div className="border-t pt-3">
              <label className="block text-sm font-medium mb-2">Subir contrato escaneado (opcional)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="w-full border rounded px-3 py-2"
              />
              {contratoFile && (
                <p className="text-sm text-green-600 mt-2">✓ Archivo seleccionado: {contratoFile.name}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cerrar</button>
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