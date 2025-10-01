# VBodegas – Catálogo + Admin + Cliente + Stripe (Test)

## Requisitos
- Node 18+ (mejor 20/22)
- Stripe (claves **test**)

## 1) Colocar archivos
- `app/public/baja.svg` y `app/public/alta.svg`
- `server/data/coordenadas_baja_final.json`
- `server/data/coordenadas_alta_final.json`
- `server/data/bodegas.csv` con columnas: `number,planta,metros,precio,estado`

## 2) Variables de entorno
- Copia `.env.example` a `.env` y rellena claves (Stripe / JWT).

## 3) Instalar y correr
```bash
npm run install-all
npm run dev

# vbodegas
