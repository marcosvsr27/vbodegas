// app/src/router.tsx
import { createBrowserRouter } from "react-router-dom"
import App from "./App"
import Catalogo from "./pages/catalogo"
import AdminLogin from "./pages/AdminLogin"
import AdminPanel from "./pages/AdminPanel"
import ClienteLogin from "./pages/ClienteLogin"
import ClientePanel from "./pages/ClientePanel"
import ClienteRegistro from "./pages/ClienteRegistro"
import AdminUsers from "./pages/admin/AdminUsers";
import Clientes from "./pages/admin/Clientes";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Catalogo /> },
      { path: "admin/login", element: <AdminLogin /> },
      { path: "admin/panel", element: <AdminPanel /> },
      { path: "admin/users", element: <AdminUsers /> },
      { path: "admin/clientes", element: <Clientes /> },
      { path: "cliente/login", element: <ClienteLogin /> },
      { path: "cliente/panel", element: <ClientePanel /> },
      { path: "cliente/registro", element: <ClienteRegistro /> },
      
    ],
  },
])


