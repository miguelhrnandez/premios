# Stock de Premios

Aplicación web para controlar el stock de premios de una sucursal: ingresos, retiros, ajustes, inventarios, historial permanente, auditoría y reportes, con actualización en tiempo real para todos los usuarios conectados.

- **Frontend:** HTML + CSS + JavaScript sin compilación (se publica gratis en GitHub Pages).
- **Backend:** Supabase (PostgreSQL + autenticación + tiempo real + almacenamiento de imágenes).

## Archivos

```
index.html            Página principal
styles.css            Estilos (modo claro y oscuro)
app.js                Lógica de la aplicación
config.js             Datos de conexión a Supabase (completar)
supabase/schema.sql   Base de datos completa: tablas, seguridad, funciones, auditoría
```

---

## Instalación paso a paso (unos 15 minutos)

### 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com, crea una cuenta y luego **New project**.
2. Elige un nombre (por ejemplo `stock-premios`), una contraseña para la base y la región **South America (São Paulo)**.
3. Espera a que termine de crearse.

### 2. Crear la base de datos

1. En el menú izquierdo: **SQL Editor › New query**.
2. Abre `supabase/schema.sql`, copia **todo** el contenido, pégalo y presiona **Run**.
3. Debe terminar con "Success. No rows returned".

Esto crea todas las tablas, las reglas de seguridad, el tiempo real y el espacio para las imágenes de los premios.

### 3. Configurar el inicio de sesión

En **Authentication › Sign In / Providers › Email** (en algunas versiones: *Authentication › Providers › Email*):

- **Confirm email:** desactivado. Los usuarios entran con *usuario y contraseña*; no se usan correos reales.
- **Allow new users to sign up** (*Authentication › Sign In / Providers*): **dejar activado**. La app lo necesita para que el administrador cree usuarios. Quien se registre por fuera de la app queda **inactivo** y no puede ver nada hasta que un administrador lo active.

### 4. Conectar la app con Supabase

1. En Supabase: **Project Settings › API** (o *Data API*).
2. Copia la **Project URL** (sin `/rest/v1/` al final) y la **Publishable key** (`sb_publishable_...`; en proyectos antiguos se llama **anon public**).
3. Abre `config.js` y pégalas:

```js
SUPABASE_URL: 'https://abcdefgh.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi...',
```

La clave publicable es pública por diseño: la seguridad la garantizan las reglas de la base (RLS). **Nunca** pongas la **Secret key** (`sb_secret_...`) ni la `service_role` en este archivo.

### 5. Publicar en GitHub Pages

1. En https://github.com crea un repositorio nuevo (por ejemplo `stock-premios`). Puede ser privado si tu plan de GitHub permite Pages en repos privados; si no, público.
2. **Add file › Upload files** y sube: `index.html`, `styles.css`, `app.js`, `config.js` y la carpeta `supabase`.
3. **Settings › Pages › Build and deployment**: *Source* = **Deploy from a branch**, *Branch* = **main** / **(root)** › **Save**.
4. En 1 o 2 minutos aparece la dirección, por ejemplo `https://tu-usuario.github.io/stock-premios/`.

> También funciona en Netlify o Vercel arrastrando la carpeta, o abriendo `index.html` desde un servidor local.

### 6. Primer ingreso

1. Abre la dirección de la app. Como todavía no hay usuarios, aparece **Crear el administrador**.
2. Completa nombre, usuario y contraseña. Esa cuenta queda como **Administrador**.
3. En **Configuración** revisa el nombre de la sucursal y las categorías.
4. En **Usuarios › Nuevo usuario** crea las cuentas del equipo (rol *Usuario* o *Administrador*).
5. En **Stock de Premios › Nuevo premio** carga los premios (con stock inicial, que se registra como ingreso).

---

## Cómo funciona

### Roles

| | Administrador | Usuario |
|---|---|---|
| Ver stock y dashboard | Sí | Sí |
| Registrar retiros | Sí | Sí |
| Registrar ingresos y ajustes | Sí | No |
| Crear, editar, desactivar o eliminar premios | Sí | No |
| Historial completo, "¿quién lo sacó?" | Sí | Solo su propio historial |
| Corregir o anular movimientos | Sí | No |
| Inventario, reportes, usuarios, auditoría | Sí | No |

Los permisos se controlan **en la base de datos**, no solo en la pantalla: aunque alguien manipule la página, Supabase rechaza la operación.

### Reglas de integridad

- El stock **solo** cambia registrando un movimiento. Editar el número a mano está bloqueado en la base.
- Cada movimiento guarda premio, cantidad, usuario, fecha y hora, stock anterior y stock resultante.
- **No se puede retirar más de lo que hay.** La base bloquea el premio mientras registra el movimiento, así que dos personas retirando al mismo tiempo nunca dejan el stock negativo.
- Los movimientos **no se pueden borrar ni editar**. Para arreglar un error:
  - **Corregir** (cambiar la cantidad): se agrega un movimiento de *corrección* por la diferencia.
  - **Anular**: se agrega un movimiento de *anulación* que revierte el efecto.
  En ambos casos el motivo es obligatorio y queda en la **Auditoría** con los datos de antes y de después.
- Los premios y usuarios con historial no se eliminan: se **desactivan**.
- La auditoría registra automáticamente altas, ediciones y eliminaciones de premios, usuarios, categorías y configuración, más cambios de contraseña.

### Alertas automáticas

La base genera alertas, que llegan al instante a los usuarios conectados (campana y aviso emergente):

- ⚠️ **Stock bajo**: el premio llegó a su stock mínimo.
- 🚨 **Sin stock**: el premio se quedó en cero.
- ⚖️ **Ajuste importante**: ajuste igual o mayor al umbral (por defecto 10 unidades; se cambia en Configuración). Solo administradores.
- 📋 **Diferencia de inventario**: el conteo físico no coincidió con el sistema. Solo administradores.

### Tiempo real

El indicador **En vivo** de la barra superior muestra que la conexión está activa. Cuando alguien registra un movimiento, el stock cambia en todas las pantallas abiertas y el número destella con la diferencia (por ejemplo, −3). Si se corta internet, la app se reconecta y vuelve a cargar los datos sola.

### Exportaciones

Historial, reportes, inventarios, perfiles y auditoría se exportan a **Excel**, **CSV** (separado por punto y coma, abre directo en Excel en español) y **PDF**. En Reportes, **Exportar todo a Excel** genera un libro con una hoja por reporte más el stock actual.

---

## Preguntas frecuentes

**Un usuario olvidó su contraseña.** Administrador › Usuarios › ícono de llave › nueva contraseña.

**¿Puedo cambiar el nombre de usuario de alguien?** No (es su credencial). Crea un usuario nuevo y desactiva el anterior; el historial del anterior se conserva.

**Al crear el administrador dice que hay que confirmar el email.** Falta desactivar *Confirm email* (paso 3). Desactívalo y luego, en Supabase › Authentication › Users, confirma o elimina ese usuario y vuelve a crearlo.

**Las imágenes no suben.** Verifica que el script SQL se haya ejecutado completo (crea el bucket `premios` en *Storage*).

**¿Cuántas personas pueden usarla a la vez?** El plan gratuito de Supabase alcanza holgadamente para el equipo de una sucursal. Los límites vigentes de cada plan están en supabase.com/pricing.

**Copias de seguridad.** El plan gratuito no incluye backups automáticos descargables. Exporta periódicamente desde *Reportes › Exportar todo a Excel* o usa un plan pago de Supabase.
