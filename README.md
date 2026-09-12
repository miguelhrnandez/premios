# Gestión de Premios — Control de Stock

Aplicación web para el control de stock de premios de una sucursal, con
actualización en tiempo real, historial de movimientos, auditoría completa,
inventario físico y reportes.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Prisma** + **PostgreSQL** (pensado para usar una base gratuita de [Supabase](https://supabase.com))
- **NextAuth v5** (credenciales de usuario/contraseña, sesiones JWT)
- **Socket.IO** sobre un servidor Node personalizado para stock en tiempo real
- **Tailwind CSS v4** con modo oscuro
- **Recharts** para gráficos, **xlsx** para exportación a Excel

## Puesta en marcha

### 1. Crear la base de datos en Supabase

1. Crear un proyecto gratuito en [supabase.com](https://supabase.com).
2. Ir a **Project Settings → Database → Connection string**.
3. Copiar la conexión **Transaction pooler** (puerto `6543`) y la **Direct connection** (puerto `5432`).

### 2. Configurar y correr la app

```bash
npm install
cp .env.example .env
# completar en .env: DATABASE_URL, DIRECT_URL (de Supabase) y AUTH_SECRET (un valor propio y aleatorio)
npm run db:push             # crea las tablas en la base de Supabase
npm run db:seed             # crea usuarios y premios de ejemplo
npm run dev                 # levanta el servidor (Next.js + Socket.IO)
```

Abrir `http://localhost:3000`.

### Usuarios de ejemplo (creados por el seed)

| Usuario  | Contraseña  | Rol           |
|----------|-------------|---------------|
| admin    | admin123    | Administrador |
| jperez   | usuario123  | Usuario       |

## Funcionalidad

- **Dashboard**: KPIs de stock, alertas, gráfico de ingresos/salidas, últimos movimientos.
- **Stock de Premios**: alta/edición/baja de premios (solo admin), búsqueda, filtros por categoría y estado.
- **Registrar Movimiento**: ingresos (solo admin) y salidas (cualquier usuario), con validación de stock disponible.
- **Historial**: todos los movimientos con filtros por usuario, premio, tipo y rango de fechas; anulación de movimientos (solo admin) con motivo obligatorio.
- **Inventario**: conteo físico vs. stock del sistema, con ajuste opcional y motivo obligatorio.
- **Reportes**: premios más/menos entregados, usuarios que más retiraron, exportación a CSV/Excel e impresión a PDF.
- **Usuarios**: alta/edición/baja de usuarios y roles (solo admin).
- **Perfil**: historial personal de cada usuario.
- **Auditoría**: toda edición, anulación o ajuste queda registrada con usuario, fecha, motivo y datos antes/después (tabla `Auditoria`).
- **Tiempo real**: los cambios de stock y nuevos movimientos se propagan a todas las sesiones conectadas vía WebSockets, sin recargar la página.

## Notas de arquitectura

- El servidor (`server.js`) combina el manejador de Next.js con un servidor de Socket.IO en el mismo proceso HTTP — necesario para push en tiempo real sin infraestructura adicional. Por eso `npm run dev`/`npm run start` ejecutan `node server.js` en lugar de `next dev`/`next start`.
- Toda la lógica de negocio de movimientos de stock (ingreso, salida, ajuste) vive en `src/lib/movimientos.ts` y usa transacciones de Prisma para garantizar que el stock nunca quede inconsistente, incluso con usuarios concurrentes.
- Ningún movimiento se borra: anular un movimiento revierte su efecto sobre el stock y lo marca `anulado`, dejando el registro original intacto y una entrada de auditoría.
