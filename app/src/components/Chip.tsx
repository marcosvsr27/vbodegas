export default function Chip({ color, children }: { color: "green"|"amber"|"red", children: React.ReactNode }) {
    const map = { green: "chip chip-green", amber: "chip chip-amber", red: "chip chip-red" }
    // @ts-ignore
    return <span className={map[color]}>{children}</span>
  }