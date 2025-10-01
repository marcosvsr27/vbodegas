import { useEffect, useState } from "react";
import { adminLogs } from "../../api";

export default function AdminLogs() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=>{ adminLogs().then(r=>setRows(r.data||[])); },[]);
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Logs internos</h1>
      <div className="rounded-xl border bg-white shadow">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2">Fecha</th>
              <th className="p-2">Actor</th>
              <th className="p-2">Acción</th>
              <th className="p-2">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{new Date(r.ts).toLocaleString()}</td>
                <td className="p-2">{r.actor}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2 text-xs">
                  <pre className="whitespace-pre-wrap">{r.details}</pre>
                </td>
              </tr>
            ))}
            {rows.length===0 && <tr><td className="p-4 text-center text-gray-500" colSpan={4}>Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}