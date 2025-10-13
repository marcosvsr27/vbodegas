// app/src/types.ts

// ---- Bodega ----
export type EstadoBodega = "disponible" | "apartada" | "vendida";

export interface Bodega {
  id: string;
  number: string;
  planta: "baja" | "alta";
  medidas: string;
  metros: number | null;
  precio: number | null;
  estado: EstadoBodega;
  points: [number, number][];
  cualitativos?: string;
  cliente?: string
  clienteId?: string | null;
  clienteNombre?: string | null;
}

// ---- Usuario / Cliente ----
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password?: string;
  rol: "cliente" | "admin";
  token?: string;
}

// ---- Contrato ----
export interface Contrato {
  id: string;
  clienteId: string;
  bodegaId: string;
  fechaInicio: string;
  meses: number;
  idioma: "es" | "en";
  urlPdf?: string;
}

// ---- API Responses ----
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type BodegaListResponse = ApiResponse<Bodega[]>;

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export type ContratoListResponse = ApiResponse<Contrato[]>;

// ---- Carrito ----
export interface CarritoItem extends Bodega {
  cantidad?: number;
}

// ---- Administradores ----
export type AdminRol = "superadmin" | "editor" | "viewer";

export interface AdminUser {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: AdminRol;
  permisos: "completo" | "solo_lectura";
}

// ---- Clientes ----
export interface ClienteContrato {
  id: string;
  bodegaId: string;
  number?: string;
  planta?: "baja" | "alta";
  inicio?: string;
  fin?: string;
  estado?: "activo" | "pendiente" | "vencido";
  pdfUrl?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  apellidos?: string;
  email: string;
  telefono?: string;
  regimen_fiscal?: string;
  bodega_id?: string;
  modulo?: string;
  planta?: "baja" | "alta";
  medidas?: string;
  metros?: number;
  fecha_inicio?: string;
  duracion_meses?: number;
  fecha_expiracion?: string;
  pago_mensual?: number;
  fecha_registro?: string;
  estado_contrato?: "activo" | "proximo_vencer" | "vencido" | "sin_contrato";
  contratos?: ClienteContrato[];
  
  // 🆕 Campos adicionales del CSV
  tipo_contrato?: string;
  vencido_hoy?: number;
  saldo?: number;
  abonos?: number;
  cargos?: number;
  fecha_emision?: string;
  descripcion?: string;
  factura?: string;
  comentarios?: string;
}

// ---- Contratos Generados ----
export interface ContratoGenerado {
  id: string;
  clienteId: string;
  bodegaId: string;
  pdfUrl: string;
  firmado: boolean;
  documentosSubidos: boolean;
  fechaCreacion: string;
  requiresSignature?: boolean;
}

// ---- Estadísticas Admin ----
export interface EstadisticasAdmin {
  ocupacion: string;
  ingresosMensuales: string;
  tiempoPromedio: string;
  tasaConversion: string;
  totalBodegas: number;
  disponibles: number;
  ocupadas: number;
  totalClientes: number;
}

// ---- Importación CSV ----
export interface CSVImportResult {
  exitosos: number;
  errores: number;
  duplicados: number;
  actualizados: number;
  detalles: string[];
}