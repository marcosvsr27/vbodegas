// src/api.ts
import type { Bodega, EstadisticasAdmin } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";
const API_URL = `${BASE_URL}/api`;

// Helper para llamadas a la API
function baseFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers || {}) as Record<string, string>),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers,
    ...init,
  });
}

// -------------------- AUTH --------------------
export async function me() {
  const r = await baseFetch("/me");
  if (!r.ok) return null;
  return r.json();
}

export async function loginEmail(email: string, password: string) {
  const res = await baseFetch(`/auth/email/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  
  // Guardar token en localStorage
  if (data.ok && data.token) {
    localStorage.setItem("token", data.token);
  }
  
  return data;
}

export async function registerEmail(email: string, password: string) {
  const res = await baseFetch(`/auth/email/register`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  
  if (data.ok && data.token) {
    localStorage.setItem("token", data.token);
  }
  
  return data;
}

export async function loginGoogle(idToken: string) {
  const res = await baseFetch(`/auth/google`, {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  return res.json();
}

export async function loginApple(idToken: string) {
  const res = await baseFetch(`/auth/apple`, {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
  return res.json();
}

export async function logout() {
  localStorage.removeItem("token");
  await baseFetch(`/logout`, { method: "POST" });
}

// ... resto de las funciones (adminList, adminPatch, etc.)

// -------------------- ADMIN --------------------
export async function adminList(): Promise<Bodega[]> {
  const res = await baseFetch("/bodegas");
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

export async function adminPatch(id: string, data: any) {
  const r = await baseFetch(`/admin/bodegas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("PATCH error");
  return r.json();
}

export async function adminStats() {
  const res = await baseFetch(`/admin/stats`);
  return res.json();
}

export async function adminStatsReal(): Promise<EstadisticasAdmin> {
  const res = await baseFetch(`/admin/stats-real`);
  return res.json();
}



export async function adminUpdateBodega(id: string, data: Partial<Bodega>) {
  const res = await baseFetch(`/admin/bodegas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function adminContratosList() {
  const res = await baseFetch(`/admin/contratos`);
  return res.json();
}

export async function adminContratoReenviar(id: string) {
  const res = await baseFetch(`/admin/contratos/${id}/reenviar`, {
    method: "POST",
  });
  return res.json();
}

export async function adminLogs() {
  const res = await baseFetch(`/admin/logs`);
  return res.json();
}

// -------------------- VALIDACIÓN SUPERADMIN --------------------
export async function validateSuperAdmin(password: string) {
  const r = await baseFetch(`/admin/validate-superadmin`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (!r.ok) throw new Error("Contraseña incorrecta");
  return r.json();
}

// -------------------- CLIENTE --------------------
export async function clienteContratos() {
  const res = await baseFetch(`/contratos`);
  return res.json();
}

export async function generarContrato(bodegaId: string, meses: number, clienteData: any) {
  const r = await baseFetch(`/contratos/generar`, {
    method: "POST",
    body: JSON.stringify({ bodegaId, meses, clienteData }),
  });
  if (!r.ok) throw new Error("Error generando contrato");
  return r.json();
}

// -------------------- BODEGAS --------------------
export async function fetchBodegas(): Promise<Bodega[]> {
  const res = await baseFetch(`/bodegas`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

// -------------------- STRIPE --------------------
export async function stripeCheckout(ids: string[], meses: number, tarjetaFee: boolean) {
  return { url: "https://checkout.stripe.com/test-session" };
}

// -------------------- COMPRA DIRECTA --------------------
export async function comprarDirecto(id: string) {
  return { ok: true, id };
}

// -------------------- SSE conexión --------------------
export function connectSSE(onMessage: (event: string, data: any) => void) {
  const es = new EventSource(`${API_URL}/stream`, { withCredentials: true });

  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data);
      onMessage("message", parsed);
    } catch (err) {
      console.error("⚠ Error parseando SSE:", err);
    }
  };

  es.addEventListener("bodegaUpdate", (e) => {
    onMessage("bodegaUpdate", JSON.parse((e as MessageEvent).data));
  });

  es.addEventListener("log", (e) => {
    onMessage("log", JSON.parse((e as MessageEvent).data));
  });

  es.onerror = (err) => {
    console.warn("⚠️ Error en SSE, intentando reconectar:", err);
  };

  return es;
}

// Guardar token en localStorage
export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function getToken() {
  return localStorage.getItem("token");
}

// --- ADMIN USERS ---
export async function getAdmins() {
  const r = await baseFetch(`/admin/admins`, { method: "GET" });
  if (!r.ok) return [];
  return r.json();
}
export async function createAdmin(data: { nombre: string; email: string; password: string; telefono?: string; rol: string; permisos: string; }) {
  const r = await baseFetch(`/admin/admins`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Error creando admin");
  return r.json();
}
export async function updateAdmin(id: string, data: Partial<{ nombre: string; email: string; telefono: string; rol: string; password: string; permisos: string }>) {
  const r = await baseFetch(`/admin/admins/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Error actualizando admin");
  return r.json();
}
export async function deleteAdmin(id: string) {
  const r = await baseFetch(`/admin/admins/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Error eliminando admin");
  return r.json();
}

// --- CLIENTES ---
export async function getClientes() {
  const r = await baseFetch(`/admin/clientes`, { method: "GET" });
  if (!r.ok) return [];
  return r.json();
}
export async function createCliente(data: any) {
  const r = await baseFetch(`/admin/clientes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Error creando cliente");
  return r.json();
}
export async function updateCliente(id: string, data: any) {
  const r = await baseFetch(`/admin/clientes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Error actualizando cliente");
  return r.json();
}
export async function deleteCliente(id: string) {
  const r = await baseFetch(`/admin/clientes/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Error eliminando cliente");
  return r.json();
}
export async function sendRecordatorio(id: string) {
  const r = await baseFetch(`/admin/clientes/${id}/recordatorio`, { method: "POST" });
  if (!r.ok) throw new Error("Error enviando recordatorio");
  return r.json();
}

// --- ASIGNAR CLIENTE A BODEGA ---
export async function assignClienteToBodega(clienteId: string, bodegaId: string) {
  const r = await baseFetch(`/admin/bodegas/${bodegaId}/assign`, {
    method: "POST",
    body: JSON.stringify({ clienteId }),
  });
  if (!r.ok) throw new Error("Error asignando cliente");
  return r.json();
}

// Agregar estas funciones a tu archivo app/src/api.ts

// ... (resto del código existente)

// Función para asignar cliente a bodega
export async function asignarClienteBodega(clienteId: string, bodegaId: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/admin/clientes/${clienteId}/asignar-bodega`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bodega_id: bodegaId }),
    credentials: "include",
  });
  return res.json();
}

// Función para generar contrato PDF
export async function generarContratoPDF(clienteId: string) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/admin/clientes/${clienteId}/generar-contrato`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });
  
  if (res.ok) {
    // Descargar el PDF
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contrato_Cliente_${clienteId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
  
  return res.json();
}

// Función para subir contrato escaneado
export async function subirContratoEscaneado(clienteId: string, archivo: File) {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("contrato", archivo);
  
  const res = await fetch(`${API_URL}/admin/clientes/${clienteId}/subir-contrato`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    credentials: "include",
  });
  
  return res.json();
}

// Función para exportar datos a Excel (opcional, puedes usar SheetJS directamente)
export async function exportarDatosExcel(filtros: any) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/admin/exportar-excel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(filtros),
    credentials: "include",
  });
  
  if (res.ok) {
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Bodegas_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }
  
  return res.json();
}

// --- SUBIR DOCUMENTOS ---
export async function subirDocumentos(contratoId: string, ineFile: File, firmaFile: File) {
  const formData = new FormData();
  formData.append("contratoId", contratoId);
  formData.append("ine", ineFile);
  formData.append("firma", firmaFile);
  
  const r = await baseFetch(`/clientes/documentos`, {
    method: "POST",
    body: formData,
    headers: {} // No incluir Content-Type para FormData
  });
  if (!r.ok) throw new Error("Error subiendo documentos");
  return r.json();
}