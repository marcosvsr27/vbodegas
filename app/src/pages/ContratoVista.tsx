export default function ContratoVista(){
    const q = new URLSearchParams(location.search)
    const html = decodeURIComponent(q.get("html")||"")
    return (
      <iframe title="Contrato" className="w-full h-screen" srcDoc={html}></iframe>
    )
  }