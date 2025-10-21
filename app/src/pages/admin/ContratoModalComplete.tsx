// Componente COMPLETO Y CORREGIDO del modal para generar contratos

import React, { useState, useEffect } from 'react';
import type { Cliente, Bodega } from '../../types';

interface ContratoModalCompleteProps {
  cliente: Cliente;
  bodega?: Bodega;
  bodegas: Bodega[];
  onClose: () => void;
}

export function ContratoModalComplete({ cliente, bodega, bodegas, onClose }: ContratoModalCompleteProps) {
  const [activeTab, setActiveTab] = useState<'cliente' | 'bodega' | 'contrato' | 'autorizados'>('cliente');
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 🆕 Selector de secciones
  const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState<string[]>([
    'contrato', 'anexo1', 'anexo2', 'anexo3', 'anexo4', 'anexo5', 'anexo6'
  ]);

  // Obtener bodega actualizada
  const bodegaActual = bodegas.find(b => b.id === cliente.bodega_id) || bodega;

  const [formData, setFormData] = useState({
    // Datos del cliente
    nombre: cliente.nombre || '',
    apellidos: cliente.apellidos || '',
    email: cliente.email || '',
    telefono: cliente.telefono || '',
    
    // Datos adicionales
    nacionalidad: cliente.nacionalidad || '',
    actividad: cliente.actividad || '',
    direccion: cliente.direccion || '',
    rfc: cliente.rfc || '',
    curp: cliente.curp || '',
    tipo_identificacion: cliente.tipo_identificacion || '',
    numero_identificacion: cliente.numero_identificacion || '',
    bienes_almacenar: cliente.bienes_almacenar || '',
    
    // Datos de la bodega - CORREGIDO para usar valores correctos
    bodega_id: cliente.bodega_id || '',
    modulo: (bodegaActual?.number || '').split('-')[0] || cliente.modulo || '',
    metros: bodegaActual?.metros || cliente.metros || 0,
    precio: bodegaActual?.precio || cliente.pago_mensual || 0,
    
    // Fechas del contrato
    fecha_inicio: cliente.fecha_inicio || new Date().toISOString().split('T')[0],
    duracion_meses: cliente.duracion_meses || 12,
    fecha_expiracion: cliente.fecha_expiracion || '',
    deposito: cliente.deposito || bodegaActual?.precio || cliente.pago_mensual || 0,
    
    // Personas autorizadas
    autorizados: cliente.autorizados || [
      { fecha: '', nombre: '', tipo: 'temporal' as const },
      { fecha: '', nombre: '', tipo: 'temporal' as const },
      { fecha: '', nombre: '', tipo: 'temporal' as const },
    ]
  });

  // Actualizar cuando cambie la bodega actual
  useEffect(() => {
    if (bodegaActual) {
      setFormData(prev => ({
        ...prev,
        metros: bodegaActual.metros || 0,
        precio: bodegaActual.precio || 0,
        deposito: prev.deposito || bodegaActual.precio || 0,
        modulo: (bodegaActual.number || '').split('-')[0] || ''
      }));
    }
  }, [bodegaActual]);

  // Calcular fecha de expiración automáticamente
  useEffect(() => {
    if (formData.fecha_inicio && formData.duracion_meses) {
      const inicio = new Date(formData.fecha_inicio);
      const fin = new Date(inicio);
      fin.setMonth(fin.getMonth() + parseInt(String(formData.duracion_meses)));
      setFormData(prev => ({
        ...prev,
        fecha_expiracion: fin.toISOString().split('T')[0]
      }));
    }
  }, [formData.fecha_inicio, formData.duracion_meses]);

  const tabs = [
    { id: 'cliente' as const, label: 'Datos del Cliente', icon: '👤' },
    { id: 'bodega' as const, label: 'Datos de la Bodega', icon: '🏢' },
    { id: 'contrato' as const, label: 'Términos del Contrato', icon: '📋' },
    { id: 'autorizados' as const, label: 'Personas Autorizadas', icon: '👥' },
  ];

  // 🆕 Auto-guardar al cambiar campos importantes
  const handleChange = async (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-guardar ciertos campos
    const camposAutoGuardar = [
      'nacionalidad', 'actividad', 'direccion', 'rfc', 'curp',
      'tipo_identificacion', 'numero_identificacion', 'bienes_almacenar', 'deposito'
    ];
    
    if (camposAutoGuardar.includes(field)) {
      debouncedSave({ ...formData, [field]: value });
    }
  };

  // Debounce para auto-guardado
  let saveTimeout: NodeJS.Timeout;
  const debouncedSave = (data: typeof formData) => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      await guardarDatos(data);
    }, 1000);
  };

  const guardarDatos = async (data: typeof formData) => {
    try {
      setGuardando(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/clientes/${cliente.id}/actualizar-datos-contrato`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include',
        body: JSON.stringify({
          nacionalidad: data.nacionalidad,
          actividad: data.actividad,
          direccion: data.direccion,
          rfc: data.rfc,
          curp: data.curp,
          tipo_identificacion: data.tipo_identificacion,
          numero_identificacion: data.numero_identificacion,
          bienes_almacenar: data.bienes_almacenar,
          deposito: data.deposito,
          autorizados: data.autorizados
        })
      });

      if (!res.ok) throw new Error("Error guardando");
    } catch (err) {
      console.error("Error en auto-guardado:", err);
    } finally {
      setGuardando(false);
    }
  };

  const handleAutorizadoChange = (index: number, field: string, value: string) => {
    const newAutorizados = [...formData.autorizados];
    newAutorizados[index] = { ...newAutorizados[index], [field]: value };
    setFormData(prev => ({ ...prev, autorizados: newAutorizados }));
    debouncedSave({ ...formData, autorizados: newAutorizados });
  };

  const toggleSeccion = (seccion: string) => {
    setSeccionesSeleccionadas(prev => 
      prev.includes(seccion)
        ? prev.filter(s => s !== seccion)
        : [...prev, seccion]
    );
  };

  const validateForm = (): boolean => {
    if (!formData.nombre || !formData.email) {
      setError("Nombre y email son obligatorios");
      return false;
    }
    if (!formData.bodega_id) {
      setError("Debe asignar una bodega al cliente");
      return false;
    }
    if (!formData.nacionalidad || !formData.actividad || !formData.direccion) {
      setError("Complete: Nacionalidad, Actividad y Dirección");
      setActiveTab('cliente');
      return false;
    }
    if (!formData.rfc || !formData.curp) {
      setError("RFC y CURP son obligatorios");
      setActiveTab('cliente');
      return false;
    }
    if (!formData.tipo_identificacion || !formData.numero_identificacion) {
      setError("Complete los datos de identificación");
      setActiveTab('cliente');
      return false;
    }
    if (!formData.bienes_almacenar) {
      setError("Describa los bienes a almacenar");
      setActiveTab('cliente');
      return false;
    }
    if (seccionesSeleccionadas.length === 0) {
      setError("Seleccione al menos una sección para generar");
      return false;
    }
    return true;
  };

  const handleGenerar = async () => {
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    try {
      setGenerando(true);

      // Guardar datos primero
      await guardarDatos(formData);

      // Generar el contrato con secciones seleccionadas
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/clientes/${cliente.id}/generar-contrato`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include',
        body: JSON.stringify({ secciones: seccionesSeleccionadas })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Error generando contrato");
      }

      // Descargar el PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `Contrato_${cliente.nombre}_${Date.now()}.pdf`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess("✅ Contrato generado y descargado exitosamente");
      
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      console.error("Error generando contrato:", err);
      setError(err.message || "Error al generar el contrato");
    } finally {
      setGenerando(false);
    }
  };

  const secciones = [
    { id: 'contrato', label: 'Contrato Principal', desc: '7 páginas' },
    { id: 'anexo1', label: 'Anexo 1', desc: 'Inventario' },
    { id: 'anexo2', label: 'Anexo 2', desc: 'Autorizaciones' },
    { id: 'anexo3', label: 'Anexo 3', desc: 'Datos personales' },
    { id: 'anexo4', label: 'Anexo 4', desc: 'Bienes muebles' },
    { id: 'anexo5', label: 'Anexo 5', desc: 'Prenda' },
    { id: 'anexo6', label: 'Anexo 6', desc: 'Reglamento' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-6xl my-8 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-2xl">
                📄
              </div>
              <div>
                <h2 className="text-2xl font-bold">Generar Contrato de Arrendamiento</h2>
                <p className="text-purple-100 text-sm flex items-center gap-2">
                  Complete la información para generar el contrato PDF
                  {guardando && <span className="text-xs bg-white/20 px-2 py-1 rounded">Guardando...</span>}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white text-3xl font-light"
            >
              ×
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-t border-white/20 pt-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-purple-600 font-semibold'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'cliente' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Información del Arrendatario</h3>
                <span className="text-sm text-red-500">* Campos obligatorios</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre(s) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apellido(s) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.apellidos}
                    onChange={(e) => handleChange('apellidos', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nacionalidad *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nacionalidad}
                    onChange={(e) => handleChange('nacionalidad', e.target.value)}
                    placeholder="Ej: Mexicano(a), Estadounidense"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actividad Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.actividad}
                    onChange={(e) => handleChange('actividad', e.target.value)}
                    placeholder="Ej: Comerciante, Empresario"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección Completa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.direccion}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                    placeholder="Calle, número, colonia, ciudad, estado, CP"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.telefono}
                    onChange={(e) => handleChange('telefono', e.target.value)}
                    placeholder="10 dígitos"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RFC *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rfc}
                    onChange={(e) => handleChange('rfc', e.target.value.toUpperCase())}
                    placeholder="13 caracteres"
                    maxLength={13}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CURP *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.curp}
                    onChange={(e) => handleChange('curp', e.target.value.toUpperCase())}
                    placeholder="18 caracteres"
                    maxLength={18}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Identificación * (escribir)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tipo_identificacion}
                    onChange={(e) => handleChange('tipo_identificacion', e.target.value)}
                    placeholder="Ej: INE, Pasaporte, Licencia"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número de Identificación *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.numero_identificacion}
                    onChange={(e) => handleChange('numero_identificacion', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bienes a Almacenar *
                  </label>
                  <textarea
                    required
                    value={formData.bienes_almacenar}
                    onChange={(e) => handleChange('bienes_almacenar', e.target.value)}
                    placeholder="Descripción general de los bienes que almacenará (Ej: Muebles de oficina, equipo de cómputo)"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bodega' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Información de la Bodega</h3>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  ℹ️ Esta información se carga automáticamente desde la bodega asignada
                </p>
              </div>

              {bodegaActual && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-green-900 mb-2">Bodega Actual</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><strong>ID:</strong> {bodegaActual.number}</div>
                    <div><strong>Planta:</strong> {bodegaActual.planta}</div>
                    <div><strong>Medidas:</strong> {bodegaActual.medidas}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Bodega
                  </label>
                  <input
                    type="text"
                    value={formData.bodega_id}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Módulo
                  </label>
                  <input
                    type="text"
                    value={formData.modulo}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Superficie (m²)
                  </label>
                  <input
                    type="number"
                    value={formData.metros}
                    onChange={(e) => handleChange('metros', Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Renta Mensual (MXN)
                  </label>
                  <input
                    type="number"
                    value={formData.precio}
                    onChange={(e) => handleChange('precio', Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Depósito en Garantía (MXN)
                  </label>
                  <input
                    type="number"
                    value={formData.deposito}
                    onChange={(e) => handleChange('deposito', Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contrato' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Términos del Contrato</h3>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha_inicio}
                    onChange={(e) => handleChange('fecha_inicio', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duración (meses) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.duracion_meses}
                    onChange={(e) => handleChange('duracion_meses', Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Fin (calculada)
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_expiracion}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    readOnly
                  />
                </div>
              </div>

              {/* 🆕 Selector de Secciones */}
              <div className="border-2 border-purple-200 rounded-xl p-6 bg-purple-50">
                <h4 className="font-semibold text-purple-900 mb-4 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  Seleccione las secciones a generar
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  {secciones.map(seccion => (
                    <button
                      key={seccion.id}
                      onClick={() => toggleSeccion(seccion.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        seccionesSeleccionadas.includes(seccion.id)
                          ? 'border-purple-500 bg-purple-100 text-purple-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{seccion.label}</span>
                        {seccionesSeleccionadas.includes(seccion.id) && (
                          <span className="text-purple-600">✓</span>
                        )}
                      </div>
                      <p className="text-xs opacity-75">{seccion.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setSeccionesSeleccionadas(secciones.map(s => s.id))}
                    className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Seleccionar Todo
                  </button>
                  <button
                    onClick={() => setSeccionesSeleccionadas([])}
                    className="text-sm px-4 py-2 border border-purple-600 text-purple-600 rounded hover:bg-purple-50"
                  >
                    Deseleccionar Todo
                  </button>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Resumen del Contrato</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Cliente:</span>
                    <span className="font-medium ml-2">{formData.nombre} {formData.apellidos}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Bodega:</span>
                    <span className="font-medium ml-2">{formData.bodega_id}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Renta Mensual:</span>
                    <span className="font-medium ml-2">${formData.precio.toLocaleString()} MXN</span>
                  </div>
                  <div>
                    <span className="text-green-700">Depósito:</span>
                    <span className="font-medium ml-2">${formData.deposito.toLocaleString()} MXN</span>
                  </div>
                  <div>
                    <span className="text-green-700">Duración:</span>
                    <span className="font-medium ml-2">{formData.duracion_meses} meses</span>
                  </div>
                  <div>
                    <span className="text-green-700">Total del Contrato:</span>
                    <span className="font-medium ml-2">${(formData.precio * formData.duracion_meses).toLocaleString()} MXN</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'autorizados' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">Personas Autorizadas (Anexo 2)</h3>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-800">
                  ⚠️ Opcional: Agregue hasta 3 personas autorizadas para acceder a la bodega
                </p>
              </div>

              {formData.autorizados.map((autorizado, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="font-medium text-gray-900 mb-3">Persona Autorizada #{index + 1}</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={autorizado.fecha}
                        onChange={(e) => handleAutorizadoChange(index, 'fecha', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        value={autorizado.nombre}
                        onChange={(e) => handleAutorizadoChange(index, 'nombre', e.target.value)}
                        placeholder="Nombre del autorizado"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Autorización
                      </label>
                      <select
                        value={autorizado.tipo}
                        onChange={(e) => handleAutorizadoChange(index, 'tipo', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                      >
                        <option value="temporal">Temporal</option>
                        <option value="permanente">Permanente</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {seccionesSeleccionadas.length > 0 ? (
              <span>✓ {seccionesSeleccionadas.length} sección(es) seleccionada(s)</span>
            ) : (
              <span className="text-red-600">⚠️ Seleccione al menos una sección</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={generando}
              className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerar}
              disabled={generando || !bodegaActual || seccionesSeleccionadas.length === 0}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {generando ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Generar y Descargar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}