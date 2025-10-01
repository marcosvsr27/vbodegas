import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/email/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();
      console.log("Respuesta completa:", data);

      if (!res.ok || !data.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }

      // GUARDAR TOKEN AQUÍ DIRECTAMENTE
      if (data.token) {
        localStorage.setItem("token", data.token);
        console.log("Token guardado:", localStorage.getItem("token"));
      } else {
        console.error("NO HAY TOKEN EN LA RESPUESTA");
        setError("Error: no se recibió token del servidor");
        return;
      }

      // Esperar un momento para asegurar que se guardó
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verificar que se guardó
      const tokenGuardado = localStorage.getItem("token");
      if (!tokenGuardado) {
        setError("Error crítico: no se pudo guardar el token");
        return;
      }

      // Redirigir
      if (data.usuario.rol === 'admin' || data.usuario.rol === 'superadmin' || 
          data.usuario.rol === 'editor' || data.usuario.rol === 'viewer') {
        navigate("/admin/panel");
      } else {
        navigate("/cliente/panel");
      }
    } catch (err) {
      console.error("Error completo:", err);
      setError("Error de conexión con el servidor");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-80"
      >
        <h2 className="text-2xl font-bold mb-4">Login Administrador</h2>

        {error && <p className="text-red-500 mb-3">{error}</p>}

        <input
          type="email"
          name="email"
          placeholder="Correo"
          value={form.email}
          onChange={handleChange}
          className="border p-2 w-full mb-3 rounded"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={handleChange}
          className="border p-2 w-full mb-3 rounded"
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700"
        >
          Ingresar
        </button>
      </form>
    </div>
  );
}
