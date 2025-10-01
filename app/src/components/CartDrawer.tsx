import type { Bodega } from "../types"
export default function CartDrawer({ open, items, onClose }: { open:boolean, items:Bodega[], onClose:()=>void }) {
  return (
    <div className={`fixed top-0 right-0 h-full w-[360px] bg-white shadow-xl border-l transform transition-transform ${open?"translate-x-0":"translate-x-full"}`}>
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Carrito</h3>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="p-4 space-y-3">
        {items.length===0 && <p className="text-sm text-slate-500">Tu carrito está vacío.</p>}
        {items.map(it=>(
          <div key={it.number} className="border rounded p-2">
            <div className="font-medium">Bodega {it.number}</div>
            <div className="text-sm text-slate-600">{it.metros} m² — ${it.precio.toLocaleString()} / mes</div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t mt-auto">
      <button
  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
  onClick={() => {
    if (!document.cookie.includes("auth=")) {
      window.location.href = "/cliente/login"; // redirige a login si no hay sesión
    } else {
      handleCheckout(); // procede normalmente
    }
  }}
>
  Proceder al pago
</button>
      </div>
    </div>
  )
}