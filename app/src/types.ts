// app/src/types.ts

// ---- Bodega ----
export type EstadoBodega = "disponible" | "apartada" | "vendida";

export interface Bodega {
  id: string;                // Identificador interno (ej. "1")
  number: string;            // Ej. "A-101" (visible al usuario)
  planta: "baja" | "alta";   // Nivel de la bodega
  medidas: string;           // Texto: "3.00 x 4.00"
  metros: number | null;     // Área en m²
  precio: number | null;     // Precio de renta
  estado: EstadoBodega;      // Estado normalizado
  points: [number, number][];// Polígono en formato [x,y]
  cualitativos?: string;     // Extras opcionales
  cliente?: string
  clienteId?: string | null;
  clienteNombre?: string | null;
}

// ---- Usuario / Cliente ----
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password?: string;     // Nunca expongas en frontend salvo registro/login
  rol: "cliente" | "admin";
  token?: string;        // Guardar token de sesión
}

// ---- Contrato ----
export interface Contrato {
  id: string;
  clienteId: string;
  bodegaId: string;
  fechaInicio: string;  // ISO string
  meses: number;
  idioma: "es" | "en";
  urlPdf?: string;      // Enlace al contrato generado
}

// ---- API Responses ----
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// Lista de bodegas
export type BodegaListResponse = ApiResponse<Bodega[]>;

// Login / Registro
export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

// Contratos de un cliente
export type ContratoListResponse = ApiResponse<Contrato[]>;

// ---- Carrito ----
export interface CarritoItem extends Bodega {
  cantidad?: number; // para futuros upgrades
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
  inicio?: string; // ISO
  fin?: string;    // ISO
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

