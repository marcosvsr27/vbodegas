// app/src/App.tsx
import { Outlet, Link } from "react-router-dom"

export default function App() {
  return (
    <div className="max-w-[1280px] mx-auto p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">V Bodegas</h1>
        <nav className="text-sm flex gap-4">
          <Link to="/">Catálogo</Link>
          <Link to="/admin/login">Admin</Link>
          <Link to="/cliente/login">Cliente</Link>
          <Link to="/cliente/registro">Registro</Link>
        </nav>
      </header>

      {/* 👇 Aquí se renderizan las rutas hijas */}
      <main className="mt-6">
        <Outlet />
      </main>
    </div>
  )
}