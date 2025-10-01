import { useEffect, useState } from "react";
import { me } from "../../api";
import { useNavigate } from "react-router-dom";

export default function AdminLayout({ children }: any) {
  const nav = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    me().then((u) => {
      if (!u || u.rol !== "admin") nav("/admin/login");
      else setOk(true);
    });
  }, []);

  if (ok === null) return <div className="p-6">Cargando…</div>;
  return <>{children}</>;
}