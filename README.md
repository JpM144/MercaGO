# TechStore

Tienda de tecnología (celulares, accesorios, audio, cargadores, smartwatches) construida como monorepo.

## Estructura

```
├── backend/   # API REST — Node.js + Express + PostgreSQL (Sequelize)
└── frontend/  # SPA — React + Vite + Tailwind CSS
```

## Requisitos previos

- Node.js >= 18
- PostgreSQL en ejecución local (o conexión remota configurada en `.env`)

## Backend

```bash
cd backend
cp .env.example .env   # ajusta las credenciales de PostgreSQL
npm install
npm run dev            # arranca en http://localhost:3000
```

Health check:

```bash
curl http://localhost:3000/api/health
# -> { "status": "ok" }
```

## Frontend

```bash
cd frontend
cp .env.example .env   # ajusta VITE_API_URL si el backend usa otro puerto
npm install
npm run dev            # arranca en http://localhost:5173
```

La página de inicio consulta `GET /api/health` del backend y muestra el resultado, verificando la conexión end to end.

## Variables de entorno

- `backend/.env` — `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `PORT`
- `frontend/.env` — `VITE_API_URL`