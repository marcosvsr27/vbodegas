import { useEffect, useState } from "react";
import { adminContratosList, adminContratoReenviar } from "../../api";

export default function AdminContratos() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=>{ load(); },[]);
  async function load() {
    const r = await adminContratosList();
    setRows(r.data || []);
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Contratos</h1>
      <div className="rounded-xl border bg-white shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Bodega</th>
              <th className="p-2">Cliente</th>
              <th className="p-2">Meses</th>
              <th className="p-2">Idioma</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Reenvíos</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.id}</td>
                <td className="p-2">{r.bodega_id}</td>
                <td className="p-2">{r.cliente_email || "-"}</td>
                <td className="p-2">{r.meses}</td>
                <td className="p-2">{r.idioma}</td>
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">{r.resent_count ?? 0}</td>
                <td className="p-2">
                  <button
                    className="px-3 py-1 rounded bg-gray-900 text-white"
                    onClick={async ()=>{
                      await adminContratoReenviar(r.id);
                      load();
                    }}
                  >
                    Reenviar copia
                  </button>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-4 text-center text-gray-500" colSpan={8}>Sin contratos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}