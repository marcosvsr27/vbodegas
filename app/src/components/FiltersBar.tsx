import React from "react";

type FiltersBarProps = {
  activos: Record<"disponible" | "apartada" | "vendida", boolean>;
  setActivos: React.Dispatch<
    React.SetStateAction<Record<"disponible" | "apartada" | "vendida", boolean>>
  >;
  planta: "baja" | "alta";
  setPlanta: (p: "baja" | "alta") => void;
  areaRec: number | null;
  setAreaRec: (n: number | null) => void;
  aplicarRec: () => void;
  limpiarRec: () => void;
};

export default function FiltersBar({
  activos,
  setActivos,
  planta,
  setPlanta,
  areaRec,
  setAreaRec,
  aplicarRec,
  limpiarRec,
}: FiltersBarProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPlanta("baja")}
          className={`btn ${
            planta === "baja" ? "border-emerald-600 text-emerald-700" : ""
          }`}
        >
          Planta Baja
        </button>
        <button
          onClick={() => setPlanta("alta")}
          className={`btn ${
            planta === "alta" ? "border-emerald-600 text-emerald-700" : ""
          }`}
        >
          Planta Alta
        </button>
        <div className="ml-4 flex gap-2">
          {(["disponible", "apartada", "vendida"] as const).map((k) => (
            <label key={k} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={activos[k]}
                onChange={(e) =>
                  setActivos({ ...activos, [k]: e.target.checked })
                }
              />
              <span className="capitalize">{k}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm">Calculadora (m²):</label>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={areaRec ?? ""}
          onChange={(e) =>
            setAreaRec(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">–</option>
          <option value="6">Ej. 6</option>
          <option value="12">Ej. 12</option>
          <option value="20">Ej. 20</option>
        </select>
        <button className="btn" onClick={aplicarRec}>
          Aplicar
        </button>
        <button className="btn" onClick={limpiarRec}>
          Quitar
        </button>
      </div>
    </div>
  );
}