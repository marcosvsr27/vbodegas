import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="bg-white shadow p-4 flex gap-6">
      <Link to="/" className="text-blue-600 hover:underline">Catálogo</Link>
      <Link to="/cliente/login" className="text-blue-600 hover:underline">Cliente</Link>
      <Link to="/admin/login" className="text-blue-600 hover:underline">Admin</Link>
    </nav>
  );
}