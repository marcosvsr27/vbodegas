// app/src/pages/admin/Contratos.tsx  (ejemplo)
import { useState } from "react";

export default function Contratos({ clienteId }: { clienteId: string }) {
  const [url, setUrl] = useState<string>("");

  async function handleGenerar() {
    const r = await fetch(`/api/admin/clientes/${clienteId}/generar-contrato`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token") || ""}` },
      body: JSON.stringify({
        // Puedes sobreescribir datos si quieres (opcional):
        // vigencia: { inicio: "2025-07-27", fin: "2026-07-26" },
        // pagos: { renta_mensual: "$1,250.00 MXN", deposito: "$1,250.00 MXN" },
        // anexo2: [{fecha: "2025-07-27", nombre: "Nombre Apellido", tipo: "temporal"}],
        // anexo4: [{no:1, cantidad:1, descripcion:"Cajas plásticas", valor:"$500"}],
      })
    });
    const data = await r.json();
    if (data?.download_url) setUrl(data.download_url);
  }

  return (
    <div className="p-4">
      <button onClick={handleGenerar} className="px-3 py-2 rounded bg-black text-white">
        Generar contrato PDF
      </button>

      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="ml-3 underline">
          Descargar contrato
        </a>
      )}
    </div>
  );
}