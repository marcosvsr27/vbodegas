// app/src/pages/ClientePanel.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { me, fetchBodegas, generarContrato, subirDocumentos, stripeCheckout } from "../api";
import type { Bodega, ContratoGenerado } from "../types";

interface ClienteContrato {
  id: string;
  bodegaNumber: string;
  fechaInicio: string;
  fechaFin: string;
  diasRestantes: number;
  estado: "activo" | "proximo_vencer" | "vencido";
  pdfUrl?: string;
}

export default function ClientePanel() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "catalogo" | "contratos">("dashboard");
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [misContratos, setMisContratos] = useState<ClienteContrato[]>([]);
  const [selectedBodega, setSelectedBodega] = useState<Bodega | null>(null);
  const [contratoModal, setContratoModal] = useState<ContratoGenerado | null>(null);
  const [documentosModal, setDocumentosModal] = useState(false);
  const navigate = useNavigate();

  // Estados del formulario de contrato
  const [contratoForm, setContratoForm] = useState({
    meses: 1,
    nombre: "",
    telefono: "",
    direccion: "",
    identificacion: "",
  });

  // Estados para subida de documentos
  const [ineFile, setIneFile] = useState<File | null>(null);
  const [firmaFile, setFirmaFile] = useState<File | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const userData = await me();
      if (!userData || userData.rol !== "cliente") {
        navigate("/cliente/login");
      } else {
        setUser(userData);
        await loadData();
      }
      setLoading(false);
    }
    checkAuth();
  }, [navigate]);

  async function loadData() {
    try {
      const [bodegasData] = await Promise.all([
        fetchBodegas(),
        // Aquí cargarías los contratos del cliente
      ]);
      
      setBodegas(bodegasData.filter(b => b.estado === "disponible"));
      
      // Mock de contratos del cliente
      setMisContratos([
        {
          id: "1",
          bodegaNumber: "A-101",
          fechaInicio: "2025-01-01",
          fechaFin: "2025-12-31",
          diasRestantes: 300,
          estado: "activo"
        }
      ]);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  }

  async function handleRentarBodega() {
    if (!selectedBodega) return;

    try {
      const contrato = await generarContrato(selectedBodega.id, contratoForm.meses, {
        ...contratoForm,
        email: user.email
      });
      
      setContratoModal(contrato);
      setSelectedBodega(null);
    } catch (error) {
      console.error("Error generando contrato:", error);
    }
  }

  async function handleSubirDocumentos() {
    if (!contratoModal || !ineFile || !firmaFile) return;

    try {
      await subirDocumentos(contratoModal.id, ineFile, firmaFile);
      setDocumentosModal(false);
      setContratoModal(null);
      
      // Proceder al pago
      const paymentUrl = await stripeCheckout([selectedBodega?.id || ""], contratoForm.meses, true);
      window.location.href = paymentUrl.url;
    } catch (error) {
      console.error("Error subiendo documentos:", error);
    }
  }

  function getDashboardData() {
    const total = misContratos.length;
    const activos = misContratos.filter(c => c.estado === "activo").length;
    const proximosVencer = misContratos.filter(c => c.diasRestantes <= 30 && c.diasRestantes > 0).length;
    
    return { total, activos, proximosVencer };
  }

  if (loading) return <div className="p-6">Cargando...</div>;

  const dashboardData = getDashboardData();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">VBodegas - Mi Panel</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hola, {user?.nombre || user?.email}</span>
              <button
                onClick={() => navigate("/cliente/login")}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex space-x-8 border-b border-gray-200 mb-6">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "catalogo", label: "Rentar Bodega" },
            { key: "contratos", label: "Mis Contratos" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-lg font-semibold text-gray-900">Total Bodegas</h3>
                <p className="text-3xl font-bold text-blue-600">{dashboardData.total}</p>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-lg font-semibold text-gray-900">Contratos Activos</h3>
                <p className="text-3xl font-bold text-green-600">{dashboardData.activos}</p>
              </div>
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-lg font-semibold text-gray-900">Próximos a Vencer</h3>
                <p className="text-3xl font-bold text-amber-600">{dashboardData.proximosVencer}</p>
              </div>
            </div>

            {/* Gráfica de tiempo restante */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-lg font-semibold mb-4">Tiempo Restante de Contratos</h3>
              <div className="space-y-4">
                {misContratos.map(contrato => (
                  <div key={contrato.id} className="flex items-center justify-between">
                    <span className="font-medium">Bodega {contrato.bodegaNumber}</span>
                    <div className="flex items-center space-x-4">
                      <div className="w-64 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            contrato.diasRestantes > 90 ? "bg-green-500" :
                            contrato.diasRestantes > 30 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min((contrato.diasRestantes / 365) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{contrato.diasRestantes} días</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Catálogo Tab */}
        {activeTab === "catalogo" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-xl font-semibold mb-4">Bodegas Disponibles</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bodegas.map(bodega => (
                  <div key={bodega.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold">Bodega {bodega.number}</h3>
                    <p className="text-sm text-gray-600">Planta: {bodega.planta}</p>
                    <p className="text-sm text-gray-600">Tamaño: {bodega.metros}m²</p>
                    <p className="text-lg font-bold text-blue-600">${bodega.precio}/mes</p>
                    <button
                      onClick={() => setSelectedBodega(bodega)}
                      className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                      Rentar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Contratos Tab */}
        {activeTab === "contratos" && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-xl font-semibold mb-4">Mis Contratos</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Bodega</th>
                    <th className="text-left p-2">Fecha Inicio</th>
                    <th className="text-left p-2">Fecha Fin</th>
                    <th className="text-left p-2">Días Restantes</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {misContratos.map(contrato => (
                    <tr key={contrato.id} className="border-b">
                      <td className="p-2 font-medium">{contrato.bodegaNumber}</td>
                      <td className="p-2">{contrato.fechaInicio}</td>
                      <td className="p-2">{contrato.fechaFin}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          contrato.diasRestantes > 90 ? "bg-green-100 text-green-800" :
                          contrato.diasRestantes > 30 ? "bg-amber-100 text-amber-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {contrato.diasRestantes} días
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          contrato.estado === "activo" ? "bg-green-100 text-green-800" :
                          contrato.estado === "proximo_vencer" ? "bg-amber-100 text-amber-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {contrato.estado}
                        </span>
                      </td>
                      <td className="p-2">
                        {contrato.pdfUrl && (
                          <a
                            href={contrato.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Ver Contrato
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Contrato */}
      {selectedBodega && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <h3 className="text-xl font-semibold mb-4">Generar Contrato - Bodega {selectedBodega.number}</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duración (meses)
                  </label>
                  <select
                    value={contratoForm.meses}
                    onChange={(e) => setContratoForm({...contratoForm, meses: Number(e.target.value)})}
                    className="w-full border rounded px-3 py-2"
                  >
                    {[1,2,3,6,12].map(m => (
                      <option key={m} value={m}>{m} mes{m > 1 ? "es" : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Costo Total
                  </label>
                  <div className="text-lg font-bold text-blue-600">
                    ${((selectedBodega.precio || 0) * contratoForm.meses + 500).toLocaleString()} MXN
                    <div className="text-xs text-gray-500">
                      (Incluye $500 tarjeta de acceso)
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={contratoForm.nombre}
                    onChange={(e) => setContratoForm({...contratoForm, nombre: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={contratoForm.telefono}
                    onChange={(e) => setContratoForm({...contratoForm, telefono: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={contratoForm.direccion}
                  onChange={(e) => setContratoForm({...contratoForm, direccion: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Identificación
                </label>
                <input
                  type="text"
                  value={contratoForm.identificacion}
                  onChange={(e) => setContratoForm({...contratoForm, identificacion: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  placeholder="CURP o RFC"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setSelectedBodega(null)}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRentarBodega}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Generar Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Firma y Documentos */}
      {contratoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl p-6">
            <h3 className="text-xl font-semibold mb-4">Firmar Contrato y Subir Documentos</h3>
            
            <div className="space-y-6">
              {/* Vista previa del contrato */}
              <div className="border rounded p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">Contrato Generado</span>
                  <a
                    href={contratoModal.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Ver PDF
                  </a>
                </div>
                <p className="text-sm text-gray-600">
                  Revisa el contrato y sube los documentos requeridos
                </p>
              </div>

              {/* Subida de documentos */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Foto de INE (Frente y Reverso)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setIneFile(e.target.files?.[0] || null)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Firma Digital
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFirmaFile(e.target.files?.[0] || null)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              {/* Canvas para firma digital (opcional) */}
              <div className="border rounded p-4">
                <p className="text-sm text-gray-600 mb-2">
                  O dibuja tu firma aquí:
                </p>
                <canvas
                  width={400}
                  height={150}
                  className="border border-gray-300 rounded"
                  style={{ touchAction: "none" }}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setContratoModal(null)}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubirDocumentos}
                disabled={!ineFile || !firmaFile}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Continuar al Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}