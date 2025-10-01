// app/src/pages/admin/AdminUsers.tsx
import { useEffect, useState } from "react";
import {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from "../../api";
import type { AdminUser } from "../../types";
import { Link } from "react-router-dom";
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [superAdminPassword, setSuperAdminPassword] = useState("");

  // Estado para crear nuevo admin
  const [nuevo, setNuevo] = useState<Partial<AdminUser>>({
    nombre: "",
    email: "",
    telefono: "",
    rol: "editor",
    permisos: "completo"
  });
  const [password, setPassword] = useState("");

  // Estados para edición
  const [drafts, setDrafts] = useState<Record<string, Partial<AdminUser & { password?: string }>>>({});
  const [editPasswords, setEditPasswords] = useState<Record<string, string>>({});

  function setDraft(id: string, patch: Partial<AdminUser & { password?: string }>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function validateSuperAdmin() {
    try {
      const response = await fetch(`${API_URL}/api/admin/validate-superadmin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: superAdminPassword })
      });
      
      if (response.ok) {
        setAuthenticated(true);
        await load();
      } else {
        setErr("Contraseña de superadmin incorrecta");
      }
    } catch (e: any) {
      setErr("Error validando contraseña");
    }
  }

  async function load() {
    try {
      setLoading(true);
      const data = await getAdmins();
      setAdmins(data || []);
    } catch (e: any) {
      setErr(e?.message || "Error cargando administradores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) {
      load();
    }
  }, [authenticated]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!nuevo.nombre || !nuevo.email || !password) {
        return setErr("Todos los campos son obligatorios");
      }
      await createAdmin({ ...nuevo, password, telefono: nuevo.telefono || "" } as any);
      setNuevo({ nombre: "", email: "", telefono: "", rol: "editor", permisos: "completo" });
      setPassword("");
      await load();
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Error creando administrador");
    }
  }

  async function onSave(id: string) {
    try {
      if (!drafts[id]) return;
      
      const updateData = { ...drafts[id] };
      if (editPasswords[id]) {
        updateData.password = editPasswords[id];
      }
      
      await updateAdmin(id, updateData);
      setDrafts((d) => {
        const copy = { ...d };
        delete copy[id];
        return copy;
      });
      setEditPasswords((p) => {
        const copy = { ...p };
        delete copy[id];
        return copy;
      });
      await load();
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Error guardando cambios");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este administrador?")) return;
    try {
      await deleteAdmin(id);
      await load();
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Error eliminando administrador");
    }
  }

  // Si no está autenticado, mostrar form de contraseña
  if (!authenticated) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Gestión de Administradores</h1>
          <div className="text-sm text-gray-500">
            <Link className="underline" to="/admin/panel">← Volver al Panel</Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 max-w-md mx-auto">
          <h2 className="text-lg font-semibold mb-4">Verificación de Seguridad</h2>
          <p className="text-sm text-gray-600 mb-4">
            Ingresa la contraseña del superadmin para acceder a la gestión de administradores.
          </p>
          
          {err && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4">
              {err}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="password"
              placeholder="Contraseña de superadmin"
              value={superAdminPassword}
              onChange={(e) => setSuperAdminPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              onKeyPress={(e) => e.key === 'Enter' && validateSuperAdmin()}
            />
            <button
              onClick={validateSuperAdmin}
              className="w-full bg-purple-600 text-white rounded px-4 py-2 hover:bg-purple-700"
            >
              Acceder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestión de Administradores</h1>
        <div className="text-sm text-gray-500">
          <Link className="underline" to="/admin/panel">← Volver al Panel</Link>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
          {err}
        </div>
      )}

      {/* Crear nuevo administrador */}
      <div className="bg-white rounded-xl border p-4">
        <h2 className="text-lg font-semibold mb-4">Crear Nuevo Administrador</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input
            className="border rounded px-3 py-2"
            placeholder="Nombre completo"
            value={nuevo.nombre || ""}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          />
          <input
            type="email"
            className="border rounded px-3 py-2"
            placeholder="Email"
            value={nuevo.email || ""}
            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
          />
          <input
            type="password"
            className="border rounded px-3 py-2"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={nuevo.rol || "editor"}
            onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as any })}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Solo Lectura</option>
            <option value="superadmin">Super Admin</option>
          </select>
          <select
            className="border rounded px-3 py-2"
            value={nuevo.permisos || "completo"}
            onChange={(e) => setNuevo({ ...nuevo, permisos: e.target.value as any })}
          >
            <option value="completo">Acceso Completo</option>
            <option value="solo_lectura">Solo Lectura</option>
          </select>
          <button className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">
            Crear Admin
          </button>
        </form>
      </div>

      {/* Lista de administradores */}
      <div className="bg-white rounded-xl border p-4 overflow-x-auto">
        {loading ? (
          <p className="p-2">Cargando...</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Nombre</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Rol</th>
                <th className="text-left p-2">Permisos</th>
                <th className="text-left p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-48"
                      defaultValue={admin.nombre}
                      onChange={(e) => setDraft(admin.id, { nombre: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-60"
                      defaultValue={admin.email}
                      onChange={(e) => setDraft(admin.id, { email: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1"
                      defaultValue={admin.rol}
                      onChange={(e) => setDraft(admin.id, { rol: e.target.value as any })}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Solo Lectura</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1"
                      defaultValue={admin.permisos}
                      onChange={(e) => setDraft(admin.id, { permisos: e.target.value as any })}
                    >
                      <option value="completo">Acceso Completo</option>
                      <option value="solo_lectura">Solo Lectura</option>
                    </select>
                  </td>
                  <td className="p-2 space-x-2">
                    {drafts[admin.id] && (
                      <button
                        className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                        onClick={() => onSave(admin.id)}
                      >
                        Guardar
                      </button>
                    )}
                    <button
                      className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      onClick={() => onDelete(admin.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!admins.length && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
                    Sin administradores.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Información sobre permisos */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Información sobre Permisos</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p><strong>Super Admin:</strong> Acceso completo a todo el sistema</p>
          <p><strong>Editor:</strong> Puede editar bodegas y gestionar clientes</p>
          <p><strong>Solo Lectura:</strong> Solo puede ver información, no editar</p>
          <p><strong>Acceso Completo:</strong> Todas las funcionalidades disponibles</p>
          <p><strong>Solo Lectura:</strong> Solo visualización y creación de clientes</p>
        </div>
      </div>
    </div>
  );
}